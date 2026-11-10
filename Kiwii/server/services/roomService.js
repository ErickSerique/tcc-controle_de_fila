/**
 * roomService.js — Gerenciador de salas de atendimento.
 *
 * room.orgId → organização dona · room.queue → aguardando · room.archive → todos que já
 * saíram da fila · room.logs → auditoria · room.counters → guichês · room.customFields
 * room.priorityRule → { batchSize } · room.locked → fila trancada
 * room.counterClaims → { [counterId]: { socketId, name } } quem opera cada guichê
 */
const { v4: uuidv4 } = require("uuid");
const { logAction } = require("./logService");

const rooms = new Map();
const history = [];

const DEFAULT_COUNTERS = [{ id: "default", name: "Guichê Único" }];
const DEFAULT_PRIORITY_BATCH_SIZE = 3;

const generateCode = () => {
  let code;
  do {
    code = Math.random().toString(36).substr(2, 6).toUpperCase();
  } while (rooms.has(code));
  return code;
};

/**
 * Padrão: prioridade DESC → FIFO. Com priorityRule.batchSize (X) > 0 e prioridade alta (3)
 * e média (2) esperando, intercala em blocos de X (X altas, X médias, repete).
 * Prioridade baixa (1) segue por último.
 */
const recalcPositions = (queue, priorityRule) => {
  const batchSize = priorityRule?.batchSize > 0 ? priorityRule.batchSize : 0;
  const byPriority = (p) =>
    queue.filter((t) => t.priority === p).sort((a, b) => a.joinedAt - b.joinedAt);
  const high = byPriority(3),
    medium = byPriority(2),
    low = byPriority(1);

  let ordered;
  if (batchSize > 0 && high.length > 0 && medium.length > 0) {
    ordered = [];
    const hi = [...high],
      med = [...medium];
    while (hi.length || med.length) {
      ordered.push(...hi.splice(0, batchSize));
      ordered.push(...med.splice(0, batchSize));
    }
    ordered.push(...low);
  } else {
    ordered = [...high, ...medium, ...low];
  }

  queue.length = 0; // mantém a referência do array
  queue.push(...ordered);

  let accumulated = 0;
  queue.forEach((ticket, i) => {
    ticket.position = i + 1;
    ticket.estimatedWait = accumulated;
    accumulated += ticket.tma;
  });
  return queue;
};

const createRoom = ({
  name,
  orgId,
  hostId,
  categories,
  counters,
  customFields,
  priorityBatchSize,
  actor,
}) => {
  const code = generateCode();
  const room = {
    code,
    name: name?.trim() || `Sala ${code}`,
    orgId: orgId ?? null,
    hostId: hostId ?? null,
    active: true,
    locked: false,
    categories: categories || [
      { name: "Atendimento Geral", priority: 1, tma: 10 },
      { name: "Prioritário", priority: 3, tma: 5 },
    ],
    counters:
      Array.isArray(counters) && counters.length > 0
        ? counters
        : DEFAULT_COUNTERS.map((c) => ({ ...c })),
    customFields: Array.isArray(customFields) ? customFields : [],
    priorityRule: {
      batchSize:
        typeof priorityBatchSize === "number" && priorityBatchSize >= 0
          ? priorityBatchSize
          : DEFAULT_PRIORITY_BATCH_SIZE,
    },
    counterClaims: {},
    queue: [],
    archive: [],
    logs: [],
    createdAt: Date.now(),
  };

  rooms.set(code, room);
  logAction(room, actor, "room.created", { name: room.name, orgId: room.orgId });
  return room;
};

const getRoom = (code) => {
  if (!code) return null;
  return rooms.get(code.toString().trim().toUpperCase()) ?? null;
};

const roomExists = (code) => {
  if (!code) return false;
  const room = rooms.get(code.toString().trim().toUpperCase());
  return !!room && room.active;
};

const listActiveRooms = (orgId) => {
  const list = [];
  for (const room of rooms.values()) {
    if (room.active && (!orgId || room.orgId === orgId)) {
      list.push({
        code: room.code,
        name: room.name,
        orgId: room.orgId,
        counters: room.counters,
        queueLength: room.queue.length,
        createdAt: room.createdAt,
        locked: !!room.locked,
      });
    }
  }
  return list;
};

/**
 * Encerra o dia: valida se a fila e os atendimentos estão zerados antes de fechar.
 */
const closeDay = (code, actor) => {
  const room = getRoom(code);
  if (!room) throw new Error("Sala não encontrada.");
  if (!room.active) throw new Error("Sala já encerrada.");

  const waitingCount = room.queue.filter((t) => t.status === "waiting").length;
  if (waitingCount > 0) {
    throw new Error(
      `Não é possível encerrar: ainda há ${waitingCount} na fila. Atenda ou remova todos antes de fechar.`
    );
  }

  const calledCount = room.queue.filter((t) => t.status === "called").length;
  if (calledCount > 0) {
    throw new Error(
      `Não é possível encerrar: ainda há ${calledCount} em atendimento. Finalize os atendimentos antes de fechar.`
    );
  }

  const servedTickets = room.archive.filter((t) => t.status === "served");
  const waitTimes = servedTickets
    .filter((t) => t.calledAt && t.joinedAt)
    .map((t) => (t.calledAt - t.joinedAt) / 60_000);

  const report = {
    id: uuidv4(),
    orgId: room.orgId,
    roomCode: room.code,
    roomName: room.name,
    date: new Date().toISOString(),
    totalServed: servedTickets.length,
    totalRemovedByHost: room.archive.filter((t) => t.status === "removed_by_host").length,
    totalLeftVoluntarily: room.archive.filter((t) => t.status === "left_voluntarily").length,
    totalAbandonedInQueue: 0,
    avgWaitMinutes:
      waitTimes.length > 0
        ? parseFloat((waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length).toFixed(1))
        : 0,
    tickets: [...room.archive],
  };

  room.active = false;
  room.queue = [];
  logAction(room, actor, "room.closed", { totalServed: report.totalServed });
  history.push(report);
  return report;
};

const getHistory = (orgId) =>
  history
    .filter((h) => !orgId || h.orgId === orgId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

const getHistorySession = (sessionId) => history.find((h) => h.id === sessionId) ?? null;

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
  DEFAULT_PRIORITY_BATCH_SIZE,
  claimCounter,
  releaseCounterBySocket,
};
