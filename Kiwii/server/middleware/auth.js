/**
 * middleware/auth.js
 *
 * Middleware de autenticação com fallback offline.
 *
 * Estratégia:
 *   1. Tenta verificar via Supabase Auth (cloud)
 *   2. Se Supabase indisponível → tenta JWT local (sessão persistente)
 *   3. Se ambos falharem → 401
 *
 * O JWT local é emitido após login Supabase bem-sucedido e tem
 * validade de 30 dias com sliding expiration (renovado a cada uso).
 *
 * Uso:
 *   router.post("/rooms", requireAuth, requireRole("admin"), handler)
 *
 * O middleware injeta em req:
 *   req.user      → { id, email, ... }
 *   req.profile   → user_profiles row
 *   req.orgId     → UUID da organization (extraído do header X-Org-Id)
 *   req.orgRole   → 'owner' | 'admin' | 'operator'
 *   req.authMode  → 'supabase' | 'local' (indica qual auth foi usada)
 */
const jwt = require("jsonwebtoken");
const { verifySupabaseToken, pool } = require("../config/db");
const config = require("../config");
const { ROLE_LEVEL, hasRole } = require("../utils/roleLevel");

const LOCAL_SESSION_EXPIRY = "30d";
const LOCAL_SESSION_TYPE = "local_session";

// ── Sessão local (JWT offline) ───────────────────────────────────

/**
 * Emite um JWT local de longa duração para uso offline.
 * Contém o mínimo necessário para identificar o usuário.
 */
const issueLocalSession = (userId, email) =>
  jwt.sign(
    { sub: userId, email, type: LOCAL_SESSION_TYPE },
    config.JWT_SECRET,
    { expiresIn: LOCAL_SESSION_EXPIRY }
  );

/**
 * Verifica e decodifica um JWT local.
 * Retorna { id, email } no formato compatível com Supabase user.
 */
const verifyLocalSession = (token) => {
  const decoded = jwt.verify(token, config.JWT_SECRET);
  if (decoded.type !== LOCAL_SESSION_TYPE) {
    throw new Error("Token não é uma sessão local.");
  }
  return { id: decoded.sub, email: decoded.email };
};

// ── Middleware principal ──────────────────────────────────────────

/**
 * Verifica o Bearer token (Supabase ou JWT local) e carrega o perfil.
 */
const requireAuth = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticação ausente." });
  }

  const accessToken = auth.split(" ")[1];
  let user = null;
  let authMode = "supabase";

  // Tentativa 1: Supabase Auth
  try {
    user = await verifySupabaseToken(accessToken);
  } catch (supabaseErr) {
    // Tentativa 2: JWT local (fallback offline)
    try {
      user = verifyLocalSession(accessToken);
      authMode = "local";
    } catch {
      // Ambos falharam
      return res.status(401).json({ error: "Token inválido ou expirado." });
    }
  }

  req.user = user;
  req.authMode = authMode;

  // Carrega perfil adicional
  try {
    const { rows } = await pool.query(
      "SELECT * FROM user_profiles WHERE id = $1",
      [user.id]
    );
    req.profile = rows[0] ?? null;
  } catch (dbErr) {
    // Se o banco local também falhou, ainda assim permite operar
    // com as informações do token
    console.warn("[auth] Falha ao carregar perfil:", dbErr.message);
    req.profile = null;
  }

<<<<<<< Updated upstream
  next();
=======
  return { user, profile, authMode };
};

/**
 * Middleware REST: exige um Bearer token válido no header Authorization.
 */
const requireAuth = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticação ausente." });
  }

  try {
    const { user, profile, authMode } = await verifyToken(auth.split(" ")[1]);
    req.user = user;
    req.profile = profile;
    req.authMode = authMode;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
};

/** Cargo REAL do usuário em uma organização (direto do banco). null se não for membro aceito. */
const getMemberRole = async (orgId, userId) => {
  const { rows } = await pool.query(
    `SELECT role FROM org_members
     WHERE org_id = $1 AND user_id = $2 AND accepted_at IS NOT NULL`,
    [orgId, userId]
  );
  return rows[0]?.role ?? null;
>>>>>>> Stashed changes
};

const getOrgRole = async (userId, orgId) => getMemberRole(orgId, userId);

// ── Role check ───────────────────────────────────────────────────

const requireRole = (minRole = "operator") => async (req, res, next) => {
  const orgId = req.headers["x-org-id"] || req.body?.orgId || req.params?.orgId;
  if (!orgId) {
    return res.status(400).json({ error: "Header X-Org-Id ausente." });
  }

  req.orgId = orgId;

  try {
<<<<<<< Updated upstream
    const { rows } = await pool.query(
      `SELECT role FROM org_members
       WHERE org_id = $1 AND user_id = $2 AND accepted_at IS NOT NULL`,
      [orgId, req.user.id]
    );
=======
    const userRole = await getMemberRole(orgId, req.user.id);
>>>>>>> Stashed changes

    if (rows.length === 0) {
      return res.status(403).json({ error: "Acesso negado: você não é membro desta organização." });
    }

    const userRole = rows[0].role;
    req.orgRole = userRole;

    if (!hasRole(userRole, minRole)) {
      return res.status(403).json({
        error: `Permissão insuficiente. Requer: ${minRole}. Seu role: ${userRole}.`,
      });
    }

    next();
  } catch (err) {
    console.error("[auth] requireRole:", err.message);
    return res.status(500).json({ error: "Erro ao verificar permissões." });
  }
};

<<<<<<< Updated upstream
module.exports = { requireAuth, requireRole, issueLocalSession, verifyLocalSession };
=======
module.exports = {
  requireAuth,
  requireRole,
  verifyToken,
  getMemberRole,
  getOrgRole,
  issueLocalSession,
  verifyLocalSession,
  ROLE_LEVEL,
  hasRole,
};
>>>>>>> Stashed changes
