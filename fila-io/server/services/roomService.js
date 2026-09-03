/**
 * roomService.js
 *
 * Store em memória (Map) — substitua por Redis + PostgreSQL em produção.
 *
 * Modelo de sala:
 *   room.queue   → tickets aguardando (status: waiting), reordenados a cada mudança
 *   room.archive → TODOS os tickets que já saíram da fila ativa nesse dia:
 *                  called, served, removed_by_host, left_voluntarily.
 *                  Nunca é limpo durante o dia — é o "registro" completo.
 *   room.logs    → auditoria de ações do staff (quem fez o quê e quando)
 *   room.counters     → guichês/balcões configuráveis pelo host
 *   room.customFields → campos extras exigidos no check-in do cliente
 */
const { v4: uuidv4 } = require("uuid");
const { logAction } = require("./logService");

const rooms = new Map();
const history = [];

const DEFAULT_COUNTERS = [{ id: "default", name: "Guichê Único" }];

// ── Helpers ────────────────────────────────────────────────────

const generateCode = () => {
  let code;
  do {
    code = Math.random().toString(36).substr(2, 6).toUpperCase();
  } while (rooms.has(code));
  return code;
};

/**
 * Algoritmo de fila priorizada com previsão de espera.
 * Ordenação: prioridade DESC → joinedAt ASC (FIFO dentro da mesma prioridade)
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

// ── Service API ────────────────────────────────────────────────

const createRoom = ({ name, hostId, categories, counters, customFields, actor }) => {
  const code = generateCode();
  const room = {
    code,
    name,
    hostId,
    categories,
    counters: counters?.length ? counters : DEFAULT_COUNTERS,
    customFields: customFields || [],
    queue: [],
    archive: [],
    logs: [],
    createdAt: Date.now(),
    active: true,
  };
  rooms.set(code, room);
  logAction(room, actor, "room.created", {
    name,
    categories: categories.length,
    counters: room.counters.length,
  });
  return room;
};

const getRoom = (code) => rooms.get(code?.toUpperCase()) ?? null;

const roomExists = (code) => {
  const r = rooms.get(code?.toUpperCase());
  return Boolean(r && r.active);
};

/**
 * Encerra o dia: congela a fila, gera relatório completo (incluindo
 * atendidos, removidos, que saíram e os que ainda esperavam) e arquiva.
 */
const closeDay = (code, actor) => {
  const room = rooms.get(code?.toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");
  if (!room.active) throw new Error("Sala já encerrada.");

  const servedTickets = room.archive.filter((t) => t.status === "served");
  const waitTimes = servedTickets
    .filter((t) => t.calledAt && t.joinedAt)
    .map((t) => (t.calledAt - t.joinedAt) / 60_000);

  const stillWaiting = room.queue.map((t) => ({
    ...t,
    status: "abandoned_queue_closed",
  }));

  const report = {
    id: uuidv4(),
    roomCode: room.code,
    roomName: room.name,
    date: new Date().toISOString(),
    totalServed: servedTickets.length,
    totalRemovedByHost: room.archive.filter((t) => t.status === "removed_by_host").length,
    totalLeftVoluntarily: room.archive.filter((t) => t.status === "left_voluntarily").length,
    totalAbandonedInQueue: stillWaiting.length,
    avgWaitMinutes:
      waitTimes.length > 0
        ? parseFloat((waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length).toFixed(1))
        : 0,
    tickets: [...room.archive, ...stillWaiting],
  };

  room.active = false;
  room.queue = [];
  logAction(room, actor, "room.closed", { totalServed: report.totalServed });
  history.push(report);
  return report;
};

const getHistory = () =>
  [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

const getHistorySession = (sessionId) =>
  history.find((h) => h.id === sessionId) ?? null;

module.exports = {
  rooms,
  createRoom,
  getRoom,
  roomExists,
  recalcPositions,
  closeDay,
  getHistory,
  getHistorySession,
  DEFAULT_COUNTERS,
};
