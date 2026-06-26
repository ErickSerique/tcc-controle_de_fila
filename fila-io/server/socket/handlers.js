/**
 * socket/handlers.js
 *
 * Todos os eventos Socket.io em tempo real.
 * Atualizado para usar os services assíncronos (Redis + PostgreSQL).
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Eventos recebidos do HOST                                  │
 * │  host:join          { roomCode }                            │
 * │  host:call_next     { roomCode }                            │
 * │  host:call_specific { roomCode, token }                     │
 * │  host:remove        { roomCode, token }                     │
 * │  host:priority      { roomCode, token, priority }           │
 * │  host:add_manual    { roomCode, name, category }            │
 * │  host:confirm_served{ roomCode, token }                     │
 * │  host:readmit       { roomCode, token, name, category }     │
 * │  host:recall_served { roomCode, token }                     │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Eventos recebidos do CLIENTE                               │
 * │  client:join        { roomCode, token }                     │
 * │  client:leave       { roomCode, token }                     │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Eventos emitidos para a SALA (broadcast)                   │
 * │  queue_update       { roomCode, queue }                     │
 * │  ticket_called      { roomCode, token, ticket }             │
 * │  ticket_served      { roomCode, token, ticket }             │
 * │  ticket_removed     { roomCode, token }                     │
 * │  queue_empty        { roomCode }                            │
 * │  room_closed        { roomCode }                            │
 * └─────────────────────────────────────────────────────────────┘
 */
const { callNext, callSpecific, removeTicket, changePriority, getQueue, joinQueue, confirmServed } = require("../services/queueService");
const { pool } = require("../config/db");
const { roomExists } = require("../services/roomService");
const { verifySupabaseToken } = require("../config/db");
const { verifyLocalSession } = require("../middleware/auth");

