/**
 * socket/handlers.js — Kiwii
 * - io.use verifica o token Supabase/local (enviado por connectWithAuth) e popula socket.data.
 *   Sem token = anônimo (clientes da fila).
 * - host:join NÃO aceita actorName/actorRole do cliente: o cargo vem de org_members.
 * - host:claim_counter: cada funcionário reivindica um guichê real (sem colisão). As chamadas
 *   usam o guichê reivindicado pelo próprio socket, nunca um valor do payload.
 * - host:toggle_lock: tranca/destranca novas entradas.
 * - Eventos de staff exigem um host:join bem-sucedido (socket.data.actor).
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
      socket.data.authenticated = false;
    }
    next();
  });

  io.on("connection", (socket) => {
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

        socket.join(code);
        socket.data.roomCode = code;
        socket.data.actor = {
          userId: socket.data.user.id,
          name: socket.data.profile?.name || socket.data.user.email,
          role,
        };

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

    socket.on("host:call_next", ({ roomCode }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      const counter = socket.data.claimedCounterName;
      if (!counter)
        return socket.emit("error", { message: "Escolha um guichê antes de chamar o próximo." });
      const called = callNext(code, counter);
      if (!called) return socket.emit("queue_empty", { roomCode: code });
      io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
      io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      io.to(code).emit("ticket_called", { roomCode: code, token: called.token, ticket: called });
      io.to(code).emit("ticket_status", { roomCode: code, token: called.token, ticket: called });
    });

    socket.on("host:call_specific", ({ roomCode, token }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      const counter = socket.data.claimedCounterName;
      if (!counter) return socket.emit("error", { message: "Escolha um guichê antes de chamar." });
      try {
        const called = callSpecific(code, token, counter);
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_called", { roomCode: code, token: called.token, ticket: called });
        io.to(code).emit("ticket_status", { roomCode: code, token: called.token, ticket: called });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("host:confirm_served", ({ roomCode, token }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      try {
        const served = confirmServed(code, token, { actor: socket.data.actor });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_served", { roomCode: code, token, ticket: served });
        io.to(code).emit("ticket_status", { roomCode: code, token, ticket: served });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("host:remove", ({ roomCode, token }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      try {
        const updated = removeTicket(code, token, socket.data.actor);
        io.to(code).emit("queue_update", { roomCode: code, queue: updated });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_removed", { roomCode: code, token });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("host:priority", ({ roomCode, token, priority }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      try {
        io.to(code).emit("queue_update", {
          roomCode: code,
          queue: changePriority(code, token, priority),
        });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("host:add_manual", ({ roomCode, name, category, customData }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      try {
        joinQueue(code, { name, category, manual: true, customData: customData || {} });
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("host:recall", ({ roomCode, token, mode }) => {
      if (!requireStaffJoined()) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      const counter = socket.data.claimedCounterName;
      if (mode === "counter" && !counter)
        return socket.emit("error", { message: "Escolha um guichê antes de chamar." });
      try {
        const { ticket } = recallTicket(code, token, { mode, counter, actor: socket.data.actor });
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        if (mode === "counter") {
          io.to(code).emit("ticket_called", { roomCode: code, token, ticket });
          io.to(code).emit("ticket_recalled", { roomCode: code, token, ticket });
        }
        io.to(code).emit("ticket_status", { roomCode: code, token, ticket });
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
