import Modal from "./Modal";

const ACTION_LABELS = {
  "room.created": "🏗️ Criou a sala",
  "room.closed": "🔒 Encerrou o dia",
  "ticket.called": "📢 Chamou ticket",
  "ticket.called_specific": "📢 Chamou ticket (fora de ordem)",
  "ticket.served": "✅ Confirmou atendimento",
  "ticket.removed": "❌ Removeu ticket",
  "ticket.left_voluntarily": "🚪 Cliente saiu da fila",
  "ticket.recalled_counter": "🔁 Chamou de volta (guichê)",
  "ticket.readmitted_queue": "🔁 Readmitiu na fila",
};

const ROLE_LABELS = { owner: "Owner", admin: "Admin", operator: "Operador", client: "Cliente" };

/**
 * LogsModal — trilha de auditoria da sala (quem fez o quê e quando).
 * Visível apenas para Owner/Admin — controlado por QueueManagementScreen.
 */
const LogsModal = ({ open, onClose, logs }) => {
  return (
    <Modal open={open} onClose={onClose} maxWidth="640px">
      <h3 style={{ fontWeight: 700, marginBottom: "6px", fontSize: "18px" }}>📜 Logs de Auditoria</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
        Visível apenas para Owner e Admin · {logs.length} registro{logs.length !== 1 ? "s" : ""}
      </p>

      {logs.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
          Nenhuma ação registrada ainda.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "60vh", overflowY: "auto" }}>
          {logs.map((log) => (
            <div key={log.id} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
              <span className="mono" style={{ fontSize: "11px", color: "var(--text-dim)", minWidth: "68px" }}>
                {new Date(log.at).toLocaleTimeString("pt-BR")}
              </span>
              <span style={{ flex: 1, fontSize: "13px" }}>
                {ACTION_LABELS[log.action] || log.action}
                {log.details?.name && <span style={{ color: "var(--text-muted)" }}> — {log.details.name}</span>}
                {log.details?.counter && <span style={{ color: "var(--purple)" }}> ({log.details.counter})</span>}
              </span>
              <span className="tag" style={{ background: "var(--surface-hover)", color: "var(--text-muted)", fontSize: "10px", whiteSpace: "nowrap" }}>
                {log.actor.name} · {ROLE_LABELS[log.actor.role] || log.actor.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default LogsModal;
