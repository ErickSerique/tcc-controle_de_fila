const rateLimit = require("express-rate-limit");
const config = require("../config");

/** Limiter global — protege escrita de API */
const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.windowMs,
  max: config.RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
  skip: (req) => req.method === "GET",
});

/** Limiter para criação de organizations/salas */
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de criação atingido. Aguarde 1 hora." },
});

/** Limiter para join na fila (clientes) */
const joinQueueLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de entrar na fila. Aguarde 1 minuto." },
});

module.exports = { rateLimiter, createLimiter, joinQueueLimiter };
