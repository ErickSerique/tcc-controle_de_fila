/**
 * roomService.js — store em memória (Map); substitua por Redis + PostgreSQL em produção.
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
 * E média (2) esperando, intercala em blocos de X (X altas, X médias, repete).
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
  if (!orgId) throw new Error("Toda sala precisa pertencer a uma organização.");
  const code = generateCode();
  const room = {
    code,
    orgId,
    name,
    hostId,
    categories,
    counters: counters?.length ? counters : DEFAULT_COUNTERS,
    customFields: customFields || [],
    priorityRule: {
      batchSize: Number.isInteger(priorityBatchSize)
        ? priorityBatchSize
        : DEFAULT_PRIORITY_BATCH_SIZE,
    },
    locked: false,
    counterClaims: {},
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
    priorityBatchSize: room.priorityRule.batchSize,
  });
  return room;
};

const getRoom = (code) => rooms.get(code?.toUpperCase()) ?? null;

const roomExists = (code) => {
  const r = rooms.get(code?.toUpperCase());
  return Boolean(r && r.active);
};

/** Salas ativas de uma organização (para o funcionário entrar como guichê). */
const listActiveRooms = (orgId) =>
  [...rooms.values()]
    .filter((r) => r.active && r.orgId === orgId)
    .map((r) => ({
      code: r.code,
      name: r.name,
      counters: r.counters,
      customFields: r.customFields,
      categories: r.categories,
      priorityRule: r.priorityRule,
      orgId: r.orgId,
      locked: !!r.locked,
      queueLength: r.queue.length,
      counterClaims: Object.fromEntries(
        Object.entries(r.counterClaims).map(([id, c]) => [id, { name: c.name }])
      ),
    }));

/** Só encerra com fila vazia E sem atendimentos "called" pendentes de confirmação. */
const closeDay = (code, actor) => {
  const room = rooms.get(code?.toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");
  if (!room.active) throw new Error("Sala já encerrada.");

  const stillCalled = room.archive.filter((t) => t.status === "called").length;
  const stillWaiting = room.queue.length;
  if (stillWaiting > 0 || stillCalled > 0) {
    const parts = [];
    if (stillWaiting > 0) parts.push(`${stillWaiting} na fila`);
    if (stillCalled > 0) parts.push(`${stillCalled} em atendimento`);
    throw new Error(
      `Não é possível encerrar: ainda há ${parts.join(" e ")}. Atenda ou remova todos antes de encerrar o dia.`
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
