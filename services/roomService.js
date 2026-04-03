/**
 * roomService.js
 *
 * Store em memória (Map) — substitua por Redis + PostgreSQL em produção.
 *
 * Esquema Redis sugerido:
 *   room:{code}           → Hash  (metadados da sala)
 *   room:{code}:queue     → ZSet  (score = priority*1e12 - joinedAt, para ordenação)
 *   room:{code}:called    → List  (tickets atendidos, append-only)
 *
 * Esquema PostgreSQL sugerido (histórico):
 *   sessions(id, room_code, room_name, opened_at, closed_at)
 *   tickets(id, session_id, token, name, category, priority,
 *           tma, status, joined_at, called_at)
 */

const { v4: uuidv4 } = require("uuid");

// ── In-memory store ────────────────────────────────────────────
const rooms = new Map();   // code → room object
const history = [];        // closed session reports

// ── Helpers ────────────────────────────────────────────────────

/** Gera código alfanumérico único de 6 caracteres. */
const generateCode = () => {
  let code;
  do {
    code = Math.random().toString(36).substr(2, 6).toUpperCase();
  } while (rooms.has(code));
  return code;
};

/**
 * Algoritmo de fila priorizada com previsão de espera.
 *
 *   Ordenação: prioridade DESC → joinedAt ASC (FIFO dentro da mesma prioridade)
 *
 *   Tempo estimado de espera para ticket i:
 *     T_est(i) = Σ TMA(j)  para todo j com position < i
 *
 * Complexidade: O(n log n) — aceitável para filas de até ~10.000 tickets.
 */
const recalcPositions = (queue) => {
  queue.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.joinedAt - b.joinedAt;
  });

  let accumulated = 0;
  queue.forEach((ticket, i) => {
    ticket.position = i + 1;
    ticket.estimatedWait = accumulated; // minutos
    accumulated += ticket.tma;
  });

  return queue;
};

// ── Service API ────────────────────────────────────────────────

const createRoom = ({ name, hostId, categories }) => {
  const code = generateCode();
  const room = {
    code,
    name,
    hostId,
    categories,   // [{ name, priority: 1|2|3, tma: number }]
    queue: [],
    called: [],
    createdAt: Date.now(),
    active: true,
  };
  rooms.set(code, room);
  return room;
};

const getRoom = (code) => rooms.get(code?.toUpperCase()) ?? null;

const roomExists = (code) => {
  const r = rooms.get(code?.toUpperCase());
  return Boolean(r && r.active);
};

/**
 * Encerra o dia: congela a fila, gera relatório e arquiva.
 * Retorna o relatório para download.
 */
const closeDay = (code) => {
  const room = rooms.get(code?.toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");
  if (!room.active) throw new Error("Sala já encerrada.");

  const waitTimes = room.called
    .filter((t) => t.calledAt)
    .map((t) => (t.calledAt - t.joinedAt) / 60_000);

  const report = {
    id: uuidv4(),
    roomCode: room.code,
    roomName: room.name,
    date: new Date().toISOString(),
    totalServed: room.called.length,
    totalAbandoned: room.queue.length,
    avgWaitMinutes:
      waitTimes.length > 0
        ? parseFloat((waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length).toFixed(1))
        : 0,
    tickets: [
      ...room.called.map((t) => ({ ...t, status: "served" })),
      ...room.queue.map((t) => ({ ...t, status: "abandoned" })),
    ],
  };

  room.active = false;
  room.queue = [];
  history.push(report);
  return report;
};

const getHistory = () => [...history];

module.exports = {
  rooms,
  createRoom,
  getRoom,
  roomExists,
  recalcPositions,
  closeDay,
  getHistory,
};
