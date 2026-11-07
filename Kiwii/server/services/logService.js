/**
 * logService.js
 *
 * Trilha de auditoria (audit log) por sala.
<<<<<<< Updated upstream
 * Registra QUEM fez O QUE e QUANDO — visível apenas para owner/admin.
 *
 * ⚠️ LIMITAÇÃO ATUAL: a identidade do "actor" (nome + cargo) é enviada
 * pelo próprio cliente no momento da conexão (host:join) e não é
 * verificada criptograficamente. Isso é aceitável para o MVP, mas em
 * produção a role DEVE vir de um JWT assinado por um servidor de auth
 * (ex: Supabase Auth), nunca de um valor enviado livremente pelo cliente.
 * Ver README → seção "Autenticação" para o plano de evolução.
=======
 * Registra em memória (room.logs) para resposta imediata e no banco (audit_log)
 * de forma assíncrona (fire-and-forget).
>>>>>>> Stashed changes
 */

const MAX_LOGS_PER_ROOM = 1000; // evita crescimento infinito em memória

const MAX_LOGS_PER_ROOM = 1000;

/**
 * Registra uma ação no log da sala.
<<<<<<< Updated upstream
 * @param {object} room    - objeto da sala (room.logs deve existir)
 * @param {object} actor   - { name, role }
=======
 * @param {object} room    - objeto da sala
 * @param {object} actor   - { name, role, userId }
>>>>>>> Stashed changes
 * @param {string} action  - identificador da ação (ex: "ticket.called")
 * @param {object} details - dados adicionais relevantes para exibição
 */
const logAction = (room, actor, action, details = {}) => {
<<<<<<< Updated upstream
  if (!room.logs) room.logs = [];

=======
  if (!room) return;
  if (!room.logs) room.logs = [];

  const actorName = actor?.name?.toString().trim().slice(0, 60) || "Desconhecido";
  const actorRole = actor?.role || "operator";

>>>>>>> Stashed changes
  room.logs.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    actor: {
<<<<<<< Updated upstream
      name: actor?.name?.toString().trim().slice(0, 60) || "Desconhecido",
      role: actor?.role || "operator",
=======
      name: actorName,
      role: actorRole,
>>>>>>> Stashed changes
    },
    action,
    details,
  });

  if (room.logs.length > MAX_LOGS_PER_ROOM) {
    room.logs.length = MAX_LOGS_PER_ROOM;
  }
<<<<<<< Updated upstream
=======

  // Persistência assíncrona no PostgreSQL (se houver orgId)
  if (room.orgId && pool) {
    pool
      .query(
        `INSERT INTO audit_log (org_id, room_code, actor_user_id, actor_name, actor_role, action, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [room.orgId, room.code, actor?.userId || null, actorName, actorRole, action, JSON.stringify(details)]
      )
      .catch((err) => {
        // Silencioso em caso de erro de conexão com banco
      });
  }
>>>>>>> Stashed changes
};

/** Retorna true se o cargo tem permissão para ver os logs de auditoria. */
const canViewLogs = (role) => role === "owner" || role === "admin";

<<<<<<< Updated upstream
module.exports = { logAction, canViewLogs };
=======
/** Busca os logs de auditoria de uma sala específica, mais recentes primeiro. */
const getAuditLog = async (roomCode, limit = 500) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, actor_name, actor_role, action, details, created_at
       FROM audit_log
       WHERE room_code = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [roomCode, limit]
    );
    return rows;
  } catch {
    return [];
  }
};

module.exports = { logAction, canViewLogs, getAuditLog };
>>>>>>> Stashed changes
