/**
 * routes/orgs.js
 *
 * REST API para gerenciamento de organizações, membros,
 * convites temporários, fila de aprovação e salas salvas.
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

// ── Organizações ──────────────────────────────────────────────────

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

router.get("/", requireAuth, async (req, res) => {
  try {
    const orgs = await orgService.listUserOrgs(req.user.id);
    res.json({ orgs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:orgId", requireAuth, requireRole("operator"), async (req, res) => {
  try {
    const org = await orgService.getOrg(req.params.orgId);
    if (!org) return res.status(404).json({ error: "Organização não encontrada." });
    res.json({ org });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

router.delete("/:orgId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await orgService.deleteOrg(req.params.orgId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Membros ───────────────────────────────────────────────────────

router.get("/:orgId/members", requireAuth, requireRole("operator"), async (req, res) => {
  try {
    const members = await orgService.listMembers(req.params.orgId);
    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch(
  "/:orgId/members/:userId",
  requireAuth,
  requireRole("admin"),
  [body("role").isIn(["operator", "admin"])],
  validate,
  async (req, res) => {
    try {
      const member = await orgService.updateMemberRole(
        req.params.orgId,
        req.params.userId,
        req.body.role
      );
      res.json({ member });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.delete("/:orgId/members/:userId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await orgService.removeMember(req.params.orgId, req.params.userId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Convites Temporários & Fila de Aprovação ──────────────────────

// Gerar link temporário (Admin)
router.post("/:orgId/temp-invite-link", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const minutes = parseInt(req.body.expiresInMinutes, 10) || 30;
    const invite = await orgService.createTemporaryInviteLink(req.params.orgId, req.user.id, minutes);
    res.status(201).json(invite);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Prévia pública do convite (qualquer um)
router.get("/invites/:token", async (req, res) => {
  try {
    const info = await orgService.getInviteInfo(req.params.token);
    res.json(info);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Usuário solicita entrada na equipe via link temporário
router.post("/invites/:token/request-join", requireAuth, async (req, res) => {
  try {
    const userName = req.profile?.name || req.user.user_metadata?.full_name || req.user.email.split("@")[0];
    const result = await orgService.requestJoinOrg({
      token: req.params.token,
      userId: req.user.id,
      userName,
      userEmail: req.user.email,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listar solicitações pendentes (Admin)
router.get("/:orgId/join-requests", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const requests = await orgService.listJoinRequests(req.params.orgId);
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aprovar solicitação (Admin)
router.post(
  "/:orgId/join-requests/:requestId/approve",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const assignedRole = req.body.role === "admin" ? "admin" : "operator";
      const result = await orgService.approveJoinRequest(
        req.params.orgId,
        req.params.requestId,
        assignedRole,
        req.user.id
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Recusar solicitação (Admin)
router.post(
  "/:orgId/join-requests/:requestId/reject",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const result = await orgService.rejectJoinRequest(
        req.params.orgId,
        req.params.requestId,
        req.user.id
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Compatibilidade legada para rota POST /:orgId/invites
router.post("/:orgId/invites", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const invite = await orgService.createTemporaryInviteLink(req.params.orgId, req.user.id, 60);
    res.status(201).json({ invite });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Salas Salvas (Permanentes) ────────────────────────────────────

router.get("/:orgId/saved-rooms", requireAuth, requireRole("operator"), async (req, res) => {
  try {
    const rooms = await orgService.listSavedRooms(req.params.orgId);
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:orgId/saved-rooms", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const savedRoom = await orgService.createSavedRoom(req.params.orgId, req.body);
    res.status(201).json({ room: savedRoom });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:orgId/saved-rooms/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const updated = await orgService.updateSavedRoom(req.params.orgId, req.params.id, req.body);
    res.json({ room: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:orgId/saved-rooms/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await orgService.deleteSavedRoom(req.params.orgId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Template de Fila (M2) ────────────────────────────────────────

router.get("/:orgId/queue-template", requireAuth, requireRole("operator"), async (req, res) => {
  try {
    const categories = await orgService.getQueueTemplate(req.params.orgId);
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:orgId/queue-template", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const categories = await orgService.saveQueueTemplate(req.params.orgId, req.body.categories);
    res.json({ categories });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
