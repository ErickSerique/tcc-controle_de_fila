const rateLimit = require("express-rate-limit");
const config = require("../config");

/**
 * Global rate limiter — protege contra abuso geral de API.
 * Aplicado apenas em requisições de escrita (POST, DELETE, PATCH).
 */
const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.windowMs,
  max: config.RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
  skip: (req) => req.method === "GET",
});

/**
 * Limiter específico para criação de salas.
 * Impede criação em massa: máx 5 salas por hora por IP.
 */
const createRoomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de criação de salas atingido. Aguarde 1 hora." },
});

module.exports = { rateLimiter, createRoomLimiter };
