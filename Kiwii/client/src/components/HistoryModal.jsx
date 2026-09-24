import { useState } from "react";
import { History, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Download } from "lucide-react";
import Modal from "./Modal";
import { exportToCSV, exportToJSON } from "../lib/export";

/**
 * HistoryModal — lista sessões/dias encerrados para comparação e exportação.
 * Compara cada sessão com a sessão anterior da MESMA sala (por nome).
 */
const HistoryModal = ({ open, onClose, history }) => {
  const [expandedId, setExpandedId] = useState(null);

  const withDelta = history.map((session, i) => {
    const previous = history
      .slice(i + 1)
      .find((h) => h.roomName === session.roomName);
    const delta = previous
      ? {
          served: session.totalServed - previous.totalServed,
          avgWait: parseFloat((session.avgWaitMinutes - previous.avgWaitMinutes).toFixed(1)),
        }
      : null;
    return { ...session, delta };
  });

  return (
    <Modal open={open} onClose={onClose} maxWidth="720px">
      <h3 style={{ fontWeight: 700, marginBottom: "6px", fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
        <History size={17} /> Histórico de Sessões
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
        Comparação com a sessão anterior da mesma sala
      </p>

      {withDelta.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
          Nenhuma sessão encerrada ainda.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "60vh", overflowY: "auto" }}>
          {withDelta.map((s) => {
            const isOpen = expandedId === s.id;
            const DeltaIcon = s.delta && s.delta.served >= 0 ? TrendingUp : TrendingDown;
            return (
              <div key={s.id} className="card" style={{ padding: "16px" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setExpandedId(isOpen ? null : s.id)}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "14px" }}>{s.roomName}</div>
                    <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {s.roomCode} · {new Date(s.date).toLocaleDateString("pt-BR")} {new Date(s.date).toLocaleTimeString("pt-BR")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div className="mono" style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent)" }}>{s.totalServed}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>atendidos</div>
                    </div>
                    {s.delta && (
                      <span className="mono" style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px", color: s.delta.served >= 0 ? "var(--success)" : "var(--danger)" }}>
                        <DeltaIcon size={13} /> {Math.abs(s.delta.served)}
                      </span>
                    )}
                    {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "14px" }}>
                      {[
                        { label: "Atendidos", value: s.totalServed, color: "var(--success)" },
                        { label: "Removidos", value: s.totalRemovedByHost ?? 0, color: "var(--danger)" },
                        { label: "Saíram", value: s.totalLeftVoluntarily ?? 0, color: "var(--warn)" },
                        { label: "Espera Média", value: `${s.avgWaitMinutes}min`, color: "var(--info)" },
                      ].map((st) => (
                        <div key={st.label} style={{ background: "var(--surface-hover)", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                          <div className="mono" style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase" }}>{st.label}</div>
                          <div className="mono" style={{ fontSize: "16px", fontWeight: 800, color: st.color }}>{st.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="btn" onClick={() => exportToCSV(s)} style={{ flex: 1, padding: "10px", fontSize: "12px" }}>
                        <Download size={13} /> CSV
                      </button>
                      <button className="btn" onClick={() => exportToJSON(s)} style={{ flex: 1, padding: "10px", fontSize: "12px" }}>
                        <Download size={13} /> JSON
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default HistoryModal;
