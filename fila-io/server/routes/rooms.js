const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { createLimiter } = require("../middleware/rateLimiter");
const { requireOwnerOrAdmin } = require("../middleware/requireStaffRole");
const {
  createRoom, getRoom, closeDay, getHistory, getHistorySession,
} = require("../services/roomService");
const { getArchive } = require("../services/queueService");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

/** Extrai identidade do operador dos headers (ver aviso de segurança no README). */
const actorFromHeaders = (req) => ({
  name: req.headers["x-actor-name"] || "Desconhecido",
  role: req.headers["x-actor-role"] || "operator",
});

// ── POST /api/rooms — Criar sala ───────────────────────────────
router.post(
  "/",
  createLimiter,
  [
    body("name").trim().isLength({ min: 3, max: 80 }).escape(),
    body("categories").isArray({ min: 1, max: 10 }),
    body("categories.*.name").trim().isLength({ min: 1, max: 50 }).escape(),
    body("categories.*.priority").isInt({ min: 1, max: 3 }),
    body("categories.*.tma").isInt({ min: 1, max: 120 }),
    body("counters").optional().isArray({ max: 20 }),
    body("customFields").optional().isArray({ max: 15 }),
  ],
  validate,
  (req, res) => {
    const { name, categories, counters, customFields } = req.body;
    const room = createRoom({
      name,
      hostId: `host-${Date.now()}`,
      categories,
      counters,
      customFields,
      actor: actorFromHeaders(req),
    });
    res.status(201).json({ code: room.code, room });
  }
);

// ── GET /api/rooms/:code — Info pública da sala ────────────────
router.get(
  "/:code",
  [param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  (req, res) => {
    const room = getRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).json({ error: "Sala não encontrada." });
    if (!room.active) return res.status(410).json({ error: "Sala encerrada." });

    res.json({
      code: room.code,
      name: room.name,
      categories: room.categories,
      customFields: room.customFields,
      queueLength: room.queue.length,
      active: room.active,
    });
  }
);

// ── GET /api/rooms/:code/archive — Registro do dia (host) ──────
router.get(
  "/:code/archive",
  [param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  (req, res) => {
    try {
      res.json({ archive: getArchive(req.params.code.toUpperCase()) });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }
);

// ── GET /api/rooms/:code/logs — Auditoria (owner/admin) ─────────
router.get(
  "/:code/logs",
  requireOwnerOrAdmin,
  [param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  (req, res) => {
    const room = getRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).json({ error: "Sala não encontrada." });
    res.json({ logs: room.logs || [] });
  }
);

// ── POST /api/rooms/:code/close — Encerrar dia ──────────────────
router.post(
  "/:code/close",
  [param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  (req, res) => {
    try {
      const report = closeDay(req.params.code.toUpperCase(), actorFromHeaders(req));
      res.json({ report });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── GET /api/rooms/meta/history — Histórico de sessões ──────────
router.get("/meta/history", (_req, res) => {
  res.json({ history: getHistory() });
});

router.get("/meta/history/:id", (req, res) => {
  const session = getHistorySession(req.params.id);
  if (!session) return res.status(404).json({ error: "Sessão não encontrada." });
  res.json({ session });
});

module.exports = router;
