const { canViewLogs } = require("../services/logService");

/**
 * requireStaffRole.js
 *
 * Middleware simples para rotas REST que exigem cargo owner/admin
 * (ex: visualizar logs de auditoria).
 *
 * ⚠️ O cargo vem do header X-Actor-Role, enviado pelo próprio cliente.
 * Isso é adequado apenas para o MVP (sem backend de auth real).
 * Um usuário mal-intencionado PODE falsificar este header manualmente.
 * Antes de produção, substitua por verificação de JWT assinado
 * (ex: Supabase Auth) — a role deve vir do token, nunca de um header cru.
 */
const requireOwnerOrAdmin = (req, res, next) => {
  const role = req.headers["x-actor-role"];
  if (!canViewLogs(role)) {
    return res.status(403).json({
      error: "Acesso restrito a Owner ou Admin.",
    });
  }
  next();
};

module.exports = { requireOwnerOrAdmin };
