/**
 * socket/handlers.js — Kiwii
 *
 * Registra todos os manipuladores de eventos em tempo real via Socket.io.
 *
 * Autenticação do handshake: conexões SEM token são aceitas normalmente
 * (client:join / monitor:join não exigem login — cliente só precisa do
 * código da sala, o monitor é um display público). Conexões COM token
 * são verificadas (Supabase ou JWT local) e o usuário fica disponível em
 * socket.data.user para quem precisar.
 *
 * Toda ação host:* verifica, a cada chamada (sem cache entre eventos),
 * se o usuário autenticado é membro — com role suficiente — da
 * organização dona da sala em questão. Isso substitui o antigo payload
 * { actorName, actorRole } que o próprio cliente mandava sem nenhuma
 * verificação.
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
const { roomExists, getRoom } = require("../services/roomService");
const { verifyToken, getOrgRole, ROLE_LEVEL } = require("../middleware/auth");

const MIN_HOST_ROLE = "operator";

/**
 * Verifica se o usuário autenticado no socket pode operar a sala `code`.
 * Retorna { userId, name, role } em caso de sucesso, ou null (já tendo
 * emitido "error" no socket) em caso de falha.
 */
const verifyHostAccess = async (socket, code) => {
  if (!socket.data.user) {
    socket.emit("error", { message: "Não autenticado. Faça login para gerenciar uma sala." });
    return null;
  }

  const room = getRoom(code);
  if (!room) {
    socket.emit("error", { message: "Sala não encontrada ou inativa." });
    return null;
  }

  if (!room.orgId) {
    // Não deveria acontecer para salas criadas após esta fase (rooms.js
    // sempre popula orgId), mas protege contra estado inconsistente.
    socket.emit("error", { message: "Sala sem organização associada." });
    return null;
  }

  const role = await getOrgRole(socket.data.user.id, room.orgId);
  if (!role || ROLE_LEVEL[role] < ROLE_LEVEL[MIN_HOST_ROLE]) {
    socket.emit("error", { message: "Você não tem permissão para gerenciar esta sala." });
    return null;
  }

  return {
    userId: socket.data.user.id,
    name: socket.data.profile?.name || socket.data.user.email,
    role,
  };
};

const registerSocketHandlers = (io) => {
  // ── Handshake: verifica o token, se houver, sem bloquear quem não tem ──
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.data.user = null;
      return next();
    }

    try {
      const { user, profile } = await verifyToken(token);
      socket.data.user = user;
      socket.data.profile = profile;
    } catch {
      // Token inválido/expirado: conecta mesmo assim como anônimo —
      // os handlers host:* vão barrar na hora de operar, não aqui.
      socket.data.user = null;
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(`[ws] +connect  ${socket.id}${socket.data.user ? ` (user ${socket.data.user.id})` : ""}`);

    // ── HOST: entra no canal da sala ──────────────────────────────
    socket.on("host:join", async ({ roomCode }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      const actor = await verifyHostAccess(socket, code);
      if (!actor) return;

      socket.join(code);
      socket.data.roomCode = code;
      console.log(`[ws] host ${socket.id} (${actor.name}/${actor.role}) → room ${code}`);

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
    socket.on("host:call_next", async ({ roomCode, counter }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      const actor = await verifyHostAccess(socket, code);
      if (!actor) return;

      socket.join(code);
      const called = callNext(code, { counter, actor });
      if (!called) {
        socket.emit("queue_empty", { roomCode: code });
        return;
      }
      io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
      io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      io.to(code).emit("ticket_called", { roomCode: code, token: called.token, ticket: called });
    });

    // ── HOST: chama ticket específico (fora de ordem) ───────────────
    socket.on("host:call_specific", async ({ roomCode, token, counter }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      const actor = await verifyHostAccess(socket, code);
      if (!actor) return;

      socket.join(code);
      try {
        const called = callSpecific(code, token, { counter, actor });
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_called", { roomCode: code, token: called.token, ticket: called });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: confirma atendimento concluído no guichê ──────────────
    socket.on("host:confirm_served", async ({ roomCode, token }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      const actor = await verifyHostAccess(socket, code);
      if (!actor) return;

      socket.join(code);
      try {
        confirmServed(code, token, { actor });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: remove ticket da fila ──────────────────────────────────
    socket.on("host:remove", async ({ roomCode, token }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      const actor = await verifyHostAccess(socket, code);
      if (!actor) return;

      socket.join(code);
      try {
        const updated = removeTicket(code, token, { actor });
        io.to(code).emit("queue_update", { roomCode: code, queue: updated });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: altera prioridade de um ticket ─────────────────────────
    socket.on("host:priority", async ({ roomCode, token, priority }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      const actor = await verifyHostAccess(socket, code);
      if (!actor) return;

      socket.join(code);
      try {
        const updated = changePriority(code, token, priority);
        io.to(code).emit("queue_update", { roomCode: code, queue: updated });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: adiciona cliente manualmente (walk-in sem smartphone) ──
    socket.on("host:add_manual", async ({ roomCode, name, category, customData }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      const actor = await verifyHostAccess(socket, code);
      if (!actor) return;

      socket.join(code);
      try {
        joinQueue(code, { name, category, manual: true, customData: customData || {} });
        const currentQueue = getQueue(code);
        io.to(code).emit("queue_update", { roomCode: code, queue: currentQueue });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: recall unificado — chama de volta um ticket já arquivado ──
    socket.on("host:recall", async ({ roomCode, token, mode, counter }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      const actor = await verifyHostAccess(socket, code);
      if (!actor) return;

      socket.join(code);
      try {
        recallTicket(code, token, { mode, counter, actor });
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