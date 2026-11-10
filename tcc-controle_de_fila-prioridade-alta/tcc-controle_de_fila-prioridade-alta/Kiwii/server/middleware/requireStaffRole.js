/**
 * middleware/requireStaffRole.js
 * Antes: identidade vinha de headers (x-actor-*) do navegador, sem verificação.
 * Agora: usuário autenticado (JWT) + cargo REAL em org_members, na organização
 * dona da sala.
 */
const { requireAuth, getMemberRole } = require("./auth");
const { hasRole } = require("../utils/roleLevel");
const { getRoom } = require("../services/roomService");

const requireRoomStaff = (minRole = "operator") => [
  requireAuth,
  async (req, res, next) => {
    const code = (req.params.code || req.params.roomCode || req.body?.roomCode || "").toUpperCase();
    const room = getRoom(code);
    if (!room) return res.status(404).json({ error: "Sala não encontrada." });
    if (!room.orgId) {
      return res.status(409).json({ error: "Esta sala não está vinculada a uma organização. Crie uma nova sala." });
    }
    const role = await getMemberRole(room.orgId, req.user.id);
    if (!role) return res.status(403).json({ error: "Você não é membro da organização responsável por esta sala." });
    if (!hasRole(role, minRole)) {
      return res.status(403).json({ error: `Permissão insuficiente. Requer: ${minRole}. Seu cargo: ${role}.` });
    }
    req.room = room;
    req.orgRole = role;
    req.actor = { name: req.profile?.name || req.user.email, role };
    next();
  },
];

// Compatibilidade retroativa
const requireOwnerOrAdmin = requireRoomStaff("admin");

module.exports = { requireRoomStaff, requireOwnerOrAdmin };
