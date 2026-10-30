/**
 * logService.js
 *
 * Trilha de auditoria (audit log) por sala — persistida no Postgres
 * (tabela audit_log), não mais em memória.
 *
 * A gravação é "fire-and-forget": não bloqueia nem quebra a ação
 * principal do usuário se a escrita do log falhar (ex: banco
 * momentaneamente indisponível). Um log de auditoria que falha ao
 * gravar é bem menos grave do que uma ação de fila que falha por
 * causa do log — por isso essa função continua síncrona por fora
 * (nenhum caller precisa de await), mesmo escrevendo assincronamente.
 *
 * room_code é armazenado como texto (não FK para `rooms`) porque a
 * persistência de salas em si ainda não existe (isso é trabalho da
 * fase seguinte, "dados de fila no Postgres"). org_id já é uma FK
 * real, porque organizações já vivem 100% no banco.
 */
const { pool } = require("../config/db");

/**
 * Registra uma ação no log de auditoria da sala.
 * @param {object} room   - objeto da sala (precisa ter room.orgId e room.code)
 * @param {object} actor  - { userId, name, role }
 * @param {string} action - identificador da ação (ex: "ticket.called")
 * @param {object} details - dados adicionais relevantes para exibição
 */
const logAction = (room, actor, action, details = {}) => {
  if (!room?.orgId) {
    console.warn(`[audit] Sala ${room?.code} sem orgId — log "${action}" descartado.`);
    return;
  }

  const actorName = actor?.name?.toString().trim().slice(0, 60) || "Desconhecido";
  const actorRole = actor?.role || "operator";

  pool
    .query(
      `INSERT INTO audit_log (org_id, room_code, actor_user_id, actor_name, actor_role, action, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [room.orgId, room.code, actor?.userId || null, actorName, actorRole, action, JSON.stringify(details)]
    )
    .catch((err) => {
      console.warn("[audit] Falha ao gravar log de auditoria:", err.message);
    });
};

/** Retorna true se o cargo tem permissão para ver os logs de auditoria. */
const canViewLogs = (role) => role === "owner" || role === "admin";

/** Busca os logs de auditoria de uma sala específica, mais recentes primeiro. */
const getAuditLog = async (roomCode, limit = 500) => {
  const { rows } = await pool.query(
    `SELECT id, actor_name, actor_role, action, details, created_at
     FROM audit_log
     WHERE room_code = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [roomCode, limit]
  );
  return rows;
};

module.exports = { logAction, canViewLogs, getAuditLog };