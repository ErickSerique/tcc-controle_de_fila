const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { createRoomLimiter } = require("../middleware/rateLimiter");
const { createRoom, getRoom, closeDay, getHistory } = require("../services/roomService");

const router = express.Router();

// ── Validation error handler ───────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// ── POST /api/rooms — Criar sala ───────────────────────────────
router.post(
  "/",
  createRoomLimiter,
  [
    body("name")
      .trim().isLength({ min: 3, max: 80 }).escape()
      .withMessage("Nome deve ter entre 3 e 80 caracteres."),
    body("categories")
      .isArray({ min: 1, max: 10 })
      .withMessage("Informe entre 1 e 10 categorias."),
    body("categories.*.name")
      .trim().isLength({ min: 1, max: 50 }).escape(),
    body("categories.*.priority")
      .isInt({ min: 1, max: 3 })
      .withMessage("Prioridade deve ser 1, 2 ou 3."),
    body("categories.*.tma")
      .isInt({ min: 1, max: 120 })
      .withMessage("TMA deve ser entre 1 e 120 minutos."),
  ],
  validate,
  (req, res) => {
    const { name, categories } = req.body;
    // hostId viria do token de autenticação em produção com auth completo
    const room = createRoom({ name, hostId: `host-${Date.now()}`, categories });
    res.status(201).json({ code: room.code, room });
  }
);

// ── GET /api/rooms/meta/history — Histórico de sessões (antes de /:code) ────────
router.get("/meta/history", (_req, res) => {
  res.json({ history: getHistory() });
});

// ── GET /api/rooms/:code — Info pública da sala ────────────────
router.get(
  "/:code",
  [param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  (req, res) => {
    const room = getRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).json({ error: "Sala não encontrada." });
    if (!room.active) return res.status(410).json({ error: "Sala encerrada." });

    // Expõe apenas dados públicos — sem tokens internos da fila
    res.json({
      code: room.code,
      name: room.name,
      categories: room.categories,
      queueLength: room.queue.length,
      active: room.active,
    });
  }
);

// ── POST /api/rooms/:code/close — Encerrar dia ────────────────
router.post(
  "/:code/close",
  [param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  (req, res) => {
    try {
      const report = closeDay(req.params.code.toUpperCase());
      res.json({ report });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;
