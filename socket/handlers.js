const { callNext, removeTicket, changePriority, getQueue, joinQueue } = require("../services/queueService");
const { roomExists } = require("../services/roomService");

/**
 * handlers.js — todos os eventos Socket.io em tempo real.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Eventos recebidos do HOST                                  │
 * │  host:join        { roomCode }                              │
 * │  host:call_next   { roomCode }                              │
 * │  host:remove      { roomCode, token }                       │
 * │  host:priority    { roomCode, token, priority }             │
 * │  host:add_manual  { roomCode, name, category }              │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Eventos recebidos do CLIENTE                               │
 * │  client:join      { roomCode, token }                       │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Eventos emitidos para a SALA (broadcast)                   │
 * │  queue_update     { roomCode, queue }                       │
 * │  ticket_called    { roomCode, token, ticket }               │
 * │  queue_empty      { roomCode }                              │
 * │  room_closed      { roomCode }                              │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Todos os handlers validam o roomCode antes de executar.
 * Latência alvo: <200ms (mesma região).
 */
const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log(`[ws] +connect  ${socket.id}`);

    // ── HOST: entra no canal da sala ───────────────────────────
    socket.on("host:join", ({ roomCode }) => {
      if (!roomExists(roomCode)) {
        socket.emit("error", { message: "Sala não encontrada." });
        return;
      }
      socket.join(roomCode);
      console.log(`[ws] host ${socket.id} → room ${roomCode}`);

      // Envia estado atual da fila ao host que acabou de conectar
      socket.emit("queue_update", { roomCode, queue: getQueue(roomCode) });
    });

    // ── CLIENTE: entra no canal da sala com seu token ──────────
    socket.on("client:join", ({ roomCode, token }) => {
      if (!roomExists(roomCode)) return;
      socket.join(roomCode);
      socket.data.token = token;
      socket.data.roomCode = roomCode;

      // Envia posição atual do ticket ao cliente
      const queue = getQueue(roomCode);
      const myTicket = queue.find((t) => t.token === token);
      if (myTicket) socket.emit("ticket_status", { ticket: myTicket });
    });

    // ── HOST: chama o próximo ──────────────────────────────────
    socket.on("host:call_next", ({ roomCode }) => {
      if (!roomExists(roomCode)) return;

      const called = callNext(roomCode);

      if (!called) {
        socket.emit("queue_empty", { roomCode });
        return;
      }

      // Atualiza fila para todos na sala
      io.to(roomCode).emit("queue_update", { roomCode, queue: getQueue(roomCode) });

      // Notifica o cliente específico que foi chamado
      io.to(roomCode).emit("ticket_called", {
        roomCode,
        token: called.token,
        ticket: called,
      });

      console.log(`[ws] room ${roomCode}: chamou ${called.name} (${called.token.slice(-8)})`);
    });

    // ── HOST: remove ticket da fila ────────────────────────────
    socket.on("host:remove", ({ roomCode, token }) => {
      if (!roomExists(roomCode)) return;
      try {
        const updated = removeTicket(roomCode, token);
        io.to(roomCode).emit("queue_update", { roomCode, queue: updated });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: altera prioridade de um ticket ───────────────────
    socket.on("host:priority", ({ roomCode, token, priority }) => {
      if (!roomExists(roomCode)) return;
      try {
        const updated = changePriority(roomCode, token, priority);
        io.to(roomCode).emit("queue_update", { roomCode, queue: updated });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: adiciona cliente manualmente ─────────────────────
    socket.on("host:add_manual", ({ roomCode, name, category }) => {
      if (!roomExists(roomCode)) return;
      try {
        joinQueue(roomCode, { name, category, manual: true });
        io.to(roomCode).emit("queue_update", { roomCode, queue: getQueue(roomCode) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── Disconnect ─────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`[ws] -disconnect ${socket.id} (${reason})`);
    });
  });
};

module.exports = registerSocketHandlers;
