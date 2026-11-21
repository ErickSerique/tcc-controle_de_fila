/**
 * services/roomService.js
 *
 * Gerencia o estado das salas ativas em memória, histórico de sessões persistente
 * em PostgreSQL (room_sessions), reivindicação de guichês e intercalação de prioridade
 * em cascata (Alta -> Média -> Baixa).
 */
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/db");
const { logAction } = require("./logService");

const rooms = new Map();
const inMemoryHistory = [];

const DEFAULT_COUNTERS = [{ id: "c1", name: "Guichê 1" }];
const DEFAULT_PRIORITY_RULES = { highBatchSize: 3, medBatchSize: 2 };

// ── Intercalação em Cascata de Prioridade ─────────────────────────
const recalcPositions = (queue, priorityRule = DEFAULT_PRIORITY_RULES) => {
  if (!queue || queue.length === 0) return;

  const highBatch =
    typeof priorityRule === "number"
      ? priorityRule
      : priorityRule?.highBatchSize ?? priorityRule?.batchSize ?? 3;
  const medBatch = priorityRule?.medBatchSize ?? 2;

  // Se ambas as regras forem 0, usa ordenação estrita tradicional por prioridade
  if (highBatch === 0 && medBatch === 0) {
    queue.sort((a, b) => b.priority - a.priority || a.joinedAt - b.joinedAt);
    let cumulativeWait = 0;
    queue.forEach((t, i) => {
      t.position = i + 1;
      cumulativeWait += t.tma || 5;
      t.estimatedWait = cumulativeWait;
    });
    return;
  }

  // Agrupa por prioridade (3: Alta, 2: Média, 1: Baixa) com ordenação FIFO por joinedAt
  const highs = queue.filter((t) => t.priority === 3).sort((a, b) => a.joinedAt - b.joinedAt);
  const meds = queue.filter((t) => t.priority === 2).sort((a, b) => a.joinedAt - b.joinedAt);
  const lows = queue.filter((t) => t.priority === 1).sort((a, b) => a.joinedAt - b.joinedAt);

  const reordered = [];
  let medsSinceLastLow = 0;

  while (highs.length > 0 || meds.length > 0 || lows.length > 0) {
    // 1. Puxa bloco de Altas (até highBatch)
    if (highs.length > 0 && highBatch > 0) {
      const takeCount = Math.min(highs.length, highBatch);
      for (let i = 0; i < takeCount; i++) {
        reordered.push(highs.shift());
      }
    } else if (highs.length > 0 && meds.length === 0 && lows.length === 0) {
      reordered.push(highs.shift());
    }

    // 2. Intercala com Média (se houver)
    if (meds.length > 0) {
      reordered.push(meds.shift());
      medsSinceLastLow++;

      // A cada medBatch médias atendidas, intercala 1 Baixa
      if (medBatch > 0 && medsSinceLastLow >= medBatch && lows.length > 0) {
        reordered.push(lows.shift());
        medsSinceLastLow = 0;
      }
    } else if (lows.length > 0 && highs.length === 0) {
      // Se não há altas nem médias, atende baixas
      reordered.push(lows.shift());
    } else if (lows.length > 0 && highs.length > 0 && meds.length === 0) {
      // Se não há médias, mas há altas e baixas, intercala baixa
      reordered.push(lows.shift());
    }
  }

  // Atualiza posições e tempo estimado acumulado
  let cumulativeWait = 0;
  reordered.forEach((t, i) => {
    t.position = i + 1;
    cumulativeWait += t.tma || 5;
    t.estimatedWait = cumulativeWait;
  });

  queue.splice(0, queue.length, ...reordered);
};

// ── Gestão de Salas em Memória ────────────────────────────────────

const createRoom = ({
  name,
  orgId,
  hostId,
  categories,
  counters,
  customFields,
  priorityBatchSize,
  priorityRules,
  actor,
}) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  const rules =
    priorityRules ||
    (typeof priorityBatchSize === "number"
      ? { highBatchSize: priorityBatchSize, medBatchSize: 2 }
      : DEFAULT_PRIORITY_RULES);

  const room = {
    id: uuidv4(),
    code,
    name,
    orgId,
    hostId,
    categories: categories || [
      { name: "Atendimento Geral", priority: 1, tma: 10 },
      { name: "Prioritário", priority: 3, tma: 5 },
    ],
    counters: counters?.length ? counters : DEFAULT_COUNTERS,
    customFields: customFields || [],
    priorityRule: rules,
    counterClaims: {},
    queue: [],
    archive: [],
    logs: [],
    active: true,
    locked: false,
    openedAt: new Date().toISOString(),
    createdAt: Date.now(),
  };

  rooms.set(code, room);
  logAction(room, actor, "room.opened", { name, countersCount: room.counters.length });
  return room;
};

