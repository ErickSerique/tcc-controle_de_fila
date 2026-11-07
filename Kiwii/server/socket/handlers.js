/**
 * socket/handlers.js — Kiwii
<<<<<<< Updated upstream
 *
 * Registra todos os manipuladores de eventos em tempo real via Socket.io.
=======
 * - io.use verifica o token Supabase/local (enviado por connectWithAuth) e popula socket.data.
 *   Sem token = anônimo (clientes da fila).
 * - host:join NÃO aceita actorName/actorRole do cliente: o cargo vem de org_members.
 * - host:claim_counter: cada funcionário reivindica um guichê real (sem colisão). As chamadas
 *   usam o guichê reivindicado pelo próprio socket, nunca um valor do payload.
 * - host:toggle_lock: tranca/destranca novas entradas.
 * - Eventos de staff exigem um host:join bem-sucedido (socket.data.actor).
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
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
=======
const {
  roomExists,
  getRoom,
  claimCounter,
  releaseCounterBySocket,
} = require("../services/roomService");
const { verifyToken, getMemberRole } = require("../middleware/auth");

const norm = (c) => c?.toString().trim().toUpperCase();

const broadcastCounters = (io, code, room) =>
  io.to(code).emit("counters_update", { roomCode: code, counterClaims: publicClaims(room) });

const broadcastRoomStatus = (io, code, room) =>
  io.to(code).emit("room_status", { roomCode: code, locked: !!room.locked });

/** Não expõe socketId aos clientes — só quem ocupa cada guichê. */
const publicClaims = (room) =>
  Object.fromEntries(
    Object.entries(room.counterClaims || {}).map(([id, c]) => [id, { name: c.name }])
  );

const registerSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.data.authenticated = false;
      return next();
    }
    try {
      const { user, profile } = await verifyToken(token);
      socket.data.user = user;
      socket.data.profile = profile;
      socket.data.authenticated = true;
    } catch {
      socket.data.authenticated = false; // não derruba: o socket também serve clientes anônimos
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(`[ws] +connect  ${socket.id}`);

    const requireStaffJoined = () => {
      if (!socket.data.actor) {
        socket.emit("error", { message: "Sessão de operador não iniciada. Recarregue a página." });
        return false;
      }
      return true;
    };

    const activeRoomOrError = (roomCode) => {
      const code = norm(roomCode);
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return null;
      }
      return code;
    };

    // ── HOST: entra no canal com identidade REAL ────────────────
    socket.on("host:join", async ({ roomCode }) => {
      try {
        const code = norm(roomCode);
        const room = getRoom(code);
        if (!room || !room.active)
          return socket.emit("error", { message: "Sala não encontrada ou inativa." });
        if (!socket.data.authenticated)
          return socket.emit("error", { message: "Faça login para operar esta sala." });
        if (!room.orgId)
          return socket.emit("error", { message: "Esta sala não está vinculada a uma organização." });

        const role = await getMemberRole(room.orgId, socket.data.user.id);
        if (!role)
          return socket.emit("error", {
            message: "Você não é membro da organização responsável por esta sala.",
          });
>>>>>>> Stashed changes

        socket.join(code);
        socket.data.roomCode = code;
        socket.data.actor = {
          userId: socket.data.user.id,
          name: socket.data.profile?.name || socket.data.user.email,
          role,
        };
        console.log(`[ws] staff ${socket.id} (${socket.data.actor.name}/${role}) → room ${code}`);

        // Guichê único: reivindica automaticamente
        if (room.counters.length === 1) {
          try {
            claimCounter(room, room.counters[0].id, socket.id, socket.data.actor.name);
            socket.data.claimedCounterId = room.counters[0].id;
            socket.data.claimedCounterName = room.counters[0].name;
            broadcastCounters(io, code, room);
          } catch {
            /* já em uso por outra aba — ok */
          }
        }

        socket.emit("queue_update", { roomCode: code, queue: getQueue(code) });
        socket.emit("archive_update", { roomCode: code, archive: getArchive(code) });
        socket.emit("counters_update", { roomCode: code, counterClaims: publicClaims(room) });
        socket.emit("room_status", { roomCode: code, locked: !!room.locked });
        socket.emit("you_are", {
          actor: socket.data.actor,
          counters: room.counters,
          claimedCounterId: socket.data.claimedCounterId || null,
          claimedCounterName: socket.data.claimedCounterName || null,
        });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("host:claim_counter", ({ roomCode, counterId }) => {
      if (!requireStaffJoined()) return;
      const code = norm(roomCode);
      const room = getRoom(code);
      if (!room) return;
      try {
        claimCounter(room, counterId, socket.id, socket.data.actor.name);
        socket.data.claimedCounterId = counterId;
        socket.data.claimedCounterName = room.counters.find((c) => c.id === counterId)?.name;
        broadcastCounters(io, code, room);
        socket.emit("counter_claimed", {
          counterId,
          counterName: socket.data.claimedCounterName,
        });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("monitor:join", ({ roomCode }) => {
      const code = norm(roomCode);
      const room = getRoom(code);
      if (!room || !room.active) return;
      socket.join(code);
      socket.emit("queue_update", { roomCode: code, queue: getQueue(code) });
      socket.emit("archive_update", { roomCode: code, archive: getArchive(code) });
      socket.emit("room_status", { roomCode: code, locked: !!room.locked });
    });

    socket.on("client:join", ({ roomCode, token }) => {
      const code = norm(roomCode);
      if (!roomExists(code)) return;
      socket.join(code);
      socket.data.token = token;
      socket.data.roomCode = code;
<<<<<<< Updated upstream

      // Procura primeiro na fila ativa (aguardando) e, se não achar, no
      // arquivo do dia (chamado/atendido/removido/saiu). Sem isso, um
      // cliente que reconecta (ex: F5) depois de já ter sido chamado
      // nunca recebe seu status real, porque nesse ponto o ticket já
      // saiu de `queue` e só existe em `archive`.
=======
>>>>>>> Stashed changes
      const queue = getQueue(code);
      let myTicket = queue.find((t) => t.token === token);
      if (!myTicket) myTicket = getArchive(code).find((t) => t.token === token);
      if (myTicket) socket.emit("ticket_status", { ticket: myTicket });
    });

    socket.on("client:leave", ({ roomCode, token }) => {
      const code = norm(roomCode);
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

<<<<<<< Updated upstream
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
=======
    socket.on("host:call_next", ({ roomCode }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      const counter = socket.data.claimedCounterName;
      if (!counter)
        return socket.emit("error", { message: "Escolha um guichê antes de chamar o próximo." });
      const called = callNext(code, { counter, actor: socket.data.actor });
      if (!called) return socket.emit("queue_empty", { roomCode: code });
>>>>>>> Stashed changes
      io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
      io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      io.to(code).emit("ticket_called", { roomCode: code, token: called.token, ticket: called });
    });

<<<<<<< Updated upstream
    // ── HOST: chama ticket específico (fora de ordem) ───────────────
    socket.on("host:call_specific", ({ roomCode, token, counter }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
=======
    socket.on("host:call_specific", ({ roomCode, token }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      const counter = socket.data.claimedCounterName;
      if (!counter) return socket.emit("error", { message: "Escolha um guichê antes de chamar." });
>>>>>>> Stashed changes
      try {
        const called = callSpecific(code, token, { counter, actor: socket.data.actor });
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_called", { roomCode: code, token: called.token, ticket: called });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

<<<<<<< Updated upstream
    // ── HOST: confirma atendimento concluído no guichê ──────────────
    socket.on("host:confirm_served", ({ roomCode, token }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
=======
    socket.on("host:confirm_served", ({ roomCode, token }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
>>>>>>> Stashed changes
      try {
        confirmServed(code, token, { actor: socket.data.actor });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

<<<<<<< Updated upstream
    // ── HOST: remove ticket da fila ──────────────────────────────────
    socket.on("host:remove", ({ roomCode, token }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
=======
    socket.on("host:remove", ({ roomCode, token }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
>>>>>>> Stashed changes
      try {
        const updated = removeTicket(code, token, { actor: socket.data.actor });
        io.to(code).emit("queue_update", { roomCode: code, queue: updated });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

<<<<<<< Updated upstream
    // ── HOST: altera prioridade de um ticket ─────────────────────────
    socket.on("host:priority", ({ roomCode, token, priority }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
=======
    socket.on("host:priority", ({ roomCode, token, priority }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
>>>>>>> Stashed changes
      try {
        io.to(code).emit("queue_update", {
          roomCode: code,
          queue: changePriority(code, token, priority),
        });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

<<<<<<< Updated upstream
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
=======
    socket.on("host:add_manual", ({ roomCode, name, category, customData }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      try {
        joinQueue(code, { name, category, manual: true, customData: customData || {} });
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
>>>>>>> Stashed changes
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

<<<<<<< Updated upstream
    // ── HOST: recall unificado — chama de volta um ticket já arquivado ──
    socket.on("host:recall", ({ roomCode, token, mode, counter }) => {
      const code = roomCode?.toString().trim().toUpperCase();
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }
      socket.join(code);
=======
    socket.on("host:recall", ({ roomCode, token, mode }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      const counter = socket.data.claimedCounterName;
      if (mode === "counter" && !counter)
        return socket.emit("error", { message: "Escolha um guichê antes de chamar." });
>>>>>>> Stashed changes
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

    socket.on("host:toggle_lock", ({ roomCode, locked }) => {
      if (!requireStaffJoined()) return;
      const code = norm(roomCode);
      const room = getRoom(code);
      if (!room) return socket.emit("error", { message: "Sala não encontrada." });
      room.locked = !!locked;
      broadcastRoomStatus(io, code, room);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[ws] -disconnect ${socket.id} (${reason})`);
      if (socket.data.roomCode && socket.data.claimedCounterId) {
        const room = getRoom(socket.data.roomCode);
        if (room && releaseCounterBySocket(room, socket.id)) {
          broadcastCounters(io, socket.data.roomCode, room);
        }
      }
    });
  });
};

module.exports = registerSocketHandlers;
