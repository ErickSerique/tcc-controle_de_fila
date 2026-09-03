const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { joinQueue, getQueue } = require("../services/queueService");
const { signSessionToken } = require("../middleware/validateToken");
const { roomExists } = require("../services/roomService");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// ── POST /api/queue/join — Cliente entra na fila ────────────────
router.post(
  "/join",
  [
    body("roomCode").trim().isAlphanumeric().isLength({ min: 6, max: 6 }),
    body("name").trim().isLength({ min: 2, max: 80 }).escape(),
    body("category").trim().isLength({ min: 1, max: 50 }).escape(),
    body("customData").optional().isObject(),
  ],
  validate,
  (req, res) => {
    const { roomCode, name, category, customData } = req.body;
    const code = roomCode.toUpperCase();

    if (!roomExists(code)) {
      return res.status(404).json({ error: "Sala não encontrada ou inativa." });
    }

    try {
      const ticket = joinQueue(code, { name, category, customData: customData || {} });
      const sessionToken = signSessionToken(ticket.token, code);

      const io = req.app.get("io");
      if (io) {
        io.to(code).emit("queue_update", { roomCode: code, queue: getQueue(code) });
      }

      res.status(201).json({ ticket, sessionToken });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── GET /api/queue/:roomCode — Fila atual (host) ─────────────────
router.get(
  "/:roomCode",
  [param("roomCode").trim().isAlphanumeric().isLength({ min: 6, max: 6 })],
  validate,
  (req, res) => {
    try {
      res.json({ queue: getQueue(req.params.roomCode.toUpperCase()) });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }
);

module.exports = router;
