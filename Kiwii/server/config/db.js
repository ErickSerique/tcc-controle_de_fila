/**
 * server/config/db.js
 *
 * Exporta dois clientes:
 *   pool   → node-postgres (queries diretas, transações)
 *   supabase → @supabase/supabase-js com service_role (auth admin)
 */
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const config = require("../config");

// ── PostgreSQL via node-pg ────────────────────────────────────────
const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 10_000,   // libera conexões ociosas em 10s (era 30s)
  connectionTimeoutMillis: 5_000,
  ssl: config.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("[db] Erro inesperado no pool:", err.message);
});

// Monitoramento do pool — loga estado a cada 60s em dev (sem spam por conexão)
if (config.NODE_ENV !== "production" && config.NODE_ENV !== "test") {
  let _poolLoggedOnce = false;
  const poolInterval = setInterval(() => {
    const { totalCount, idleCount, waitingCount } = pool;
    // Só loga se houver atividade ou na primeira vez
    if (totalCount > 0 || !_poolLoggedOnce) {
      console.log(`[db] Pool: ${totalCount} total | ${idleCount} idle | ${waitingCount} aguardando`);
      _poolLoggedOnce = true;
    }
  }, 60_000);
  if (poolInterval?.unref) poolInterval.unref();
}

// ── Supabase Admin Client (service_role) ──────────────────────────
// Usado apenas no servidor para operações de auth admin:
//   - criar usuários, verificar JWTs, enviar convites por e-mail
const supabase =
  config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : {
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: new Error("Supabase não configurado."),
          }),
          admin: {
            createUser: async () => ({
              data: { user: null },
              error: new Error("Supabase não configurado."),
            }),
            inviteUserByEmail: async () => ({
              data: null,
              error: new Error("Supabase não configurado."),
            }),
          },
        },
      };

/**
 * Verifica o JWT do Supabase Auth enviado pelo cliente.
 * Retorna { user } ou lança erro.
 */
const verifySupabaseToken = async (accessToken) => {
  if (!config.SUPABASE_URL) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Token inválido ou expirado.");
  return data.user;
};

module.exports = { pool, supabase, verifySupabaseToken };
