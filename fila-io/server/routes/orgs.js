/**
 * routes/orgs.js
 *
 * REST API para gerenciamento de organizations, membros e convites.
 *
 * Todas as rotas requerem autenticação Supabase.
 * Rotas de modificação requerem role mínimo indicado.
 */
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { requireAuth, requireRole } = require("../middleware/auth");
const { createLimiter } = require("../middleware/rateLimiter");
const orgService = require("../services/orgService");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// ── POST /api/orgs — Criar organização ───────────────────────────
router.post(
  "/",
  requireAuth,
  createLimiter,
  [body("name").trim().isLength({ min: 3, max: 120 }).escape()],
  validate,
  async (req, res) => {
    try {
      const org = await orgService.createOrg({ name: req.body.name, userId: req.user.id });
      res.status(201).json({ org });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── GET /api/orgs — Minhas organizações ──────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const orgs = await orgService.listUserOrgs(req.user.id);
    res.json({ orgs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orgs/:orgId — Detalhes da org ───────────────────────
router.get(
  "/:orgId",
  requireAuth,
  requireRole("operator"),
  async (req, res) => {
    try {
      const org = await orgService.getOrg(req.params.orgId);
      if (!org) return res.status(404).json({ error: "Organização não encontrada." });
      res.json({ org });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PATCH /api/orgs/:orgId — Atualizar org ───────────────────────
router.patch(
  "/:orgId",
  requireAuth,
  requireRole("admin"),
  [
    body("name").optional().trim().isLength({ min: 3, max: 120 }).escape(),
    body("operationMode").optional().isIn(["cloud", "hybrid"]),
    body("localServerUrl").optional().isURL(),
  ],
  validate,
  async (req, res) => {
    try {
      const org = await orgService.updateOrg(req.params.orgId, req.body);
      res.json({ org });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── DELETE /api/orgs/:orgId — Excluir org ────────────────────────
router.delete(
  "/:orgId",
  requireAuth,
  requireRole("owner"),
  async (req, res) => {
    try {
      await orgService.deleteOrg(req.params.orgId);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── GET /api/orgs/:orgId/members — Listar membros ────────────────
router.get(
  "/:orgId/members",
  requireAuth,
  requireRole("operator"),
  async (req, res) => {
    try {
      const members = await orgService.listMembers(req.params.orgId);
      res.json({ members });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PATCH /api/orgs/:orgId/members/:userId — Alterar role ────────
router.patch(
  "/:orgId/members/:userId",
  requireAuth,
  requireRole("admin"),
  [body("role").isIn(["operator", "admin", "owner"])],
  validate,
  async (req, res) => {
    try {
      const member = await orgService.updateMemberRole(
        req.params.orgId,
        req.params.userId,
        req.body.role,
        req.orgRole
      );
      res.json({ member });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── DELETE /api/orgs/:orgId/members/:userId — Remover membro ─────
router.delete(
  "/:orgId/members/:userId",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      await orgService.removeMember(
        req.params.orgId,
        req.params.userId,
        req.user.id,
        req.orgRole
      );
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── POST /api/orgs/:orgId/invites — Convidar membro ──────────────
router.post(
  "/:orgId/invites",
  requireAuth,
  requireRole("admin"),
  [
    body("email").isEmail().normalizeEmail(),
    body("role").isIn(["operator", "admin"]),
  ],
  validate,
  async (req, res) => {
    try {
      const invite = await orgService.inviteMember(req.params.orgId, {
        email: req.body.email,
        role: req.body.role,
        invitedByUserId: req.user.id,
      });
      res.status(201).json({ invite });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── POST /api/orgs/invites/accept — Aceitar convite ──────────────
router.post(
  "/invites/accept",
  requireAuth,
  [body("token").trim().isLength({ min: 10 })],
  validate,
  async (req, res) => {
    try {
      const invite = await orgService.acceptInvite(req.body.token, req.user.id);
      res.json({ invite });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;
