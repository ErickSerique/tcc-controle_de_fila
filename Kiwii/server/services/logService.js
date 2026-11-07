/**
 * logService.js
 *
 * Trilha de auditoria (audit log) por sala.
 * Registra em memória (room.logs) para resposta imediata e no banco (audit_log)
 * de forma assíncrona (fire-and-forget).
 */
const { pool } = require("../config/db");

const MAX_LOGS_PER_ROOM = 1000;

/**
 * Registra uma ação no log da sala.
 * @param {object} room    - objeto da sala
 * @param {object} actor   - { name, role, userId }
 * @param {string} action  - identificador da ação (ex: "ticket.called")
 * @param {object} details - dados adicionais relevantes para exibição
 */
const logAction = (room, actor, action, details = {}) => {
  if (!room) return;
  if (!room.logs) room.logs = [];

  const actorName = actor?.name?.toString().trim().slice(0, 60) || "Desconhecido";
  const actorRole = actor?.role || "operator";

  room.logs.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    actor: {
      name: actorName,
      role: actorRole,
    },
    action,
    details,
  });

  if (room.logs.length > MAX_LOGS_PER_ROOM) {
    room.logs.length = MAX_LOGS_PER_ROOM;
  }

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
};

/** Retorna true se o cargo tem permissão para ver os logs de auditoria. */
const canViewLogs = (role) => role === "owner" || role === "admin";

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
