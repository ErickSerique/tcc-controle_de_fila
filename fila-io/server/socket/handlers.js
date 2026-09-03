const {
  callNext, callSpecific, confirmServed, removeTicket,
  changePriority, getQueue, joinQueue, leaveQueue, recallTicket, getArchive,
} = require("../services/queueService");
const { roomExists } = require("../services/roomService");

/**
 * handlers.js — todos os eventos Socket.io em tempo real.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  Eventos recebidos do HOST                                       │
 * │  host:join         { roomCode, actorName, actorRole }            │
 * │  host:call_next    { roomCode, counter }                         │
 * │  host:call_specific{ roomCode, token, counter }                  │
 * │  host:confirm_served { roomCode, token }                         │
 * │  host:remove       { roomCode, token }                           │
 * │  host:priority     { roomCode, token, priority }                 │
 * │  host:add_manual   { roomCode, name, category, customData }      │
 * │  host:recall       { roomCode, token, mode, counter }            │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  Eventos recebidos do CLIENTE                                    │
 * │  client:join       { roomCode, token }                           │
 * │  client:leave      { roomCode, token }                           │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  Eventos recebidos do MONITOR (TV externa, somente leitura)      │
 * │  monitor:join      { roomCode }                                  │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  Eventos emitidos para a SALA (broadcast)                        │
 * │  queue_update      { roomCode, queue }                           │
 * │  archive_update    { roomCode, archive }                         │
 * │  ticket_called     { roomCode, token, ticket }                   │
 * │  ticket_left       { roomCode, token }                           │
 * │  queue_empty       { roomCode }                                  │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * A identidade do host (actorName/actorRole) é guardada em socket.data.actor
 * e usada para toda a auditoria (logService) das ações seguintes nesse socket.
 */
const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log(`[ws] +connect  ${socket.id}`);

    // ── HOST: entra no canal da sala, identificando-se ────────────
    socket.on("host:join", ({ roomCode, actorName, actorRole }) => {
      if (!roomExists(roomCode)) {
        socket.emit("error", { message: "Sala não encontrada." });
        return;
      }
      socket.join(roomCode);
      socket.data.actor = { name: actorName || "Operador", role: actorRole || "operator" };
      socket.data.roomCode = roomCode;
      console.log(`[ws] host ${socket.id} (${socket.data.actor.name}/${socket.data.actor.role}) → room ${roomCode}`);

      socket.emit("queue_update", { roomCode, queue: getQueue(roomCode) });
      socket.emit("archive_update", { roomCode, archive: getArchive(roomCode) });
    });

    // ── MONITOR (TV externa): apenas assiste, não realiza ações ───
    socket.on("monitor:join", ({ roomCode }) => {
      if (!roomExists(roomCode)) return;
      socket.join(roomCode);
      socket.emit("queue_update", { roomCode, queue: getQueue(roomCode) });
      socket.emit("archive_update", { roomCode, archive: getArchive(roomCode) });
    });

    // ── CLIENTE: entra no canal com token de ticket ────────────────
    socket.on("client:join", ({ roomCode, token }) => {
      if (!roomExists(roomCode)) return;
      socket.join(roomCode);
      socket.data.token = token;
      socket.data.roomCode = roomCode;

      const queue = getQueue(roomCode);
      const myTicket = queue.find((t) => t.token === token);
      if (myTicket) socket.emit("ticket_status", { ticket: myTicket });
    });

    // ── CLIENTE: sai voluntariamente da fila ────────────────────────
    socket.on("client:leave", ({ roomCode, token }) => {
      if (!roomExists(roomCode)) return;
      try {
        const updated = leaveQueue(roomCode, token);
        io.to(roomCode).emit("queue_update", { roomCode, queue: updated });
        io.to(roomCode).emit("archive_update", { roomCode, archive: getArchive(roomCode) });
        io.to(roomCode).emit("ticket_left", { roomCode, token });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: chama o próximo ───────────────────────────────────────
    socket.on("host:call_next", ({ roomCode, counter }) => {
      if (!roomExists(roomCode)) return;
      const called = callNext(roomCode, { counter, actor: socket.data.actor });
      if (!called) {
        socket.emit("queue_empty", { roomCode });
        return;
      }
      io.to(roomCode).emit("queue_update", { roomCode, queue: getQueue(roomCode) });
      io.to(roomCode).emit("archive_update", { roomCode, archive: getArchive(roomCode) });
      io.to(roomCode).emit("ticket_called", { roomCode, token: called.token, ticket: called });
    });

    // ── HOST: chama ticket específico (fora de ordem) ───────────────
    socket.on("host:call_specific", ({ roomCode, token, counter }) => {
      if (!roomExists(roomCode)) return;
      try {
        const called = callSpecific(roomCode, token, { counter, actor: socket.data.actor });
        io.to(roomCode).emit("queue_update", { roomCode, queue: getQueue(roomCode) });
        io.to(roomCode).emit("archive_update", { roomCode, archive: getArchive(roomCode) });
        io.to(roomCode).emit("ticket_called", { roomCode, token: called.token, ticket: called });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: confirma atendimento concluído no guichê ──────────────
    socket.on("host:confirm_served", ({ roomCode, token }) => {
      if (!roomExists(roomCode)) return;
      try {
        confirmServed(roomCode, token, { actor: socket.data.actor });
        io.to(roomCode).emit("archive_update", { roomCode, archive: getArchive(roomCode) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: remove ticket da fila ──────────────────────────────────
    socket.on("host:remove", ({ roomCode, token }) => {
      if (!roomExists(roomCode)) return;
      try {
        const updated = removeTicket(roomCode, token, { actor: socket.data.actor });
        io.to(roomCode).emit("queue_update", { roomCode, queue: updated });
        io.to(roomCode).emit("archive_update", { roomCode, archive: getArchive(roomCode) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: altera prioridade de um ticket ─────────────────────────
    socket.on("host:priority", ({ roomCode, token, priority }) => {
      if (!roomExists(roomCode)) return;
      try {
        const updated = changePriority(roomCode, token, priority);
        io.to(roomCode).emit("queue_update", { roomCode, queue: updated });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: adiciona cliente manualmente (walk-in sem smartphone) ──
    socket.on("host:add_manual", ({ roomCode, name, category, customData }) => {
      if (!roomExists(roomCode)) return;
      try {
        joinQueue(roomCode, { name, category, manual: true, customData: customData || {} });
        io.to(roomCode).emit("queue_update", { roomCode, queue: getQueue(roomCode) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: recall unificado — chama de volta um ticket já arquivado ──
    socket.on("host:recall", ({ roomCode, token, mode, counter }) => {
      if (!roomExists(roomCode)) return;
      try {
        recallTicket(roomCode, token, { mode, counter, actor: socket.data.actor });
        io.to(roomCode).emit("queue_update", { roomCode, queue: getQueue(roomCode) });
        io.to(roomCode).emit("archive_update", { roomCode, archive: getArchive(roomCode) });

        if (mode === "counter") {
          const ticket = getArchive(roomCode).find((t) => t.token === token);
          io.to(roomCode).emit("ticket_called", { roomCode, token, ticket });
        }
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`[ws] -disconnect ${socket.id} (${reason})`);
    });
  });
};

module.exports = registerSocketHandlers;
