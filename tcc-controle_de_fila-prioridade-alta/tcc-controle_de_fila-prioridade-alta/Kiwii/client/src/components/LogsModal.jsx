import { ScrollText, Building2, Lock, Volume2, Check, X, LogOut, RotateCcw } from "lucide-react";
import Modal from "./Modal";

const ACTION_INFO = {
  "room.created":            { Icon: Building2, label: "Criou a sala" },
  "room.closed":             { Icon: Lock,       label: "Encerrou o dia" },
  "ticket.called":           { Icon: Volume2,    label: "Chamou ticket" },
  "ticket.called_specific":  { Icon: Volume2,    label: "Chamou ticket (fora de ordem)" },
  "ticket.served":           { Icon: Check,      label: "Confirmou atendimento" },
  "ticket.removed":          { Icon: X,          label: "Removeu ticket" },
  "ticket.left_voluntarily": { Icon: LogOut,      label: "Cliente saiu da fila" },
  "ticket.recalled_counter": { Icon: RotateCcw,  label: "Chamou de volta (guichê)" },
  "ticket.readmitted_queue": { Icon: RotateCcw,  label: "Readmitiu na fila" },
};

const ROLE_LABELS = { owner: "Owner", admin: "Admin", operator: "Operador", client: "Cliente" };

/**
 * LogsModal — trilha de auditoria da sala (quem fez o quê e quando).
 * Visível apenas para Owner/Admin — controlado por QueueManagementScreen.
 */
const LogsModal = ({ open, onClose, logs }) => {
  return (
    <Modal open={open} onClose={onClose} maxWidth="640px">
      <h3 style={{ fontWeight: 700, marginBottom: "6px", fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
        <ScrollText size={17} /> Logs de Auditoria
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
        Visível apenas para Owner e Admin · {logs.length} registro{logs.length !== 1 ? "s" : ""}
      </p>

      {logs.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
          Nenhuma ação registrada ainda.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "60vh", overflowY: "auto" }}>
          {logs.map((log) => {
            const info = ACTION_INFO[log.action] || { Icon: Check, label: log.action };
            return (
              <div key={log.id} style={{ display: "flex", gap: "10px", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                <info.Icon size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span className="mono" style={{ fontSize: "11px", color: "var(--text-dim)", minWidth: "68px" }}>
                  {new Date(log.at).toLocaleTimeString("pt-BR")}
                </span>
                <span style={{ flex: 1, fontSize: "13px" }}>
                  {info.label}
                  {log.details?.name && <span style={{ color: "var(--text-muted)" }}> — {log.details.name}</span>}
                  {log.details?.counter && <span style={{ color: "var(--info)" }}> ({log.details.counter})</span>}
                </span>
                <span className="tag" style={{ background: "var(--surface-hover)", color: "var(--text-muted)", borderColor: "var(--border)", fontSize: "10px", whiteSpace: "nowrap" }}>
                  {log.actor.name} · {ROLE_LABELS[log.actor.role] || log.actor.role}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default LogsModal;