const registerSocketHandlers = (io) => {

  // ── Middleware de autenticação ─────────────────────────────────
  // Hosts enviam o token no handshake. Clientes (fila) são anônimos.
  // Tenta Supabase primeiro, depois JWT local (fallback offline).
  // Se não houver token, o socket é aceito como anônimo (client-only).
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      // Sem token = cliente anônimo da fila (permitido)
      socket.data.authenticated = false;
      return next();
    }

    // Tentativa 1: Supabase Auth
    try {
      const user = await verifySupabaseToken(token);
      socket.data.authenticated = true;
      socket.data.user = user;
      return next();
    } catch {
      // Supabase falhou — tentar JWT local
    }

    // Tentativa 2: JWT local (sessão offline)
    try {
      const user = verifyLocalSession(token);
      socket.data.authenticated = true;
      socket.data.user = user;
      return next();
    } catch {
      // Ambos falharam — rejeitar
      next(new Error("Token de autenticação inválido."));
    }
  });

  io.on("connection", (socket) => {
    const label = socket.data.authenticated
      ? `${socket.id} (auth: ${socket.data.user.email})`
      : `${socket.id} (anônimo)`;
    console.log(`[ws] +connect  ${label}`);

    // Helper: rejeita evento se socket não for autenticado
    const requireSocketAuth = (eventName) => {
      if (!socket.data.authenticated) {
        socket.emit("error", { message: `Evento ${eventName} requer autenticação.` });
        return false;
      }
      return true;
    };

    // ── HOST: entra no canal da sala ───────────────────────────
    socket.on("host:join", async ({ roomCode }) => {
      try {
        if (!requireSocketAuth("host:join")) return;
        const exists = await roomExists(roomCode);
        if (!exists) {
          socket.emit("error", { message: "Sala não encontrada." });
          return;
        }
        socket.join(roomCode);
        console.log(`[ws] host ${socket.id} → room ${roomCode}`);

        // Envia estado atual ao host
        const queue = await getQueue(roomCode);
        socket.emit("queue_update", { roomCode, queue });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── CLIENTE: entra no canal com token de ticket ────────────
    socket.on("client:join", async ({ roomCode, token }) => {
      try {
        const exists = await roomExists(roomCode);
        if (!exists) return;

        socket.join(roomCode);
        socket.data.token = token;
        socket.data.roomCode = roomCode;

        // Envia posição atual ao cliente
        const queue = await getQueue(roomCode);
        const myTicket = queue.find((t) => t.token === token);
        if (myTicket) socket.emit("ticket_status", { ticket: myTicket });
      } catch (err) {
        console.error("[ws] client:join:", err.message);
      }
    });

    // ── CLIENTE: sai voluntariamente da fila ───────────────────
    socket.on("client:leave", async ({ roomCode, token }) => {
      try {
        const exists = await roomExists(roomCode);
        if (!exists) return;

        const updated = await removeTicket(roomCode, token);
        io.to(roomCode).emit("queue_update", { roomCode, queue: updated });
        // Notifica que o ticket foi removido (o próprio cliente pode ouvir)
        io.to(roomCode).emit("ticket_removed", { roomCode, token });
        console.log(`[ws] room ${roomCode}: cliente saiu voluntariamente (${token.slice(-8)})`);
      } catch (err) {
        // Pode falhar se o ticket já foi chamado — não é crítico
        console.error("[ws] client:leave:", err.message);
      }
    });

    // ── HOST: chama o próximo ──────────────────────────────────
    socket.on("host:call_next", async ({ roomCode }) => {
      try {
        if (!requireSocketAuth("host:call_next")) return;
        const exists = await roomExists(roomCode);
        if (!exists) return;

        const called = await callNext(roomCode);

        if (!called) {
          socket.emit("queue_empty", { roomCode });
          return;
        }

        // Atualiza fila para todos na sala
        const queue = await getQueue(roomCode);
        io.to(roomCode).emit("queue_update", { roomCode, queue });

        // Notifica o cliente específico que foi chamado
        io.to(roomCode).emit("ticket_called", {
          roomCode,
          token: called.token,
          ticket: called,
        });

        console.log(`[ws] room ${roomCode}: chamou ${called.name} (${called.token.slice(-8)})`);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: chama um ticket específico ──────────────────────────
    socket.on("host:call_specific", async ({ roomCode, token }) => {
      try {
        if (!requireSocketAuth("host:call_specific")) return;
        const exists = await roomExists(roomCode);
        if (!exists) return;

        const called = await callSpecific(roomCode, token);

        const queue = await getQueue(roomCode);
        io.to(roomCode).emit("queue_update", { roomCode, queue });

        io.to(roomCode).emit("ticket_called", {
          roomCode,
          token: called.token,
          ticket: called,
        });

        console.log(`[ws] room ${roomCode}: chamou específico ${called.name} (${called.token.slice(-8)})`);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: remove ticket da fila ────────────────────────────
    socket.on("host:remove", async ({ roomCode, token }) => {
      try {
        if (!requireSocketAuth("host:remove")) return;
        const exists = await roomExists(roomCode);
        if (!exists) return;

        const updated = await removeTicket(roomCode, token);
        io.to(roomCode).emit("queue_update", { roomCode, queue: updated });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: altera prioridade de um ticket ───────────────────
    socket.on("host:priority", async ({ roomCode, token, priority }) => {
      try {
        if (!requireSocketAuth("host:priority")) return;
        const exists = await roomExists(roomCode);
        if (!exists) return;

        const updated = await changePriority(roomCode, token, priority);
        io.to(roomCode).emit("queue_update", { roomCode, queue: updated });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: adiciona cliente manualmente ─────────────────────
    socket.on("host:add_manual", async ({ roomCode, name, category }) => {
      try {
        if (!requireSocketAuth("host:add_manual")) return;
        const exists = await roomExists(roomCode);
        if (!exists) return;

        await joinQueue(roomCode, { name, category, manual: true });
        const queue = await getQueue(roomCode);
        io.to(roomCode).emit("queue_update", { roomCode, queue });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: confirma que o ticket foi atendido ────────────────
    socket.on("host:confirm_served", async ({ roomCode, token }) => {
      try {
        if (!requireSocketAuth("host:confirm_served")) return;

        // Busca dados do ticket antes de confirmar (para enviar ao host)
        const { rows } = await pool.query(
          `SELECT id, token, name, category, priority, tma, joined_at, called_at
           FROM tickets WHERE token = $1 AND status = 'called'`,
          [token]
        );
        const ticketData = rows[0] || null;

        await confirmServed(token);

        // Broadcast para toda a sala — host recebe com dados completos
        io.to(roomCode).emit("ticket_served", {
          roomCode,
          token,
          ticket: ticketData ? {
            ...ticketData,
            joinedAt: new Date(ticketData.joined_at).getTime(),
            calledAt: new Date(ticketData.called_at).getTime(),
            servedAt: Date.now(),
          } : null,
        });
        console.log(`[ws] room ${roomCode}: atendimento confirmado (${token.slice(-8)})`);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: readmite paciente atendido de volta à fila ─────────
    socket.on("host:readmit", async ({ roomCode, name, category, priority }) => {
      try {
        if (!requireSocketAuth("host:readmit")) return;
        const exists = await roomExists(roomCode);
        if (!exists) return;

        // Adiciona como manual (nova entrada na fila)
        await joinQueue(roomCode, { name, category, manual: true, priority });
        const queue = await getQueue(roomCode);
        io.to(roomCode).emit("queue_update", { roomCode, queue });
        console.log(`[ws] room ${roomCode}: readmitido ${name} (${category})`);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── HOST: chama paciente atendido de volta ao atendimento ────
    socket.on("host:recall_served", async ({ roomCode, token }) => {
      try {
        if (!requireSocketAuth("host:recall_served")) return;

        // Muda status de served → called novamente
        const { rowCount, rows } = await pool.query(
          `UPDATE tickets
           SET status = 'called', called_at = NOW(), served_at = NULL
           WHERE token = $1 AND status = 'served'
           RETURNING *`,
          [token]
        );
        if (rowCount === 0) {
          socket.emit("error", { message: "Ticket não encontrado ou não atendido." });
          return;
        }
        const ticket = rows[0];
        io.to(roomCode).emit("ticket_recalled", {
          roomCode,
          token,
          ticket: { ...ticket, joinedAt: new Date(ticket.joined_at).getTime() },
        });
        console.log(`[ws] room ${roomCode}: recall ${ticket.name} (${token.slice(-8)})`);
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
