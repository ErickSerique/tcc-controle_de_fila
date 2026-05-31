/**
 * services/roomService.js
 *
 * Gerencia salas de atendimento.
 *
 * Estratégia de dados:
 *   PostgreSQL → fonte da verdade (persistência)
 *   Redis      → cache da fila ativa (velocidade < 200ms)
 *
 * O código público de 6 chars é gerado aqui e garantido único no banco.
 */
const { pool } = require("../config/db");
const redis = require("../config/redis");

const QUEUE_KEY = (code) => `queue:${code}`;
const ROOM_KEY  = (code) => `room:${code}`;

// ── Helpers ───────────────────────────────────────────────────────

/** Gera código alfanumérico de 6 chars, verifica unicidade no banco. */
const generateCode = async () => {
  let code;
  let attempts = 0;
  do {
    code = Math.random().toString(36).substr(2, 6).toUpperCase();
    const { rows } = await pool.query("SELECT id FROM rooms WHERE code = $1", [code]);
    if (rows.length === 0) return code;
    attempts++;
  } while (attempts < 10);
  throw new Error("Não foi possível gerar um código único. Tente novamente.");
};

/**
 * Algoritmo de fila priorizada com previsão de espera.
 * Ordenação: prioridade DESC → joinedAt ASC (FIFO na mesma prioridade).
 * Complexidade: O(n log n)
 */
const recalcPositions = (queue) => {
  queue.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.joinedAt - b.joinedAt;
  });

  let accumulated = 0;
  queue.forEach((ticket, i) => {
    ticket.position = i + 1;
    ticket.estimatedWait = accumulated;
    accumulated += ticket.tma;
  });

  return queue;
};

// ── Cache Redis helpers ───────────────────────────────────────────

const cacheQueue = async (code, queue) => {
  await redis.setex(QUEUE_KEY(code), 3600 * 8, JSON.stringify(queue));
};

const getCachedQueue = async (code) => {
  const raw = await redis.get(QUEUE_KEY(code));
  return raw ? JSON.parse(raw) : null;
};

const cacheRoom = async (room) => {
  await redis.setex(ROOM_KEY(room.code), 3600 * 8, JSON.stringify(room));
};

const getCachedRoom = async (code) => {
  const raw = await redis.get(ROOM_KEY(code));
  return raw ? JSON.parse(raw) : null;
};

// ── Service API ───────────────────────────────────────────────────

const createRoom = async ({ orgId, name, categories, userId }) => {
  const code = await generateCode();

  const { rows } = await pool.query(
    `INSERT INTO rooms (org_id, code, name, categories, opened_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [orgId, code, name, JSON.stringify(categories), userId]
  );
  const room = rows[0];

  // Inicializa fila vazia no Redis
  await cacheQueue(code, []);
  await cacheRoom(room);

  return room;
};

const getRoom = async (code) => {
  // Tenta Redis primeiro
  const cached = await getCachedRoom(code?.toUpperCase());
  if (cached) return cached;

  const { rows } = await pool.query(
    "SELECT * FROM rooms WHERE code = $1",
    [code?.toUpperCase()]
  );
  if (rows[0]) await cacheRoom(rows[0]);
  return rows[0] ?? null;
};

const roomExists = async (code) => {
  const room = await getRoom(code);
  return Boolean(room && room.active);
};

const listOrgRooms = async (orgId, { activeOnly = false } = {}) => {
  const { rows } = await pool.query(
    `SELECT r.*,
            (SELECT COUNT(*) FROM tickets t WHERE t.room_id = r.id AND t.status = 'waiting') AS queue_length,
            (SELECT COUNT(*) FROM tickets t WHERE t.room_id = r.id AND t.status = 'served') AS served_count
     FROM rooms r
     WHERE r.org_id = $1 ${activeOnly ? "AND r.active = TRUE" : ""}
     ORDER BY r.created_at DESC`,
    [orgId]
  );
  return rows;
};

/**
 * Encerra o dia: persiste o relatório, marca a sala como inativa,
 * limpa o cache Redis.
 */
const closeDay = async (code, { closedByUserId }) => {
  const room = await getRoom(code);
  if (!room) throw new Error("Sala não encontrada.");
  if (!room.active) throw new Error("Sala já encerrada.");

  const queue = (await getCachedQueue(code)) || [];

  // Marca tickets ainda em espera na fila como 'abandoned'
  if (queue.length > 0) {
    const tokens = queue.map((t) => t.token);
    await pool.query(
      `UPDATE tickets SET status = 'abandoned'
       WHERE token = ANY($1::text[])`,
      [tokens]
    );
  }

  // Tickets com status 'called' foram chamados mas o dia encerrou antes
  // da confirmação — contam como atendidos para fins de relatório
  await pool.query(
    `UPDATE tickets
     SET status = 'served', called_at = COALESCE(called_at, NOW())
     WHERE room_id = $1 AND status = 'called'`,
    [room.id]
  );

  // Calcula métricas para o relatório
  // avg_wait usa a diferença entre called_at e joined_at para todos os atendidos
  const { rows: servedRows } = await pool.query(
    `SELECT called_at, joined_at FROM tickets
     WHERE room_id = $1 AND status = 'served' AND called_at IS NOT NULL AND joined_at IS NOT NULL`,
    [room.id]
  );

  const waitTimes = servedRows
    .map((t) => (new Date(t.called_at) - new Date(t.joined_at)) / 60_000)
    .filter((w) => w >= 0); // ignora valores negativos por dessincronia de relógio

  const avgWait =
    waitTimes.length > 0
      ? parseFloat((waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length).toFixed(1))
      : 0;

  const { rows: countRows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'served')    AS served,
       COUNT(*) FILTER (WHERE status = 'abandoned') AS abandoned
     FROM tickets WHERE room_id = $1`,
    [room.id]
  );

  // Salva relatório
  const { rows: reportRows } = await pool.query(
    `INSERT INTO session_reports
       (org_id, room_id, room_code, room_name, total_served, total_abandoned, avg_wait_minutes, generated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      room.org_id,
      room.id,
      room.code,
      room.name,
      parseInt(countRows[0].served),
      parseInt(countRows[0].abandoned),
      avgWait,
      closedByUserId,
    ]
  );

  // Fecha a sala
  await pool.query(
    `UPDATE rooms SET active = FALSE, closed_at = NOW(), closed_by = $2 WHERE id = $1`,
    [room.id, closedByUserId]
  );

  // Limpa cache
  await redis.del(QUEUE_KEY(code), ROOM_KEY(code));

  // Inclui tickets no relatório para download
  const { rows: tickets } = await pool.query(
    "SELECT * FROM tickets WHERE room_id = $1 ORDER BY joined_at",
    [room.id]
  );

  return { ...reportRows[0], tickets };
};

const getHistory = async (orgId) => {
  const { rows } = await pool.query(
    `SELECT sr.*, up.name AS generated_by_name
     FROM session_reports sr
     LEFT JOIN user_profiles up ON up.id = sr.generated_by
     WHERE sr.org_id = $1
     ORDER BY sr.generated_at DESC`,
    [orgId]
  );
  return rows;
};

module.exports = {
  createRoom,
  getRoom,
  roomExists,
  listOrgRooms,
  recalcPositions,
  cacheQueue,
  getCachedQueue,
  closeDay,
  getHistory,
};
