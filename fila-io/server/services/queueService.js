/**
 * services/queueService.js
 *
 * Toda a lógica de operações na fila.
 *
 * Fluxo de dados:
 *   1. Operação chega (joinQueue, callNext, etc.)
 *   2. Atualiza Redis imediatamente → broadcast Socket.io (< 200ms)
 *   3. Persiste no PostgreSQL com retry + fallback sync_log
 *   4. Em modo híbrido: grava sync_log se offline
 */
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/db");
const {
  getCachedQueue,
  cacheQueue,
  getRoom,
  recalcPositions,
} = require("./roomService");

// ── Persistência resiliente ──────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS = [200, 800, 2000]; // backoff exponencial (ms)

/**
 * Executa uma query no PostgreSQL com retry automático.
 * Se todas as tentativas falharem, grava no sync_log como fallback
 * para reconciliação futura.
 *
 * @param {string}   label     - Identificador para logs (ex: "persistTicket")
 * @param {string}   sql       - Query SQL
 * @param {Array}    params    - Parâmetros da query
 * @param {object}   [syncFallback] - Dados para sync_log se retry esgotar
 * @param {string}   syncFallback.orgId
 * @param {string}   syncFallback.eventType
 * @param {object}   syncFallback.payload
 */
const resilientPersist = async (label, sql, params, syncFallback) => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await pool.query(sql, params);
      return; // sucesso
    } catch (err) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;
      if (isLastAttempt) {
        console.error(`[queue] ${label}: falha após ${MAX_RETRIES} tentativas — ${err.message}`);

        // Fallback: grava no sync_log para reconciliação futura
        if (syncFallback) {
          try {
            await pool.query(
              `INSERT INTO sync_log (org_id, event_type, payload, origin)
               VALUES ($1, $2, $3, 'local')`,
              [syncFallback.orgId, syncFallback.eventType, JSON.stringify(syncFallback.payload)]
            );
            console.warn(`[queue] ${label}: evento salvo no sync_log para reconciliação.`);
          } catch (syncErr) {
            // Se até o sync_log falhar, o banco está completamente indisponível
            console.error(`[queue] ${label}: CRÍTICO — sync_log também falhou: ${syncErr.message}`);
          }
        }
      } else {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`[queue] ${label}: tentativa ${attempt + 1}/${MAX_RETRIES} falhou, retentando em ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
};

// ── Persistência assíncrona ──────────────────────────────────────

/** Persiste ticket no PostgreSQL sem bloquear o fluxo principal. */
const persistTicket = (roomId, ticket) => {
  resilientPersist(
    "persistTicket",
    `INSERT INTO tickets
       (id, room_id, token, name, category, priority, tma, status, manual,
        position, estimated_wait, joined_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (token) DO UPDATE
       SET position = EXCLUDED.position,
           estimated_wait = EXCLUDED.estimated_wait`,
    [
      ticket.id,
      roomId,
      ticket.token,
      ticket.name,
      ticket.category,
      ticket.priority,
      ticket.tma,
      ticket.status,
      ticket.manual,
      ticket.position,
      ticket.estimatedWait,
      new Date(ticket.joinedAt),
    ],
    {
      orgId: ticket._orgId,
      eventType: "ticket.join",
      payload: { roomId, ticket },
    }
  );
};

/** Atualiza posições no PostgreSQL em batch (executado após recalc). */
const persistPositions = (queue) => {
  if (queue.length === 0) return;

  // Constrói VALUES parametrizados: ($1,$2,$3), ($4,$5,$6), ...
  const params = [];
  const placeholders = queue.map((t, i) => {
    const base = i * 3;
    params.push(t.token, i + 1, t.estimatedWait);
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  }).join(",");

  resilientPersist(
    "persistPositions",
    `UPDATE tickets AS t SET position = v.position, estimated_wait = v.est
     FROM (VALUES ${placeholders}) AS v(token, position, est)
     WHERE t.token = v.token`,
    params
  );
};

// ── Queue API ─────────────────────────────────────────────────────

/**
 * Adiciona um cliente à fila.
 * Retorna o ticket criado com posição calculada.
 */
const joinQueue = async (roomCode, { name, category, manual = false }) => {
  const room = await getRoom(roomCode);
  if (!room || !room.active) throw new Error("Sala inativa ou inexistente.");

  const categories = Array.isArray(room.categories)
    ? room.categories
    : JSON.parse(room.categories);

  const catConfig = categories.find((c) => c.name === category);
  if (!catConfig) throw new Error(`Categoria "${category}" não existe nesta sala.`);

  const ticket = {
    id: uuidv4(),
    token: `${roomCode}-${uuidv4()}`,
    name: name.trim().substring(0, 80),
    category,
    priority: catConfig.priority,
    tma: catConfig.tma,
    joinedAt: Date.now(),
    status: "waiting",
    manual,
    position: 0,
    estimatedWait: 0,
    _orgId: room.org_id, // usado internamente pelo persistTicket
  };

  // Atualiza Redis
  const queue = (await getCachedQueue(roomCode)) || [];
  queue.push(ticket);
  recalcPositions(queue);
  await cacheQueue(roomCode, queue);

  // Persiste no PostgreSQL (async com retry)
  persistTicket(room.id, ticket);

  return ticket;
};

/**
 * Chama o próximo ticket de maior prioridade.
 * Remove da fila ativa e atualiza status no banco.
 */
const callNext = async (roomCode) => {
  const queue = (await getCachedQueue(roomCode)) || [];
  if (queue.length === 0) return null;

  const next = queue.shift(); // já ordenado por recalcPositions
  next.status = "called";
  next.calledAt = Date.now();

  recalcPositions(queue);
  await cacheQueue(roomCode, queue);

  // Persiste com retry
  resilientPersist(
    "callNext",
    `UPDATE tickets SET status = 'called', called_at = $2 WHERE token = $1`,
    [next.token, new Date(next.calledAt)],
    {
      orgId: next._orgId,
      eventType: "ticket.called",
      payload: { token: next.token, calledAt: next.calledAt },
    }
  );

  persistPositions(queue);

  return next;
};

/**
 * Remove ticket da fila (cliente foi embora / host removeu).
 * Conta como abandono nos relatórios.
 */
const removeTicket = async (roomCode, token) => {
  const queue = (await getCachedQueue(roomCode)) || [];
  const before = queue.length;
  const updated = queue.filter((t) => t.token !== token);

  if (updated.length === before) throw new Error("Ticket não encontrado na fila.");

  recalcPositions(updated);
  await cacheQueue(roomCode, updated);

  resilientPersist(
    "removeTicket",
    `UPDATE tickets SET status = 'abandoned' WHERE token = $1`,
    [token]
  );

  return updated;
};

/**
 * Altera prioridade de um ticket e reordena a fila.
 */
const changePriority = async (roomCode, token, newPriority) => {
  if (![1, 2, 3].includes(newPriority)) throw new Error("Prioridade inválida. Use 1, 2 ou 3.");

  const queue = (await getCachedQueue(roomCode)) || [];
  const ticket = queue.find((t) => t.token === token);
  if (!ticket) throw new Error("Ticket não encontrado na fila.");

  ticket.priority = newPriority;
  recalcPositions(queue);
  await cacheQueue(roomCode, queue);

  resilientPersist(
    "changePriority",
    `UPDATE tickets SET priority = $2 WHERE token = $1`,
    [token, newPriority]
  );

  return queue;
};

/** Retorna snapshot atual da fila (Redis ou banco como fallback). */
const getQueue = async (roomCode) => {
  const cached = await getCachedQueue(roomCode);
  if (cached) return cached;

  // Fallback: carrega do banco e re-popula o Redis
  const room = await getRoom(roomCode);
  if (!room) throw new Error("Sala não encontrada.");

  const { rows } = await pool.query(
    `SELECT * FROM tickets
     WHERE room_id = $1 AND status = 'waiting'
     ORDER BY priority DESC, joined_at ASC`,
    [room.id]
  );

  const queue = rows.map((t) => ({
    id: t.id,
    token: t.token,
    name: t.name,
    category: t.category,
    priority: t.priority,
    tma: t.tma,
    joinedAt: new Date(t.joined_at).getTime(),
    status: t.status,
    manual: t.manual,
    position: t.position,
    estimatedWait: t.estimated_wait,
  }));

  recalcPositions(queue);
  await cacheQueue(roomCode, queue);
  return queue;
};

/**
 * Confirma que um ticket chamado foi efetivamente atendido.
 * Transição: called → served (preenche served_at).
 */
const confirmServed = async (token) => {
  const { rowCount } = await pool.query(
    `UPDATE tickets
     SET status = 'served', served_at = NOW()
     WHERE token = $1 AND status = 'called'`,
    [token]
  );
  if (rowCount === 0) throw new Error("Ticket não encontrado ou já finalizado.");
};

/**
 * Chama um ticket específico da fila (pelo token).
 * Remove da fila ativa e atualiza status no banco.
 */
const callSpecific = async (roomCode, token) => {
  const queue = (await getCachedQueue(roomCode)) || [];
  const idx = queue.findIndex((t) => t.token === token);
  if (idx === -1) throw new Error("Ticket não encontrado na fila.");

  const [ticket] = queue.splice(idx, 1);
  ticket.status = "called";
  ticket.calledAt = Date.now();

  recalcPositions(queue);
  await cacheQueue(roomCode, queue);

  resilientPersist(
    "callSpecific",
    `UPDATE tickets SET status = 'called', called_at = $2 WHERE token = $1`,
    [ticket.token, new Date(ticket.calledAt)],
    {
      orgId: ticket._orgId,
      eventType: "ticket.called",
      payload: { token: ticket.token, calledAt: ticket.calledAt },
    }
  );

  persistPositions(queue);

  return ticket;
};

module.exports = { joinQueue, callNext, callSpecific, removeTicket, changePriority, getQueue, confirmServed };
