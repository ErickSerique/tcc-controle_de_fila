const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");

const config = require("./config");
const roomsRouter = require("./routes/rooms");
const queueRouter = require("./routes/queue");
const { rateLimiter } = require("./middleware/rateLimiter");
const registerSocketHandlers = require("./socket/handlers");

// ── Express app ────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

// ── Socket.io — alvo: latência < 200ms ────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: config.CLIENT_URL,
    methods: ["GET", "POST"],
  },
  pingTimeout: 10_000,
  pingInterval: 5_000,
});

// Injeta io no app para uso nas rotas REST (ex: queue.js)
app.set("io", io);

// ── Middleware global ──────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.CLIENT_URL }));
app.use(express.json({ limit: "10kb" })); // bloqueia payloads gigantes
app.use(rateLimiter);

// ── Rotas REST ─────────────────────────────────────────────────
app.get("/api", (_req, res) => {
  res.json({
    name: "fila.io API",
    endpoints: {
      rooms: "/api/rooms",
      queue: "/api/queue",
      history: "/api/rooms/meta/history",
    },
    health: "/health",
  });
});

app.use("/api/rooms", roomsRouter);
app.use("/api/queue", queueRouter);

app.get("/health", (_req, res) =>
  res.json({ status: "ok", ts: Date.now(), uptime: process.uptime() })
);

// ── 404 ────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada." }));

// ── Error handler global ───────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[error]", err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Erro interno do servidor.",
  });
});

// ── Socket.io handlers ─────────────────────────────────────────
registerSocketHandlers(io);

// ── Inicialização ──────────────────────────────────────────────
httpServer.listen(config.PORT, () => {
  const ui = config.CLIENT_URL.replace(/\/$/, "");
  console.log(`
  ⚡ fila.io — servidor iniciado
  ─────────────────────────────
  Web UI →  ${ui}   (vite: npm run dev)
  REST     →  http://localhost:${config.PORT}/api
  WS       →  ws://localhost:${config.PORT}
  Health   →  http://localhost:${config.PORT}/health
  `);
});

module.exports = { app, io };
