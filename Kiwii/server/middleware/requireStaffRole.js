/**
 * middleware/requireStaffRole.js
 *
 * Autenticação via JWT + cargo REAL em org_members na organização
 * dona da sala.
 */
const { requireAuth, getMemberRole } = require("./auth");
const { hasRole } = require("../utils/roleLevel");
const { getRoom } = require("../services/roomService");

const requireRoomStaff = (minRole = "operator") => [
  requireAuth,
  async (req, res, next) => {
    const code = (req.params.code || req.params.roomCode || req.body?.roomCode || "").toUpperCase();
    try {
      const room = await getRoom(code);
      if (!room) return res.status(404).json({ error: "Sala não encontrada." });
      const orgId = room.orgId || room.org_id;
      if (!orgId) {
        return res.status(409).json({ error: "Esta sala não está vinculada a uma organização. Crie uma nova sala." });
      }
      const role = await getMemberRole(orgId, req.user.id);
      if (!role) return res.status(403).json({ error: "Você não é membro da organização responsável por esta sala." });
      if (!hasRole(role, minRole)) {
        return res.status(403).json({ error: `Permissão insuficiente. Requer: ${minRole}. Seu cargo: ${role}.` });
      }
      req.room = room;
      req.orgRole = role;
      req.actor = { name: req.profile?.name || req.user.email, role };
      next();
    } catch (err) {
      console.error("[requireRoomStaff]", err.message);
      return res.status(500).json({ error: "Erro ao verificar permissão do staff." });
    }
  },
];

// Compatibilidade retroativa
const requireOwnerOrAdmin = requireRoomStaff("admin");

module.exports = { requireRoomStaff, requireOwnerOrAdmin };
