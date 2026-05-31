require("dotenv").config();

// ── Validação de variáveis críticas ──────────────────────────────
const required = ["DATABASE_URL", "JWT_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0 && process.env.NODE_ENV === "production") {
  console.error(`[config] Variáveis obrigatórias ausentes: ${missing.join(", ")}`);
  process.exit(1);
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT, 10) || 3001,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",

  // Banco de dados
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/fila_io",

  // Redis
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // JWT (tokens de sessão de ticket — separado do Supabase Auth)
  JWT_SECRET: process.env.JWT_SECRET || "dev_secret_change_in_production",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",

  // Rate Limiting
  RATE_LIMIT: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // Modo de operação: 'cloud' | 'hybrid'
  OPERATION_MODE: process.env.OPERATION_MODE || "cloud",

  // Configuração do modo híbrido (fallback local)
  HYBRID: {
    localServerUrl: process.env.LOCAL_SERVER_LAN_URL || "",
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10) || 10_000,
    cloudSyncUrl: process.env.CLOUD_SYNC_URL || "",
  },
};
