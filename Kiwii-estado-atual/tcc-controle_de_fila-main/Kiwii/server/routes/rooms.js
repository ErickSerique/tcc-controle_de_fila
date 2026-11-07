/**
 * routes/rooms.js
 * - POST / exige usuário autenticado (operator+) na organização do header X-Org-Id;
 *   a sala nasce vinculada a ela (room.orgId).
 * - /:code/archive|logs|close|lock usam requireRoomStaff (cargo REAL na org dona da sala).
 * - /org/active lista as salas ativas da organização (funcionário entra como guichê).
 * - /meta/history* exigem autenticação e filtram pela organização.
 * - GET /:code (pública, check-in) também informa `locked`.
 */
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { createLimiter } = require("../middleware/rateLimiter");
const { requireAuth, requireRole } = require("../middleware/auth");
const { requireRoomStaff } = require("../middleware/requireStaffRole");
const { createRoom, getRoom, closeDay, getHistory, getHistorySession, listActiveRooms } = require("../services/roomService");
const { getArchive } = require("../services/queueService");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};
const codeParam = param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 });

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
    body("counters").optional().isArray({ max: 20 }),
    body("customFields").optional().isArray({ max: 15 }),
    body("priorityBatchSize").optional().isInt({ min: 0, max: 50 }),
  ],
  validate,
  (req, res) => {
    const { name, categories, counters, customFields, priorityBatchSize } = req.body;
    const room = createRoom({
      name, orgId: req.orgId, hostId: req.user.id,
      categories, counters, customFields, priorityBatchSize,
      actor: { name: req.profile?.name || req.user.email, role: req.orgRole },
    });
    res.status(201).json({ code: room.code, room });
  }
);

router.get("/org/active", requireAuth, requireRole("operator"), (req, res) => {
  res.json({ rooms: listActiveRooms(req.orgId) });
});

router.get("/:code", [codeParam], validate, (req, res) => {
  const room = getRoom(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: "Sala não encontrada." });
  if (!room.active) return res.status(410).json({ error: "Sala encerrada." });
  res.json({
    code: room.code, name: room.name, categories: room.categories,
    customFields: room.customFields, queueLength: room.queue.length,
    active: room.active, locked: !!room.locked,
  });
});

router.get("/:code/archive", requireRoomStaff("operator"), [codeParam], validate, (req, res) => {
  try { res.json({ archive: getArchive(req.params.code.toUpperCase()) }); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

router.get("/:code/logs", requireRoomStaff("admin"), [codeParam], validate, (req, res) => {
  res.json({ logs: req.room.logs || [] });
});

router.post("/:code/close", requireRoomStaff("operator"), [codeParam], validate, (req, res) => {
  try { res.json({ report: closeDay(req.params.code.toUpperCase(), req.actor) }); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch("/:code/lock", requireRoomStaff("operator"), [codeParam, body("locked").isBoolean()], validate, (req, res) => {
  req.room.locked = !!req.body.locked;
  res.json({ locked: req.room.locked });
});

router.get("/meta/history", requireAuth, requireRole("operator"), (req, res) => {
  res.json({ history: getHistory(req.orgId) });
});

router.get("/meta/history/:id", requireAuth, requireRole("operator"), (req, res) => {
  const session = getHistorySession(req.params.id);
  if (!session || session.orgId !== req.orgId) return res.status(404).json({ error: "Sessão não encontrada." });
  res.json({ session });
});

module.exports = router;
