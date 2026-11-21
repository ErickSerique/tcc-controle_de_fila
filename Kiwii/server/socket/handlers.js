/**
 * socket/handlers.js — Kiwii
 * - Autenticação JWT do host e identificação de operadores em org_members.
 * - Suporte a múltiplos guichês simultâneos sem colisão.
 * - Reconexão transparente (ensureStaffActor) para evitar perda de sessão ao abrir abas secundárias (ex: Monitor).
 * - Notificações em tempo real para clientes em fila e rechamadas (recall) instantâneas no celular.
 * - Trancamento/destrancamento de fila em tempo real.
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
    const activeRoomOrError = (roomCode) => {
      const code = norm(roomCode);
      if (!roomExists(code)) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return null;
      }
      return code;
    };

    /**
     * Garante que o operador esteja autenticado e com actor configurado.
     * Caso o socket tenha reconectado em segundo plano, recupera os dados
     * automaticamente para não travar a interface pedindo F5.
     */
    const ensureStaffActor = async (roomCode) => {
      if (socket.data.actor) return true;
      const code = norm(roomCode);
      const room = getRoom(code);
      if (!room || !room.orgId) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return false;
      }
      if (socket.data.authenticated && socket.data.user) {
        try {
          const role = await getMemberRole(room.orgId, socket.data.user.id);
          if (role) {
            socket.join(code);
            socket.data.roomCode = code;
            socket.data.actor = {
              userId: socket.data.user.id,
              name: socket.data.profile?.name || socket.data.user.email,
              role,
            };
            if (!socket.data.claimedCounterId && room.counters?.length === 1) {
              socket.data.claimedCounterId = room.counters[0].id;
              socket.data.claimedCounterName = room.counters[0].name;
            }
            return true;
          }
        } catch (err) {
          console.warn("[socket] ensureStaffActor recovery error:", err.message);
        }
      }

      socket.emit("error", { message: "Sessão de operador não iniciada. Recarregue a página." });
      return false;
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

        // Guichê único: reivindica automaticamente se livre
        if (room.counters.length === 1) {
          try {
            claimCounter(room, room.counters[0].id, socket.id, socket.data.actor.name);
            socket.data.claimedCounterId = room.counters[0].id;
            socket.data.claimedCounterName = room.counters[0].name;
            broadcastCounters(io, code, room);
          } catch {
            const currentClaim = room.counterClaims[room.counters[0].id];
            socket.emit("counter_occupied", {
              roomCode: code,
              counterName: room.counters[0].name,
              occupiedBy: currentClaim?.name || "outro operador",
              message: `O guichê "${room.counters[0].name}" já está sendo operado por ${currentClaim?.name || "outro operador"}. Você está em modo somente visualização.`,
            });
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

    socket.on("host:claim_counter", async ({ roomCode, counterId }) => {
      if (!(await ensureStaffActor(roomCode))) return;
      const code = norm(roomCode);
      const room = getRoom(code);
      if (!room) return;
      try {
        claimCounter(room, counterId, socket.id, socket.data.actor.name);
        socket.data.claimedCounterId = counterId;
        const c = room.counters.find((x) => x.id === counterId);
        socket.data.claimedCounterName = c?.name || "Guichê";
        broadcastCounters(io, code, room);
        socket.emit("counter_claimed", { counterId, counterName: socket.data.claimedCounterName });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── MONITOR / TV ─────────────────────────────────────────────
    socket.on("monitor:join", ({ roomCode }) => {
      const code = norm(roomCode);
      const room = getRoom(code);
      if (!room || !room.active) return;
      socket.join(code);
      socket.emit("queue_update", { roomCode: code, queue: getQueue(code) });
      socket.emit("archive_update", { roomCode: code, archive: getArchive(code) });
      socket.emit("room_status", { roomCode: code, locked: !!room.locked });
    });

    // ── CLIENTE: entra na sala e assina seu ticket ───────────────
    socket.on("client:join", ({ roomCode, token }) => {
      const code = norm(roomCode);
      if (!roomExists(code)) return;
      socket.join(code);
      if (token) socket.join(token); // canal direto para a senha do cliente
      socket.data.token = token;
      socket.data.roomCode = code;

      const queue = getQueue(code);
      let myTicket = queue.find((t) => t.token === token);
      if (!myTicket) myTicket = getArchive(code).find((t) => t.token === token);
      if (myTicket) {
        socket.emit("ticket_status", { ticket: myTicket });
        if (myTicket.status === "called") {
          socket.emit("ticket_called", {
            roomCode: code,
            token: myTicket.token,
            ticket: myTicket,
            counter: myTicket.counter,
          });
          if (myTicket.isRecall) {
            socket.emit("ticket_recalled", {
              roomCode: code,
              token: myTicket.token,
              ticket: myTicket,
              counterName: myTicket.counter,
              category: myTicket.category,
            });
          }
        }
      }
    });

    socket.on("client:leave", ({ roomCode, token }) => {
      const code = norm(roomCode);
      if (!roomExists(code)) return;
      try {
        const updated = leaveQueue(code, token);
        io.to(code).emit("queue_update", { roomCode: code, queue: updated });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_left", { roomCode: code, token });
        io.to(token).emit("ticket_left", { roomCode: code, token });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── CHAMADAS DE STAFF ────────────────────────────────────────
    socket.on("host:call_next", async ({ roomCode }) => {
      if (!(await ensureStaffActor(roomCode))) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;

      const room = getRoom(code);
      if (room && room.counters.length === 1) {
        const claim = room.counterClaims[room.counters[0].id];
        if (claim && claim.socketId !== socket.id) {
          return socket.emit("error", {
            message: `O guichê desta sala está em uso por ${claim.name}. Você não pode chamar clientes sem um guichê próprio.`,
          });
        }
      }

      const counter = socket.data.claimedCounterName || (room?.counters[0]?.name);
      if (!counter)
        return socket.emit("error", { message: "Escolha um guichê antes de chamar o próximo." });

      const called = callNext(code, counter);
      if (!called) return socket.emit("queue_empty", { roomCode: code });
      io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
      io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
      io.to(code).emit("ticket_called", { roomCode: code, token: called.token, ticket: called, counter });
      io.to(called.token).emit("ticket_called", { roomCode: code, token: called.token, ticket: called, counter });
      io.to(code).emit("ticket_status", { roomCode: code, token: called.token, ticket: called });
    });

    socket.on("host:call_specific", async ({ roomCode, token }) => {
      if (!(await ensureStaffActor(roomCode))) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;

      const room = getRoom(code);
      if (room && room.counters.length === 1) {
        const claim = room.counterClaims[room.counters[0].id];
        if (claim && claim.socketId !== socket.id) {
          return socket.emit("error", {
            message: `O guichê desta sala está em uso por ${claim.name}. Você não pode chamar clientes sem um guichê próprio.`,
          });
        }
      }

      const counter = socket.data.claimedCounterName || (room?.counters[0]?.name);
      if (!counter) return socket.emit("error", { message: "Escolha um guichê antes de chamar." });
      try {
        const called = callSpecific(code, token, counter);
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_called", { roomCode: code, token: called.token, ticket: called, counter });
        io.to(token).emit("ticket_called", { roomCode: code, token: called.token, ticket: called, counter });
        io.to(code).emit("ticket_status", { roomCode: code, token: called.token, ticket: called });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("host:confirm_served", async ({ roomCode, token }) => {
      if (!(await ensureStaffActor(roomCode))) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      try {
        const served = confirmServed(code, token, { actor: socket.data.actor });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_served", { roomCode: code, token, ticket: served });
        io.to(token).emit("ticket_served", { roomCode: code, token, ticket: served });
        io.to(code).emit("ticket_status", { roomCode: code, token, ticket: served });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("host:remove", async ({ roomCode, token }) => {
      if (!(await ensureStaffActor(roomCode))) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      try {
        const updated = removeTicket(code, token, { actor: socket.data.actor });
        io.to(code).emit("queue_update", { roomCode: code, queue: updated });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        io.to(code).emit("ticket_removed", { roomCode: code, token });
        io.to(token).emit("ticket_removed", { roomCode: code, token });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("host:recall", async ({ roomCode, token, mode, category }) => {
      if (!(await ensureStaffActor(roomCode))) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;

      const room = getRoom(code);
      if (mode === "counter" && room && room.counters.length === 1) {
        const claim = room.counterClaims[room.counters[0].id];
        if (claim && claim.socketId !== socket.id) {
          return socket.emit("error", {
            message: `O guichê desta sala está em uso por ${claim.name}. Você não pode chamar clientes sem um guichê próprio.`,
          });
        }
      }

      const counter = socket.data.claimedCounterName || (room?.counters[0]?.name);
      if (mode === "counter" && !counter)
        return socket.emit("error", { message: "Escolha um guichê antes de chamar." });
      try {
        const { ticket } = recallTicket(code, token, { mode, counter, category, actor: socket.data.actor });
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
        io.to(code).emit("archive_update", { roomCode: code, archive: getArchive(code) });
        if (mode === "counter") {
          io.to(code).emit("ticket_called", { roomCode: code, token, ticket, counter: ticket.counter });
          io.to(code).emit("ticket_recalled", {
            roomCode: code,
            token,
            ticket,
            counterName: ticket.counter,
            category: ticket.category,
          });
          io.to(token).emit("ticket_recalled", {
            roomCode: code,
            token,
            ticket,
            counterName: ticket.counter,
            category: ticket.category,
          });
        }
        io.to(code).emit("ticket_status", { roomCode: code, token, ticket });
        io.to(token).emit("ticket_status", { roomCode: code, token, ticket });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("host:toggle_lock", async ({ roomCode, locked }) => {
      if (!(await ensureStaffActor(roomCode))) return;
      const code = norm(roomCode);
      const room = getRoom(code);
      if (!room) return socket.emit("error", { message: "Sala não encontrada." });
      room.locked = !!locked;
      broadcastRoomStatus(io, code, room);
    });

    socket.on("host:add_manual", async ({ roomCode, name, category, customData }) => {
      if (!(await ensureStaffActor(roomCode))) return;
      const code = activeRoomOrError(roomCode);
      if (!code) return;
      try {
        const ticket = joinQueue(code, {
          name,
          category,
          customData,
          manual: true,
          actor: socket.data.actor,
        });
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
        socket.emit("manual_added", { ticket });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
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
