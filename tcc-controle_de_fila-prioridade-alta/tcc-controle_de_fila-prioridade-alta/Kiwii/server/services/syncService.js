/**
 * services/syncService.js
 *
 * Serviço de sincronização para o modo híbrido (cloud + fallback local).
 *
 * Como funciona:
 *   - Instância LOCAL gera eventos no sync_log quando offline
 *   - Heartbeat verifica conectividade com a cloud a cada N segundos
 *   - Quando a internet volta, drena o sync_log para a cloud
 *   - A cloud aplica os eventos na ordem correta (por created_at)
 *
 * Ativo apenas quando OPERATION_MODE=hybrid
 */
const { pool } = require("../config/db");
const config = require("../config");

let isOnline = true;
let heartbeatTimer = null;

// ── Estado de conectividade ───────────────────────────────────────

const getOnlineStatus = () => isOnline;

const checkConnectivity = async () => {
  if (!config.HYBRID.cloudSyncUrl) return true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${config.HYBRID.cloudSyncUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
};

// ── Heartbeat ─────────────────────────────────────────────────────

const startHeartbeat = () => {
  if (config.OPERATION_MODE !== "hybrid") return;

  console.log(`[sync] Modo híbrido ativo. Heartbeat a cada ${config.HYBRID.heartbeatInterval}ms`);

  heartbeatTimer = setInterval(async () => {
    const nowOnline = await checkConnectivity();

    if (!isOnline && nowOnline) {
      console.log("[sync] Conectividade restaurada. Sincronizando eventos pendentes...");
      isOnline = true;
      await drainSyncLog();
    } else if (isOnline && !nowOnline) {
      console.warn("[sync] Conexão com a cloud perdida. Entrando em modo autônomo.");
      isOnline = false;
    }
  }, config.HYBRID.heartbeatInterval);
};

const stopHeartbeat = () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
};

// ── Sync Log ──────────────────────────────────────────────────────

/**
 * Grava um evento no sync_log para sincronização posterior.
 * Chamado apenas quando isOnline = false.
 */
const logEvent = async (orgId, eventType, payload) => {
  await pool.query(
    `INSERT INTO sync_log (org_id, event_type, payload, origin)
     VALUES ($1, $2, $3, 'local')`,
    [orgId, eventType, JSON.stringify(payload)]
  ).catch((err) => console.error("[sync] logEvent:", err.message));
};

/**
 * Envia todos os eventos pendentes do sync_log para a cloud.
 */
const drainSyncLog = async () => {
  if (!config.HYBRID.cloudSyncUrl) return;

  const { rows } = await pool.query(
    `SELECT * FROM sync_log
     WHERE synced_at IS NULL
     ORDER BY created_at ASC
     LIMIT 100`
  );

  if (rows.length === 0) return;
  console.log(`[sync] Enviando ${rows.length} evento(s) para a cloud.`);

  for (const event of rows) {
    try {
      const res = await fetch(`${config.HYBRID.cloudSyncUrl}/api/sync/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: event.id,
          eventType: event.event_type,
          payload: event.payload,
          createdAt: event.created_at,
        }),
      });

      if (res.ok) {
        await pool.query(
          `UPDATE sync_log SET synced_at = NOW() WHERE id = $1`,
          [event.id]
        );
      } else {
        const err = await res.text();
        await pool.query(
          `UPDATE sync_log SET sync_error = $2 WHERE id = $1`,
          [event.id, err.substring(0, 500)]
        );
      }
    } catch (err) {
      await pool.query(
        `UPDATE sync_log SET sync_error = $2 WHERE id = $1`,
        [event.id, err.message.substring(0, 500)]
      );
    }
  }
};

module.exports = { getOnlineStatus, startHeartbeat, stopHeartbeat, logEvent, drainSyncLog };