const getRoom = (code) => {
  if (!code) return null;
  return rooms.get(code.toString().trim().toUpperCase()) ?? null;
};

const roomExists = (code) => {
  if (!code) return false;
  const r = rooms.get(code.toString().trim().toUpperCase());
  return !!(r && r.active);
};

const listActiveRooms = (orgId) => {
  const result = [];
  for (const room of rooms.values()) {
    if (room.active && (!orgId || room.orgId === orgId)) {
      const claims = Object.values(room.counterClaims || {});
      const totalCounters = room.counters?.length || 1;
      const occupiedCountersCount = claims.length;

      result.push({
        code: room.code,
        name: room.name,
        orgId: room.orgId,
        counters: room.counters,
        totalCounters,
        occupiedCountersCount,
        occupiedBy: claims.map((c) => c.name),
        isFull: occupiedCountersCount >= totalCounters,
        queueLength: room.queue.filter((t) => t.status === "waiting").length,
        inServiceLength: room.queue.filter((t) => t.status === "called").length,
        locked: !!room.locked,
        openedAt: room.openedAt,
      });
    }
  }
  return result;
};

// ── Encerramento de Sessão (closeDay) & Persistência Permanente ───

const closeDay = (roomCode, actor) => {
  const room = getRoom(roomCode);
  if (!room) throw new Error("Sala não encontrada.");

  // Validação: a fila DEVE estar vazia
  const waitingCount = room.queue.filter((t) => t.status === "waiting").length;
  if (waitingCount > 0) {
    throw new Error(`Não é possível encerrar: ainda há ${waitingCount} na fila.`);
  }

  const calledCount = room.queue.filter((t) => t.status === "called").length;
  if (calledCount > 0) {
    throw new Error(`Não é possível encerrar: ainda há ${calledCount} em atendimento.`);
  }

  const servedTickets = room.archive.filter((t) => t.status === "served");
  const waitTimes = servedTickets
    .filter((t) => t.calledAt && t.joinedAt)
    .map((t) => (t.calledAt - t.joinedAt) / 60_000);

  const report = {
    id: uuidv4(),
    orgId: room.orgId,
    roomCode: room.code,
    room_code: room.code,
    roomName: room.name,
    room_name: room.name,
    date: new Date().toISOString(),
    openedAt: room.openedAt || new Date().toISOString(),
    closedAt: new Date().toISOString(),
    closed_at: new Date().toISOString(),
    closedBy: actor?.name || "Operador",
    generated_by_name: actor?.name || "Operador",
    totalServed: servedTickets.length,
    total_served: servedTickets.length,
    totalRemovedByHost: room.archive.filter((t) => t.status === "removed_by_host").length,
    totalLeftVoluntarily: room.archive.filter((t) => t.status === "left_voluntarily").length,
    totalAbandonedInQueue: 0,
    total_abandoned: room.archive.filter(
      (t) => t.status === "removed_by_host" || t.status === "left_voluntarily"
    ).length,
    avgWaitMinutes:
      waitTimes.length > 0
        ? parseFloat((waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length).toFixed(1))
        : 0,
    avg_wait_minutes:
      waitTimes.length > 0
        ? parseFloat((waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length).toFixed(1))
        : 0,
    tickets: [...room.archive],
    tickets_data: [...room.archive],
    logs: [...room.logs],
    logs_data: [...room.logs],
  };

  room.active = false;
  room.queue = [];
  logAction(room, actor, "room.closed", { totalServed: report.totalServed });

  // Guarda em memória para retorno imediato
  inMemoryHistory.unshift(report);

  // Persiste PERMANENTEMENTE no PostgreSQL para nunca sumir
  if (pool) {
    pool
      .query(
        `INSERT INTO room_sessions
         (id, org_id, room_code, room_name, opened_at, closed_at, closed_by, closed_by_user_id,
          total_served, total_removed_by_host, total_left_voluntarily, total_abandoned_in_queue,
          avg_wait_minutes, tickets_data, logs_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          report.id,
          report.orgId,
          report.roomCode,
          report.roomName,
          report.openedAt,
          report.closedAt,
          report.closedBy,
          actor?.userId || null,
          report.totalServed,
          report.totalRemovedByHost,
          report.totalLeftVoluntarily,
          report.totalAbandonedInQueue,
          report.avgWaitMinutes,
          JSON.stringify(report.tickets),
          JSON.stringify(report.logs),
        ]
      )
      .catch((err) => {
        console.warn("[roomService] Não foi possível persistir no PostgreSQL (usando memória):", err.message);
      });
  }

  return report;
};

const getHistory = async (orgId) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM room_sessions
       WHERE org_id = $1
       ORDER BY closed_at DESC`,
      [orgId]
    );

    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        orgId: r.org_id,
        roomCode: r.room_code,
        roomName: r.room_name,
        date: r.closed_at,
        openedAt: r.opened_at,
        closedAt: r.closed_at,
        closedBy: r.closed_by,
        totalServed: r.total_served,
        totalRemovedByHost: r.total_removed_by_host,
        totalLeftVoluntarily: r.total_left_voluntarily,
        totalAbandonedInQueue: r.total_abandoned_in_queue,
        avgWaitMinutes: parseFloat(r.avg_wait_minutes) || 0,
        tickets: typeof r.tickets_data === "string" ? JSON.parse(r.tickets_data) : r.tickets_data || [],
        logs: typeof r.logs_data === "string" ? JSON.parse(r.logs_data) : r.logs_data || [],
      }));
    }
  } catch (err) {
    console.warn("[roomService] getHistory DB fallback:", err.message);
  }

  // Fallback para histórico em memória
  return inMemoryHistory
    .filter((h) => !orgId || h.orgId === orgId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
};

