/**
 * logService.js
 *
 * Trilha de auditoria (audit log) por sala.
 * Registra QUEM fez O QUE e QUANDO — visível apenas para owner/admin.
 *
 * ⚠️ LIMITAÇÃO ATUAL: a identidade do "actor" (nome + cargo) é enviada
 * pelo próprio cliente no momento da conexão (host:join) e não é
 * verificada criptograficamente. Isso é aceitável para o MVP, mas em
 * produção a role DEVE vir de um JWT assinado por um servidor de auth
 * (ex: Supabase Auth), nunca de um valor enviado livremente pelo cliente.
 * Ver README → seção "Autenticação" para o plano de evolução.
 */

const MAX_LOGS_PER_ROOM = 1000; // evita crescimento infinito em memória

/**
 * Registra uma ação no log da sala.
 * @param {object} room    - objeto da sala (room.logs deve existir)
 * @param {object} actor   - { name, role }
 * @param {string} action  - identificador da ação (ex: "ticket.called")
 * @param {object} details - dados adicionais relevantes para exibição
 */
const logAction = (room, actor, action, details = {}) => {
  if (!room.logs) room.logs = [];

  room.logs.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    actor: {
      name: actor?.name?.toString().trim().slice(0, 60) || "Desconhecido",
      role: actor?.role || "operator",
    },
    action,
    details,
  });

  if (room.logs.length > MAX_LOGS_PER_ROOM) {
    room.logs.length = MAX_LOGS_PER_ROOM;
  }
};

/** Retorna true se o cargo tem permissão para ver os logs de auditoria. */
const canViewLogs = (role) => role === "owner" || role === "admin";

module.exports = { logAction, canViewLogs };
