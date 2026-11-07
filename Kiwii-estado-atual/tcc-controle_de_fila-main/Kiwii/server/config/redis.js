/**
 * server/config/redis.js
 *
 * Cliente Redis (ioredis) com fallback em memória para desenvolvimento
 * sem Redis instalado. Em produção, Redis é obrigatório.
 *
 * Responsabilidades:
 *   - Cache da fila ativa (latência < 200ms)
 *   - Pub/Sub entre instâncias em modo híbrido (futuro)
 */
const Redis = require("ioredis");
const config = require("../config");

let client;
let usingFallback = false;

// ── Fallback em memória (dev sem Redis) ───────────────────────────
const memStore = new Map();
const memFallback = {
  get: async (key) => memStore.get(key) ?? null,
  set: async (key, value) => { memStore.set(key, value); return "OK"; },
  setex: async (key, _ttl, value) => { memStore.set(key, value); return "OK"; },
  del: async (...keys) => { keys.forEach((k) => memStore.delete(k)); return keys.length; },
  keys: async (pattern) => {
    const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
    return [...memStore.keys()].filter((k) => regex.test(k));
  },
  ping: async () => "PONG",
};

if (config.REDIS_URL && config.REDIS_URL !== "redis://localhost:6379") {
  // Redis configurado → conecta de verdade
  client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
  });

  client.on("connect", () => console.log("[redis] Conectado."));
  client.on("error", (err) => {
    console.error(`[redis] Erro: ${err.message}`);
    if (config.NODE_ENV !== "production") {
      usingFallback = true;
    }
  });

  client.connect().catch(() => {
    if (config.NODE_ENV !== "production") {
      console.warn("[redis] Falha ao conectar — usando fallback em memória.");
      usingFallback = true;
    }
  });
} else {
  // Sem REDIS_URL configurado → usa fallback direto
  console.warn("[redis] REDIS_URL não configurado — usando store em memória (apenas dev).");
  usingFallback = true;
}

// Proxy que redireciona para Redis real ou fallback
const redis = new Proxy(
  {},
  {
    get(_, method) {
      const target = usingFallback ? memFallback : client;
      return typeof target[method] === "function"
        ? target[method].bind(target)
        : target[method];
    },
  }
);

module.exports = redis;