const getHistorySession = async (sessionId) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM room_sessions WHERE id = $1`, [sessionId]);
    if (rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        orgId: r.org_id,
        roomCode: r.room_code,
        roomName: r.room_name,
        date: r.closed_at,
        openedAt: r.opened_at,
        closedAt: r.closed_at,
        closedBy: r.closed_by,
        totalServed: r.total_served,
        totalRemovedByHost: r.total_removed_by_host,
        totalLeftVoluntarily: r.total_left_voluntarily,
        totalAbandonedInQueue: r.total_abandoned_in_queue,
        avgWaitMinutes: parseFloat(r.avg_wait_minutes) || 0,
        tickets: typeof r.tickets_data === "string" ? JSON.parse(r.tickets_data) : r.tickets_data || [],
        logs: typeof r.logs_data === "string" ? JSON.parse(r.logs_data) : r.logs_data || [],
      };
    }
  } catch (err) {
    console.warn("[roomService] getHistorySession DB fallback:", err.message);
  }

  return inMemoryHistory.find((h) => h.id === sessionId) ?? null;
};

// ── Guichês ─────────────────────────────────────────────────────

const claimCounter = (room, counterId, socketId, name) => {
  const counter = room.counters.find((c) => c.id === counterId);
  if (!counter) throw new Error("Guichê inválido para esta sala.");
  const current = room.counterClaims[counterId];
  if (current && current.socketId !== socketId) {
    throw new Error(`O guichê "${counter.name}" já está em uso por ${current.name}.`);
  }
  for (const [id, claim] of Object.entries(room.counterClaims)) {
    if (claim.socketId === socketId && id !== counterId) delete room.counterClaims[id];
  }
  room.counterClaims[counterId] = { socketId, name };
  return { ...room.counterClaims };
};

const releaseCounterBySocket = (room, socketId) => {
  let changed = false;
  for (const [id, claim] of Object.entries(room.counterClaims)) {
    if (claim.socketId === socketId) {
      delete room.counterClaims[id];
      changed = true;
    }
  }
  return changed;
};

module.exports = {
  rooms,
  createRoom,
  getRoom,
  roomExists,
  listActiveRooms,
  recalcPositions,
  closeDay,
  getHistory,
  getHistorySession,
  DEFAULT_COUNTERS,
  DEFAULT_PRIORITY_RULES,
  claimCounter,
  releaseCounterBySocket,
};
