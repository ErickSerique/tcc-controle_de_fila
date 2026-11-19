/**
 * routes/rooms.js
 *
 * REST API para salas de atendimento.
 * Suporta configuração avançada (guichês, prioridades em cascata, campos personalizados, trancamento e histórico permanente).
 */
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { requireAuth, requireRole } = require("../middleware/auth");
const { requireRoomStaff } = require("../middleware/requireStaffRole");
const { createLimiter } = require("../middleware/rateLimiter");
const {
  createRoom,
  getRoom,
  closeDay,
  getHistory,
  getHistorySession,
  listActiveRooms,
} = require("../services/roomService");
const { getArchive } = require("../services/queueService");
const { pool } = require("../config/db");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const codeParam = param("code").trim().isAlphanumeric().isLength({ min: 6, max: 6 });

// ── POST /api/rooms — Criar/Configurar nova sala (Apenas Admin) ────
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  createLimiter,
  [
    body("name").trim().isLength({ min: 3, max: 80 }).escape(),
    body("categories").isArray({ min: 1, max: 20 }),
    body("categories.*.name").trim().isLength({ min: 1, max: 50 }).escape(),
    body("categories.*.priority").isInt({ min: 1, max: 3 }),
    body("categories.*.tma").isInt({ min: 1, max: 120 }),
    body("counters").optional().isArray({ max: 20 }),
    body("customFields").optional().isArray({ max: 15 }),
    body("priorityBatchSize").optional().isInt({ min: 0, max: 50 }),
    body("priorityRules").optional().isObject(),
  ],
  validate,
  (req, res) => {
    try {
      const { name, categories, counters, customFields, priorityBatchSize, priorityRules } = req.body;
      const room = createRoom({
        name,
        orgId: req.orgId,
        hostId: req.user.id,
        categories,
        counters,
        customFields,
        priorityBatchSize,
        priorityRules,
        actor: { name: req.profile?.name || req.user.email, role: req.orgRole },
      });
      res.status(201).json({ code: room.code, room });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── POST /api/rooms/open-day — Abrir o dia a partir de sala salva ou direta (Operador ou Admin) ──
router.post(
  "/open-day",
  requireAuth,
  requireRole("operator"),
  createLimiter,
  async (req, res) => {
    try {
      const { savedRoomId, name, categories, counters, customFields, priorityRules } = req.body;
      let roomConfig = { name, categories, counters, customFields, priorityRules };

      if (savedRoomId) {
        try {
          const { rows } = await pool.query(
            `SELECT * FROM saved_rooms WHERE id = $1 AND org_id = $2`,
            [savedRoomId, req.orgId]
          );
          if (rows.length > 0) {
            const sr = rows[0];
            roomConfig = {
              name: sr.name,
              categories: typeof sr.categories === "string" ? JSON.parse(sr.categories) : sr.categories,
              counters: typeof sr.counters === "string" ? JSON.parse(sr.counters) : sr.counters,
              customFields: typeof sr.custom_fields === "string" ? JSON.parse(sr.custom_fields) : sr.custom_fields,
              priorityRules: typeof sr.priority_rules === "string" ? JSON.parse(sr.priority_rules) : sr.priority_rules,
            };
          }
        } catch {}
      }

      const room = createRoom({
        name: roomConfig.name || "Atendimento do Dia",
        orgId: req.orgId,
        hostId: req.user.id,
        categories: roomConfig.categories,
        counters: roomConfig.counters,
        customFields: roomConfig.customFields,
        priorityRules: roomConfig.priorityRules,
        actor: { name: req.profile?.name || req.user.email, role: req.orgRole },
      });

      res.status(201).json({ code: room.code, room });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── GET /api/rooms/org/active — Salas ativas da instituição ──────
router.get("/org/active", requireAuth, requireRole("operator"), (req, res) => {
  res.json({ rooms: listActiveRooms(req.orgId) });
});

// ── GET /api/rooms/history & /api/rooms/meta/history (Persistente no DB) ──
const handleHistory = async (req, res) => {
  try {
    const history = await getHistory(req.orgId);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.get("/history", requireAuth, requireRole("operator"), handleHistory);
router.get("/meta/history", requireAuth, requireRole("operator"), handleHistory);

// ── GET /api/rooms/history/:id & /api/rooms/meta/history/:id ─────
const handleHistorySession = async (req, res) => {
  try {
    const session = await getHistorySession(req.params.id);
    if (!session || (session.orgId && session.orgId !== req.orgId)) {
      return res.status(404).json({ error: "Sessão não encontrada." });
    }
    res.json({ report: session, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.get("/history/:id", requireAuth, requireRole("operator"), handleHistorySession);
router.get("/meta/history/:id", requireAuth, requireRole("operator"), handleHistorySession);

// ── GET /api/rooms/:code — Info pública da sala (clientes) ────────
router.get("/:code", [codeParam], validate, (req, res) => {
  const room = getRoom(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: "Sala não encontrada." });
  if (!room.active) return res.status(410).json({ error: "Sala encerrada." });

  res.json({
    code: room.code,
    name: room.name,
    categories: room.categories,
    counters: room.counters,
    customFields: room.customFields,
    queueLength: room.queue.filter((t) => t.status === "waiting").length,
    active: room.active,
    locked: !!room.locked,
  });
});

// ── GET /api/rooms/:code/archive — Histórico de atendidos do dia ──
router.get("/:code/archive", requireRoomStaff("operator"), [codeParam], validate, (req, res) => {
  try {
    res.json({ archive: getArchive(req.params.code.toUpperCase()) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ── GET /api/rooms/:code/logs — Logs de auditoria da sala ─────────
router.get("/:code/logs", requireRoomStaff("operator"), [codeParam], validate, (req, res) => {
  res.json({ logs: req.room.logs || [] });
});

// ── PATCH /api/rooms/:code/lock — Trancar / Destrancar fila ──────
router.patch(
  "/:code/lock",
  requireRoomStaff("operator"),
  [codeParam, body("locked").isBoolean()],
  validate,
  (req, res) => {
    req.room.locked = !!req.body.locked;
    const io = req.app.get("io");
    if (io) {
      io.to(req.params.code.toUpperCase()).emit("room_status", {
        roomCode: req.params.code.toUpperCase(),
        locked: req.room.locked,
      });
    }
    res.json({ locked: req.room.locked });
  }
);

// ── POST /api/rooms/:code/close — Encerrar dia (Persistente) ─────
router.post("/:code/close", requireRoomStaff("operator"), [codeParam], validate, async (req, res) => {
  try {
    const report = await closeDay(req.params.code.toUpperCase(), req.actor);
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
});

module.exports = router;
