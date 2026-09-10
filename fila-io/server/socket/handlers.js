/**
 * socket/handlers.js — fila.io v2.0
 *
 * Registra todos os manipuladores de eventos em tempo real via Socket.io.
 */
const {
  joinQueue,
  callNext,
  callSpecific,
  confirmServed,
  removeTicket,
  leaveQueue,
  recallTicket,
  changePriority,
  getQueue,
  getArchive,
} = require("../services/queueService");
const { roomExists } = require("../services/roomService");

const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log(`[ws] +connect  ${socket.id}`);

    // ── HOST: entra no canal da sala, identificando-se ────────────
    socket.on("host:join", ({ roomCode, actorName, actorRole }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
      socket.data.actor = { name: actorName || "Operador", role: actorRole || "operator" };
      socket.data.roomCode = code;
      console.log(`[ws] host ${socket.id} (${socket.data.actor.name}/${socket.data.actor.role}) → room ${code}`);

      socket.emit("queue_update", { roomCode: code, queue: getQueue(code) });
      socket.emit("archive_update", { roomCode: code, archive: getArchive(code) });
    });

    // ── MONITOR (TV externa): apenas assiste, não realiza ações ───
    socket.on("monitor:join", ({ roomCode }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) return;
      socket.join(code);
      socket.emit("queue_update", { roomCode: code, queue: getQueue(code) });
      socket.emit("archive_update", { roomCode: code, archive: getArchive(code) });
    });

    // ── CLIENTE: entra no canal com token de ticket ────────────────
    socket.on("client:join", ({ roomCode, token }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) return;
      socket.join(code);
      socket.data.token = token;
      socket.data.roomCode = code;

      // Procura primeiro na fila ativa (aguardando) e, se não achar, no
      // arquivo do dia (chamado/atendido/removido/saiu). Sem isso, um
      // cliente que reconecta (ex: F5) depois de já ter sido chamado
      // nunca recebe seu status real, porque nesse ponto o ticket já
      // saiu de `queue` e só existe em `archive`.
      const queue = getQueue(code);
      let myTicket = queue.find((t) => t.token === token);
      if (!myTicket) {
        const archive = getArchive(code);
        myTicket = archive.find((t) => t.token === token);
      }
      if (myTicket) socket.emit("ticket_status", { ticket: myTicket });
    });

    // ── CLIENTE: sai voluntariamente da fila ────────────────────────
    socket.on("client:leave", ({ roomCode, token }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) return;
      try {
        const updated = leaveQueue(code, token);
        io.to(code).emit("queue_update", { roomCode: code, queue: updated });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_left", { roomCode: code, token });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: chama o próximo ───────────────────────────────────────
    socket.on("host:call_next", ({ roomCode, counter }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
      const called = callNext(code, { counter, actor: socket.data.actor });
      if (!called) {
        socket.emit("queue_empty", { roomCode: code });
        return;
      }
      io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
      io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      io.to(code).emit("ticket_called", { roomCode: code, token: called.token, ticket: called });
    });

    // ── HOST: chama ticket específico (fora de ordem) ───────────────
    socket.on("host:call_specific", ({ roomCode, token, counter }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
      try {
        const called = callSpecific(code, token, { counter, actor: socket.data.actor });
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_called", { roomCode: code, token: called.token, ticket: called });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: confirma atendimento concluído no guichê ──────────────
    socket.on("host:confirm_served", ({ roomCode, token }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
      try {
        confirmServed(code, token, { actor: socket.data.actor });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: remove ticket da fila ──────────────────────────────────
    socket.on("host:remove", ({ roomCode, token }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
      try {
        const updated = removeTicket(code, token, { actor: socket.data.actor });
        io.to(code).emit("queue_update", { roomCode: code, queue: updated });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: altera prioridade de um ticket ─────────────────────────
    socket.on("host:priority", ({ roomCode, token, priority }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
      try {
        const updated = changePriority(code, token, priority);
        io.to(code).emit("queue_update", { roomCode: code, queue: updated });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: adiciona cliente manualmente (walk-in sem smartphone) ──
    socket.on("host:add_manual", ({ roomCode, name, category, customData }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
      try {
        joinQueue(code, { name, category, manual: true, customData: customData || {} });
        const currentQueue = getQueue(code);
        io.to(code).emit("queue_update", { roomCode: code, queue: currentQueue });
        socket.emit("queue_update", { roomCode: code, queue: currentQueue });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: recall unificado — chama de volta um ticket já arquivado ──
    socket.on("host:recall", ({ roomCode, token, mode, counter }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
      try {
        recallTicket(code, token, { mode, counter, actor: socket.data.actor });
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });

        if (mode === "counter") {
          const ticket = getArchive(code).find((t) => t.token === token);
          io.to(code).emit("ticket_called", { roomCode: code, token, ticket });
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
