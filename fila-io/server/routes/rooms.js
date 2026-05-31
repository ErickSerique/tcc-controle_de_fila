/**
 * routes/rooms.js
 *
 * REST API para salas de atendimento.
 * Todas as rotas de escrita requerem autenticação + role mínimo.
 * GET /:code é público (clientes precisam validar a sala antes de entrar).
 */
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { requireAuth, requireRole } = require("../middleware/auth");
const { createLimiter } = require("../middleware/rateLimiter");
const roomService = require("../services/roomService");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// ── POST /api/rooms — Criar sala ──────────────────────────────────
router.post(
  "/",
  requireAuth,
  requireRole("operator"),
  createLimiter,
  [
    body("name").trim().isLength({ min: 3, max: 80 }).escape(),
    body("categories").isArray({ min: 1, max: 10 }),
    body("categories.*.name").trim().isLength({ min: 1, max: 50 }).escape(),
    body("categories.*.priority").isInt({ min: 1, max: 3 }),
    body("categories.*.tma").isInt({ min: 1, max: 120 }),
  ],
  validate,
  async (req, res) => {
    try {
      const room = await roomService.createRoom({
        orgId: req.orgId,
        name: req.body.name,
        categories: req.body.categories,
        userId: req.user.id,
      });
      res.status(201).json({ code: room.code, room });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── GET /api/rooms/org — Salas da organização (host panel) ────────
router.get(
  "/org",
  requireAuth,
  requireRole("operator"),
  async (req, res) => {
    try {
      const rooms = await roomService.listOrgRooms(req.orgId);
      res.json({ rooms });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /api/rooms/history — Histórico de sessões ─────────────────
router.get(
  "/history",
  requireAuth,
  requireRole("operator"),
  async (req, res) => {
    try {
      const history = await roomService.getHistory(req.orgId);
      res.json({ history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /api/rooms/:code — Info pública da sala (clientes) ────────
router.get(
  "/:code",
  [param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  async (req, res) => {
    try {
      const room = await roomService.getRoom(req.params.code.toUpperCase());
      if (!room) return res.status(404).json({ error: "Sala não encontrada." });
      if (!room.active) return res.status(410).json({ error: "Sala encerrada." });

      const categories = Array.isArray(room.categories)
        ? room.categories
        : JSON.parse(room.categories);

      // Expõe apenas dados públicos — sem IDs internos sensíveis
      res.json({
        code: room.code,
        name: room.name,
        categories,
        active: room.active,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/rooms/:code/close — Encerrar dia ────────────────────
router.post(
  "/:code/close",
  requireAuth,
  requireRole("operator"),
  [param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  async (req, res) => {
    try {
      const report = await roomService.closeDay(req.params.code.toUpperCase(), {
        closedByUserId: req.user.id,
      });

      // Notifica via Socket.io que a sala foi encerrada
      const io = req.app.get("io");
      if (io) {
        io.to(req.params.code.toUpperCase()).emit("room_closed", {
          roomCode: req.params.code.toUpperCase(),
        });
      }

      res.json({ report });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;
