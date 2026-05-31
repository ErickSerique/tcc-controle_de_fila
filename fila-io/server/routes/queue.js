/**
 * routes/queue.js
 *
 * REST API para operações na fila.
 *
 * POST /join   → público (cliente entra na fila)
 * GET  /:code  → requer auth (host consulta fila)
 */
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { requireAuth, requireRole } = require("../middleware/auth");
const { joinQueueLimiter } = require("../middleware/rateLimiter");
const { signTicketToken } = require("../middleware/validateToken");
const { joinQueue, getQueue } = require("../services/queueService");
const { getRoom } = require("../services/roomService");
const { verifySupabaseToken, pool } = require("../config/db");
const { verifyLocalSession } = require("../middleware/auth");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// ── POST /api/queue/join — Cliente entra na fila ──────────────────
router.post(
  "/join",
  joinQueueLimiter,
  [
    body("roomCode").trim().isAlphanumeric().isLength({ min: 6, max: 6 }),
    body("name").trim().isLength({ min: 2, max: 80 }).escape(),
    body("category").trim().isLength({ min: 1, max: 50 }).escape(),
  ],
  validate,
  async (req, res) => {
    const { roomCode, name, category } = req.body;
    const code = roomCode.toUpperCase();

    try {
      const room = await getRoom(code);
      if (!room || !room.active) return res.status(404).json({ error: "Sala não encontrada ou inativa." });

      // Validação: Host não pode entrar na própria fila
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) {
        try {
          let user;
          const token = auth.split(" ")[1];
          // Tenta Supabase primeiro, depois JWT local
          try {
            user = await verifySupabaseToken(token);
          } catch {
            user = verifyLocalSession(token);
          }
          const { rows } = await pool.query(
            "SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2",
            [room.org_id, user.id]
          );
          if (rows.length > 0) {
            return res.status(403).json({ error: "Membros da organização não podem entrar na própria fila." });
          }
        } catch (err) {
          // Ignora token inválido e prossegue como anônimo
        }
      }

      const ticket = await joinQueue(code, { name, category });

      // JWT vincula token ao roomCode — impede reutilização cross-sala
      const sessionToken = signTicketToken(ticket.token, code);

      // Emite atualização de fila via Socket.io
      const io = req.app.get("io");
      if (io) {
        const queue = await getQueue(code);
        io.to(code).emit("queue_update", { roomCode: code, queue });
      }

      res.status(201).json({ ticket, sessionToken });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── GET /api/queue/:roomCode — Fila atual (host) ──────────────────
router.get(
  "/:roomCode",
  requireAuth,
  requireRole("operator"),
  [param("roomCode").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  async (req, res) => {
    try {
      const queue = await getQueue(req.params.roomCode.toUpperCase());
      res.json({ queue });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }
);

module.exports = router;
