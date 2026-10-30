const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { createLimiter } = require("../middleware/rateLimiter");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  createRoom, getRoom, closeDay, getHistory, getHistorySession,
} = require("../services/roomService");
const { getArchive } = require("../services/queueService");
const { getAuditLog } = require("../services/logService");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

/**
 * Garante que a sala em questão pertence à organização já verificada em
 * req.orgId (por requireRole). Sem isso, um admin da Org A poderia acessar
 * dados de uma sala da Org B só mandando o X-Org-Id da própria Org A —
 * requireRole sozinho só confirma "é admin de ALGUMA org", não "desta sala".
 */
const requireSameOrg = (getRoomCode) => (req, res, next) => {
  const room = getRoom(getRoomCode(req));
  if (!room) return res.status(404).json({ error: "Sala não encontrada." });
  if (room.orgId !== req.orgId) {
    return res.status(403).json({ error: "Esta sala não pertence à organização informada." });
  }
  req.room = room;
  next();
};

const actorFromRequest = (req) => ({
  userId: req.user.id,
  name: req.profile?.name || req.user.email,
  role: req.orgRole,
});

// ── POST /api/rooms — Criar sala ───────────────────────────────
router.post(
  "/",
  createLimiter,
  requireAuth,
  requireRole("operator"),
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
      hostId: req.user.id,
      orgId: req.orgId,
      categories,
      counters,
      customFields,
      actor: actorFromRequest(req),
    });
    res.status(201).json({ code: room.code, room });
  }
);

// ── GET /api/rooms/:code — Info pública da sala ─────────────────
// Sem auth: usada pelo check-in do cliente e pelo Monitor, que nunca logam.
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

// ── GET /api/rooms/:code/archive — Registro do dia (host) ───────
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

// ── GET /api/rooms/:code/logs — Auditoria (owner/admin) ──────────
router.get(
  "/:code/logs",
  requireAuth,
  requireRole("admin"),
  [param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  requireSameOrg((req) => req.params.code.toUpperCase()),
  async (req, res) => {
    try {
      const logs = await getAuditLog(req.params.code.toUpperCase());
      res.json({ logs });
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar logs de auditoria." });
    }
  }
);

// ── POST /api/rooms/:code/close — Encerrar dia ───────────────────
router.post(
  "/:code/close",
  requireAuth,
  requireRole("operator"),
  [param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  requireSameOrg((req) => req.params.code.toUpperCase()),
  (req, res) => {
    try {
      const report = closeDay(req.params.code.toUpperCase(), actorFromRequest(req));
      res.json({ report });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── GET /api/rooms/meta/history — Histórico de sessões da org ────
router.get(
  "/meta/history",
  requireAuth,
  requireRole("operator"),
  (req, res) => {
    res.json({ history: getHistory(req.orgId) });
  }
);

router.get(
  "/meta/history/:id",
  requireAuth,
  requireRole("operator"),
  (req, res) => {
    const session = getHistorySession(req.params.id);
    if (!session) return res.status(404).json({ error: "Sessão não encontrada." });
    if (session.orgId !== req.orgId) return res.status(404).json({ error: "Sessão não encontrada." });
    res.json({ session });
  }
);

module.exports = router;