/**
 * screens/QueueManagementScreen.jsx
 *
 * Painel do host — gerencia a fila em tempo real via Socket.io.
 * Atualizado para usar o api.js centralizado e o contexto de auth.
 */
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import socket from "../lib/socket";
import { closeDay as closeDayApi, fetchHistory } from "../lib/api";
import QRDisplay from "../components/QRDisplay";
import Modal from "../components/Modal";
import { exportToCSV, exportToJSON } from "../lib/export";

const PRIORITY_OPTIONS = [
  { value: 3, label: "🔴 Alta",  color: "#F87171" },
  { value: 2, label: "🟡 Média", color: "#FCD34D" },
  { value: 1, label: "🟢 Baixa", color: "#6EE7B7" },
];
const getPriorityColor = (p) => p === 3 ? "#F87171" : p === 2 ? "#FCD34D" : "#6EE7B7";

const QueueManagementScreen = ({ roomCode, room, onCloseDay, onBack }) => {
  const { activeOrg } = useAuth();

  const [queue,        setQueue]        = useState([]);
  const [calledTickets, setCalledTickets] = useState([]);
  const [servedCount,  setServedCount]  = useState(0);
  const [manualModal,  setManualModal]  = useState(false);
  const [closeDayModal,setCloseDayModal]= useState(false);
  const [report,       setReport]       = useState(null);
  const [manualForm,   setManualForm]   = useState({ name: "", category: room.categories?.[0]?.name || "" });
  const [callLoading,  setCallLoading]  = useState(false);

  // ── Socket ────────────────────────────────────────────────────
  useEffect(() => {
    socket.emit("host:join", { roomCode });

    const handleUpdate = ({ roomCode: rc, queue: q }) => {
      if (rc !== roomCode) return;
      setQueue([...q]);
    };

    const handleTicketCalled = ({ roomCode: rc, ticket }) => {
      if (rc !== roomCode || !ticket) return;
      setCalledTickets((prev) => {
        if (prev.some((t) => t.token === ticket.token)) return prev;
        return [...prev, { ...ticket, calledAt: Date.now() }];
      });
    };

    const handleTicketServed = ({ roomCode: rc, token }) => {
      if (rc !== roomCode) return;
      setCalledTickets((prev) => prev.filter((t) => t.token !== token));
      setServedCount((c) => c + 1);
    };

    socket.on("queue_update", handleUpdate);
    socket.on("ticket_called", handleTicketCalled);
    socket.on("ticket_served", handleTicketServed);
    return () => {
      socket.off("queue_update", handleUpdate);
      socket.off("ticket_called", handleTicketCalled);
      socket.off("ticket_served", handleTicketServed);
    };
  }, [roomCode]);

  // ── Ações ─────────────────────────────────────────────────────
  const callNext = () => {
    if (queue.length === 0 || callLoading) return;
    setCallLoading(true);
    socket.emit("host:call_next", { roomCode });
    setTimeout(() => setCallLoading(false), 800);
  };

  const handleConfirmServed = (token) => {
    socket.emit("host:confirm_served", { roomCode, token });
  };

  const callSpecificTicket = (token) => {
    socket.emit("host:call_specific", { roomCode, token });
  };

  const removeTicket = (token) => socket.emit("host:remove", { roomCode, token });

  const changePriority = (token, priority) =>
    socket.emit("host:priority", { roomCode, token, priority });

  const addManual = () => {
    if (!manualForm.name.trim()) return;
    socket.emit("host:add_manual", { roomCode, name: manualForm.name.trim(), category: manualForm.category });
    setManualForm({ name: "", category: room.categories?.[0]?.name || "" });
    setManualModal(false);
  };

  const handleCloseDay = async () => {
    try {
      const data = await closeDayApi(activeOrg.id, roomCode);
      setReport(data.report);
      setCloseDayModal(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const totalWait = queue.reduce((s, t) => s + t.tma, 0);
  const nextName  = queue[0]?.name?.split(" ")[0] || "—";
  const formatWait = (mins) => mins === 0 ? "Agora" : `~${mins}min`;

  const categories = Array.isArray(room.categories)
    ? room.categories
    : JSON.parse(room.categories || "[]");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "16px 20px 40px", maxWidth: "960px", margin: "0 auto" }}>
      {/* ── Top Bar ── */}
      <div className="animate-fade" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", paddingTop: "8px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "2px" }}>
            <span style={{ fontSize: "18px", fontWeight: 800 }}>fila<span style={{ color: "var(--accent)" }}>.io</span></span>
            <span className="tag">{activeOrg?.name}</span>
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>{room.name}</div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="btn" onClick={onBack} style={{ fontSize: "13px" }}>← Voltar</button>
          <div className="card" style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)", display: "inline-block" }} />
            <span className="mono" style={{ fontSize: "14px", color: "var(--accent)", fontWeight: 600, letterSpacing: "0.15em" }}>{roomCode}</span>
          </div>
          <button className="btn" onClick={handleCloseDay} style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "13px" }}>
            Encerrar Dia
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="animate-fade" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
        {[
          { label: "Na Fila",       value: queue.length,             color: "var(--accent)" },
          { label: "Em Atendim.",   value: calledTickets.length,     color: "var(--warn)" },
          { label: "Atendidos",     value: servedCount,              color: "#A78BFA" },
          { label: "Espera Máx",    value: formatWait(totalWait),    color: "var(--info, #3b82f6)" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "14px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
            <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── QR + Ações ── */}
      <div className="animate-fade" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "16px", marginBottom: "20px" }}>
        <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <QRDisplay code={roomCode} size={110} />
          <span className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.08em" }}>QR DA SALA</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button className="btn" onClick={callNext} disabled={queue.length === 0 || callLoading} style={{
            flex: 1, minHeight: "56px", fontSize: "15px", fontWeight: 800,
            background: queue.length > 0 && !callLoading ? "linear-gradient(135deg, var(--accent), #818cf8)" : "var(--surface-hover)",
            color:      queue.length > 0 && !callLoading ? "#fff"  : "var(--text-dim)",
            border:     "none", borderRadius: "12px", cursor: queue.length > 0 && !callLoading ? "pointer" : "not-allowed",
            boxShadow:  queue.length > 0 && !callLoading ? "0 8px 24px var(--accent-glow)" : "none", transition: "all 0.3s",
          }}>
            {callLoading ? "📡 Chamando..." : "📢 Chamar Próximo"}
          </button>
          <button className="btn" onClick={() => setManualModal(true)} style={{ flex: 1, minHeight: "44px", fontSize: "14px", fontWeight: 600, background: "rgba(59,130,246,0.08)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "10px" }}>
            ➕ Adicionar Manualmente
          </button>
        </div>
      </div>

      {/* ── Tabela da Fila ── */}
      <div className="card animate-fade" style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontWeight: 700, fontSize: "15px" }}>Fila Ativa</h3>
          <span className="tag">{queue.length} aguardando</span>
        </div>

        {queue.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎉</div>
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>Fila vazia!</div>
            <div style={{ fontSize: "13px" }}>Aguardando novos clientes...</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["#", "Nome", "Categoria", "Prioridade", "Espera Est.", "Ações"].map((h) => (
                    <th key={h} className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((t, i) => (
                  <tr key={t.token} className="animate-slide" style={{ borderBottom: "1px solid var(--border)", animationDelay: `${i * 0.03}s`, background: i === 0 ? "rgba(99,102,241,0.04)" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = i === 0 ? "rgba(99,102,241,0.04)" : "transparent"}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <span className="mono" style={{ fontSize: "16px", fontWeight: 700, color: i === 0 ? "var(--accent)" : "var(--text-muted)" }}>{t.position}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</span>
                        {t.manual && <span className="tag" style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", fontSize: "10px" }}>Manual</span>}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}><span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t.category}</span></td>
                    <td style={{ padding: "14px 16px" }}>
                      <select className="mono" value={t.priority} onChange={(e) => changePriority(t.token, parseInt(e.target.value))} style={{ background: "var(--surface)", border: `1px solid ${getPriorityColor(t.priority)}44`, color: getPriorityColor(t.priority), borderRadius: "6px", padding: "4px 8px", fontSize: "12px", cursor: "pointer", outline: "none" }}>
                        {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "14px 16px" }}><span className="mono" style={{ fontSize: "13px", color: "var(--warn)" }}>{formatWait(t.estimatedWait || 0)}</span></td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="btn" onClick={() => callSpecificTicket(t.token)} style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent-dim)", padding: "6px 12px", borderRadius: "6px", fontSize: "12px" }}>Chamar</button>
                        <button className="btn" onClick={() => removeTicket(t.token)} style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.2)", padding: "6px 10px", borderRadius: "6px", fontSize: "12px" }} aria-label="Remover">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Em Atendimento ── */}
      {calledTickets.length > 0 && (
        <div className="card animate-fade" style={{ overflow: "hidden", marginBottom: "20px" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontWeight: 700, fontSize: "15px" }}>🔔 Em Atendimento</h3>
            <span className="tag" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warn)", borderColor: "rgba(245,158,11,0.3)" }}>{calledTickets.length} chamado{calledTickets.length > 1 ? "s" : ""}</span>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {calledTickets.map((t) => (
              <div key={t.token} className="animate-slide" style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: "10px",
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.15)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "22px" }}>📢</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {t.category} · Chamado {t.calledAt ? `há ${Math.max(1, Math.round((Date.now() - t.calledAt) / 60000))}min` : "agora"}
                    </div>
                  </div>
                </div>
                <button
                  className="btn"
                  onClick={() => handleConfirmServed(t.token)}
                  style={{
                    background: "linear-gradient(135deg, #10b981, #34d399)",
                    color: "#fff", border: "none", borderRadius: "8px",
                    padding: "8px 16px", fontSize: "12px", fontWeight: 700,
                    boxShadow: "0 4px 12px rgba(16,185,129,0.25)",
                  }}
                >
                  ✓ Confirmar Atendimento
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: Adicionar Manual ── */}
      <Modal open={manualModal} onClose={() => setManualModal(false)}>
        <h3 style={{ fontWeight: 700, marginBottom: "20px", fontSize: "18px" }}>➕ Adicionar Manualmente</h3>
        <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Nome do Cliente</label>
        <input className="input" placeholder="Nome completo" value={manualForm.name} onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addManual()} autoFocus style={{ marginBottom: "14px" }} />
        <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Categoria</label>
        <select className="input" value={manualForm.category} onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })} style={{ marginBottom: "24px" }}>
          {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn" onClick={() => setManualModal(false)} style={{ flex: 1, padding: "14px" }}>Cancelar</button>
          <button className="btn" onClick={addManual} style={{ flex: 2, padding: "14px", background: "linear-gradient(135deg, var(--accent), #818cf8)", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 800 }}>Adicionar à Fila</button>
        </div>
      </Modal>

      {/* ── Modal: Relatório de Encerramento ── */}
      <Modal open={closeDayModal} onClose={() => {}} maxWidth="500px">
        {report && (
          <>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{ fontSize: "52px", marginBottom: "12px" }}>📊</div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "4px" }}>Relatório da Sessão</h2>
              <p className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                {report.room_name} · {new Date(report.generated_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
              {[
                { label: "Atendidos",   value: report.total_served,     color: "var(--accent)" },
                { label: "Abandonos",   value: report.total_abandoned,   color: "var(--danger)" },
                { label: "Espera Média",value: `${report.avg_wait_minutes}min`, color: "var(--warn)" },
                { label: "Sala",        value: report.room_code,         color: "#A78BFA" },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--surface-hover)", borderRadius: "10px", padding: "16px", textAlign: "center" }}>
                  <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>{s.label}</div>
                  <div className="mono" style={{ fontSize: "26px", fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              <button className="btn" onClick={() => exportToCSV(report)} style={{ padding: "14px", background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent-dim)", borderRadius: "10px", fontSize: "14px", fontWeight: 700 }}>📥 Baixar como .CSV</button>
              <button className="btn" onClick={() => exportToJSON(report)} style={{ padding: "14px", background: "rgba(167,139,250,0.08)", color: "#A78BFA", border: "1px solid rgba(167,139,250,0.25)", borderRadius: "10px", fontSize: "14px", fontWeight: 700 }}>📥 Baixar como .JSON</button>
            </div>
            <button className="btn" onClick={() => { setCloseDayModal(false); onCloseDay(); }} style={{ width: "100%", padding: "12px", background: "rgba(239,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", fontSize: "13px" }}>
              Encerrar e Voltar ao Início
            </button>
          </>
        )}
      </Modal>
    </div>
  );
};

export default QueueManagementScreen;
