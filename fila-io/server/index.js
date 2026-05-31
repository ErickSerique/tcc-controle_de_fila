/**
 * server/index.js — fila.io v2.0
 *
 * Ponto de entrada do servidor.
 * Inicializa Express, Socket.io, PostgreSQL pool e modo híbrido.
 */
require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");

const config = require("./config");
const { pool } = require("./config/db");
const { rateLimiter } = require("./middleware/rateLimiter");
const { startHeartbeat } = require("./services/syncService");

const authRouter   = require("./routes/auth");
const orgsRouter   = require("./routes/orgs");
const roomsRouter  = require("./routes/rooms");
const queueRouter  = require("./routes/queue");
const registerSocketHandlers = require("./socket/handlers");

// ── Express ───────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: config.CLIENT_URL,
    methods: ["GET", "POST"],
  },
  pingTimeout: 10_000,
  pingInterval: 5_000,
});

app.set("io", io);

// ── Middleware global ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(rateLimiter);

// ── Rotas ──────────────────────────────────────────────────────────
app.get("/api", (_req, res) =>
  res.json({
    name: "fila.io API",
    version: "2.0.0",
    endpoints: {
      auth:   "/api/auth",
      orgs:   "/api/orgs",
      rooms:  "/api/rooms",
      queue:  "/api/queue",
    },
    health: "/health",
  })
);

app.use("/api/auth",  authRouter);
app.use("/api/orgs",  orgsRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/queue", queueRouter);

app.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch (_) {}

  res.json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk,
    mode: config.OPERATION_MODE,
    ts: Date.now(),
    uptime: process.uptime(),
  });
});

// ── 404 ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada." }));

// ── Error handler global ───────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[error]", err.stack);
  res.status(err.status || 500).json({ error: err.message || "Erro interno do servidor." });
});

// ── Socket.io handlers ─────────────────────────────────────────────
registerSocketHandlers(io);

// ── Modo Híbrido ───────────────────────────────────────────────────
if (config.OPERATION_MODE === "hybrid") {
  startHeartbeat();
}

// ── Start ──────────────────────────────────────────────────────────
httpServer.listen(config.PORT, () => {
  console.log(`
  ⚡ fila.io v2.0 — servidor iniciado
  ─────────────────────────────────────
  Modo     →  ${config.OPERATION_MODE.toUpperCase()}
  REST     →  http://localhost:${config.PORT}/api
  WS       →  ws://localhost:${config.PORT}
  Health   →  http://localhost:${config.PORT}/health
  UI       →  ${config.CLIENT_URL}
  `);
});

module.exports = { app, io };
