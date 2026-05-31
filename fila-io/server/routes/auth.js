/**
 * routes/auth.js
 *
 * Rotas auxiliares de autenticação.
 *
 * O login/registro em si é feito pelo Supabase Auth no cliente.
 * Estas rotas cuidam de:
 *   - Criar/sincronizar user_profiles no nosso banco após o primeiro login
 *   - Aceitar convites de organização
 *   - Emitir e renovar JWT local para operação offline
 */
const express = require("express");
const { body, validationResult } = require("express-validator");
const { requireAuth, issueLocalSession } = require("../middleware/auth");
const { pool } = require("../config/db");
const orgService = require("../services/orgService");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

/**
 * POST /api/auth/profile
 * Cria ou atualiza o perfil do usuário após o primeiro login via Supabase.
 * O cliente deve chamar esta rota logo após autenticar.
 */
router.post(
  "/profile",
  requireAuth,
  [body("name").trim().isLength({ min: 2, max: 120 }).escape()],
  validate,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `INSERT INTO user_profiles (id, name, avatar_url)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
               updated_at = NOW()
         RETURNING *`,
        [
          req.user.id,
          req.body.name,
          req.user.user_metadata?.avatar_url ?? null,
        ]
      );
      res.json({ profile: rows[0] });
    } catch (err) {
      console.error("[auth] profile upsert:", err.message);
      res.status(500).json({ error: "Erro ao salvar perfil." });
    }
  }
);

/**
 * GET /api/auth/me
 * Retorna o perfil completo do usuário autenticado + suas organizations.
 * Também emite/renova o JWT local para operação offline (sliding expiration).
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows: profiles } = await pool.query(
      "SELECT * FROM user_profiles WHERE id = $1",
      [req.user.id]
    );

    const { rows: orgs } = await pool.query(
      `SELECT o.*, om.role
       FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.accepted_at IS NOT NULL
       ORDER BY o.name`,
      [req.user.id]
    );

    // Emite/renova JWT local (sliding expiration de 30 dias)
    const localSession = issueLocalSession(req.user.id, req.user.email);

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        profile: profiles[0] ?? null,
      },
      organizations: orgs,
      localSession, // Frontend armazena para uso offline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/accept-invite
 * Aceita um convite de organização via token.
 */
router.post(
  "/accept-invite",
  requireAuth,
  [body("token").trim().isLength({ min: 10 })],
  validate,
  async (req, res) => {
    try {
      const invite = await orgService.acceptInvite(req.body.token, req.user.id);
      res.json({ invite, message: "Convite aceito com sucesso." });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;
