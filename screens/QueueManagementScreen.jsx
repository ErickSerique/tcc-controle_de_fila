import { useState, useEffect } from "react";
import socket from "../lib/socket";
import QRDisplay from "../components/QRDisplay";
import Modal from "../components/Modal";
import { exportToCSV, exportToJSON } from "../lib/export";

const PRIORITY_OPTIONS = [
  { value: 3, label: "🔴 Alta", color: "var(--danger)" },
  { value: 2, label: "🟡 Média", color: "var(--warn)" },
  { value: 1, label: "🟢 Baixa", color: "var(--success)" },
];

const getPriorityColor = (p) =>
  p === 3 ? "var(--danger)" : p === 2 ? "var(--warn)" : "var(--success)";

const QueueManagementScreen = ({ roomCode, room, onCloseDay, onBack }) => {
  const [queue, setQueue] = useState([]);
  const [servedCount, setServedCount] = useState(0);
  const [manualModal, setManualModal] = useState(false);
  const [closeDayModal, setCloseDayModal] = useState(false);
  const [confirmCloseModal, setConfirmCloseModal] = useState(false);
  const [report, setReport] = useState(null);
  const [manualForm, setManualForm] = useState({ name: "", category: room.categories[0]?.name || "" });
  const [callLoading, setCallLoading] = useState(false);

  // ── Socket connection ─────────────────────────────────────
  useEffect(() => {
    socket.emit("host:join", { roomCode });

    const handleUpdate = ({ roomCode: rc, queue: q }) => {
      if (rc !== roomCode) return;
      setQueue([...q]);
    };

    socket.on("queue_update", handleUpdate);
    return () => socket.off("queue_update", handleUpdate);
  }, [roomCode]);

  // ── Actions ───────────────────────────────────────────────
  const callNext = () => {
    if (queue.length === 0 || callLoading) return;
    setCallLoading(true);
    socket.emit("host:call_next", { roomCode });
    setServedCount((c) => c + 1);
    setTimeout(() => setCallLoading(false), 800);
  };

  const removeTicket = (token) => {
    if (window.confirm("Tem certeza que deseja remover este cliente da fila?")) {
      socket.emit("host:remove", { roomCode, token });
    }
  };

  const changePriority = (token, priority) => {
    socket.emit("host:priority", { roomCode, token, priority });
  };

  const addManual = () => {
    if (!manualForm.name.trim()) return;
    socket.emit("host:add_manual", { roomCode, name: manualForm.name.trim(), category: manualForm.category });
    setManualForm({ name: "", category: room.categories[0]?.name || "" });
    setManualModal(false);
  };

  const handleCloseDay = async () => {
    setConfirmCloseModal(false);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/close`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.report);
      setCloseDayModal(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const totalWait = queue.reduce((s, t) => s + t.tma, 0);
  const nextName = queue[0]?.name?.split(" ")[0] || "—";

  const formatWait = (mins) => (mins === 0 ? "Agora" : `~${mins} min`);

  return (
    <div className="screen-container container-lg">
      {/* ── Top Bar ── */}
      <div className="animate-fade flex-row justify-between" style={{ marginBottom: "var(--space-2xl)", flexWrap: "wrap", gap: "var(--space-md)" }}>
        <div>
          <div className="flex-row gap-sm" style={{ marginBottom: "var(--space-xs)" }}>
            <span style={{ fontSize: "var(--text-xl)", fontWeight: 800 }}>
              fila<span className="text-accent">.io</span>
            </span>
            <span className="tag">HOST</span>
          </div>
          <div className="text-muted" style={{ fontSize: "var(--text-sm)" }}>Sala: {room.name}</div>
        </div>
        
        <div className="flex-row gap-md" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={onBack} aria-label="Voltar" style={{ minHeight: "40px", padding: "0 var(--space-md)" }}>
            <span aria-hidden="true">←</span> Voltar
          </button>
          
          <div className="card flex-row gap-sm" style={{ padding: "var(--space-xs) var(--space-lg)", borderRadius: "var(--radius-full)" }}>
            <span
              style={{
                width: "8px", height: "8px",
                borderRadius: "50%",
                background: "var(--success)",
                boxShadow: "0 0 8px var(--success)",
              }}
              aria-hidden="true"
            />
            <span className="mono text-accent" style={{ fontSize: "var(--text-md)", fontWeight: 700, letterSpacing: "0.15em" }}>
              CÓDIGO: {roomCode}
            </span>
          </div>
          
          <button
            className="btn btn-danger"
            onClick={() => setConfirmCloseModal(true)}
            style={{ minHeight: "40px", padding: "0 var(--space-md)" }}
          >
            Encerrar Dia
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="animate-fade grid responsive-grid-4 gap-md" style={{ marginBottom: "var(--space-2xl)" }}>
        {[
          { label: "Pessoas na Fila", value: queue.length, color: "var(--accent)" },
          { label: "Atendidos Hoje", value: servedCount, color: "var(--purple)" },
          { label: "Próximo Cliente", value: nextName, color: "var(--warn)" },
          { label: "Espera Máxima", value: formatWait(totalWait), color: "var(--info)" },
        ].map((s) => (
          <div key={s.label} className="card stat-card">
            <div className="stat-card-label">{s.label}</div>
            <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Action buttons & QR ── */}
      <div className="animate-fade grid responsive-grid-3 gap-lg" style={{ marginBottom: "var(--space-2xl)" }}>
        <div className="card text-center" style={{ gridColumn: "span 1" }}>
          <QRDisplay code={roomCode} size={160} />
          <div className="mono text-muted" style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-sm)", letterSpacing: "0.08em" }}>
            QR CODE DA SALA
          </div>
        </div>

        <div className="flex-col gap-md" style={{ gridColumn: "span 2", justifyContent: "center" }}>
          <button
            className="btn btn-primary"
            onClick={callNext}
            disabled={queue.length === 0 || callLoading}
            style={{ fontSize: "var(--text-xl)", minHeight: "80px", width: "100%" }}
            aria-label={queue.length > 0 ? "Chamar próximo cliente da fila" : "Fila vazia"}
          >
            {callLoading ? "📡 Chamando Painel..." : "📢 CHAMAR PRÓXIMO DA FILA"}
          </button>
          
          <button
            className="btn btn-secondary"
            onClick={() => setManualModal(true)}
            style={{ minHeight: "64px" }}
          >
            ➕ Adicionar Cliente Manualmente
          </button>
        </div>
      </div>

      {/* ── Queue Table ── */}
      <div className="card animate-fade" style={{ padding: 0, overflow: "hidden" }}>
        <div className="flex-row justify-between" style={{ padding: "var(--space-lg) var(--space-xl)", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Fila de Espera Ativa</h2>
          <span className="tag">{queue.length} aguardando</span>
        </div>

        {queue.length === 0 ? (
          <div className="text-center text-muted" style={{ padding: "var(--space-3xl)" }}>
            <div style={{ fontSize: "var(--text-4xl)", marginBottom: "var(--space-md)" }} aria-hidden="true">🎉</div>
            <h3 style={{ marginBottom: "var(--space-xs)" }}>A fila está vazia!</h3>
            <p>Nenhum cliente aguardando atendimento no momento.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  {["#", "Nome do Cliente", "Serviço", "Prioridade", "Espera Est.", "Ações"].map((h) => (
                    <th key={h} scope="col">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((t, i) => (
                  <tr
                    key={t.token}
                    className="animate-slide"
                    style={{
                      animationDelay: `${i * 0.03}s`,
                      background: i === 0 ? "var(--accent-light)" : "transparent",
                    }}
                  >
                    <td>
                      <span className="mono" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: i === 0 ? "var(--accent)" : "var(--text-muted)" }}>
                        {t.position}º
                      </span>
                    </td>
                    <td>
                      <div className="flex-row gap-sm">
                        <span style={{ fontWeight: 600, fontSize: "var(--text-md)" }}>{t.name}</span>
                        {t.manual && <span className="badge" style={{ background: "rgba(59, 130, 246, 0.1)", color: "var(--info)" }}>Manual</span>}
                      </div>
                    </td>
                    <td>
                      <span className="text-muted">{t.category}</span>
                    </td>
                    <td>
                      <select
                        className="input"
                        value={t.priority}
                        onChange={(e) => changePriority(t.token, parseInt(e.target.value))}
                        aria-label={`Prioridade para ${t.name}`}
                        style={{
                          minHeight: "36px",
                          padding: "var(--space-xs) var(--space-sm)",
                          border: `1px solid ${getPriorityColor(t.priority)}`,
                          color: getPriorityColor(t.priority),
                          fontWeight: 600,
                          width: "auto"
                        }}
                      >
                        {PRIORITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="mono text-warn" style={{ fontWeight: 600 }}>
                        {formatWait(t.estimatedWait || 0)}
                      </span>
                    </td>
                    <td>
                      <div className="flex-row gap-sm">
                        <button
                          className="btn btn-primary"
                          onClick={callNext}
                          disabled={i !== 0} // Only allow calling the first person directly from the row for logical consistency
                          style={{ minHeight: "36px", padding: "0 var(--space-md)" }}
                          aria-label={`Chamar ${t.name}`}
                        >
                          Chamar
                        </button>
                        <button
                          className="btn btn-danger btn-icon"
                          onClick={() => removeTicket(t.token)}
                          aria-label={`Remover ${t.name} da fila`}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Manual Add Modal ── */}
      <Modal open={manualModal} onClose={() => setManualModal(false)} titleId="manual-add-title">
        <h2 id="manual-add-title">➕ Adicionar Cliente Manualmente</h2>
        
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <label htmlFor="manual-name" className="label">Nome Completo do Cliente</label>
          <input
            id="manual-name"
            className="input"
            placeholder="Ex: Maria Oliveira"
            value={manualForm.name}
            onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
            autoFocus
          />
        </div>
        
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <label htmlFor="manual-category" className="label">Serviço Desejado</label>
          <select
            id="manual-category"
            className="input"
            value={manualForm.category}
            onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
          >
            {room.categories.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex-row gap-md">
          <button className="btn btn-secondary" onClick={() => setManualModal(false)} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={addManual} style={{ flex: 2 }}>
            Adicionar à Fila
          </button>
        </div>
      </Modal>

      {/* ── Confirm Close Day Modal ── */}
      <Modal open={confirmCloseModal} onClose={() => setConfirmCloseModal(false)} titleId="confirm-close-title">
         <h2 id="confirm-close-title" className="text-danger">⚠️ Encerrar Expediente</h2>
         <p>Tem certeza que deseja encerrar o dia? A sala será fechada, todos os clientes na fila serão removidos, e o relatório final será gerado.</p>
         <div className="flex-row gap-md" style={{ marginTop: "var(--space-xl)" }}>
            <button className="btn btn-secondary" onClick={() => setConfirmCloseModal(false)} style={{ flex: 1 }}>
               Cancelar
            </button>
            <button className="btn btn-danger" onClick={handleCloseDay} style={{ flex: 1 }}>
               Sim, Encerrar Dia
            </button>
         </div>
      </Modal>

      {/* ── Close Day / Report Modal ── */}
      <Modal open={closeDayModal} onClose={() => {}} maxWidth="600px" titleId="report-title">
        {report && (
          <div className="flex-col gap-lg">
            <div className="text-center">
              <div style={{ fontSize: "var(--text-5xl)", marginBottom: "var(--space-sm)" }} aria-hidden="true">📊</div>
              <h2 id="report-title">Relatório da Sessão</h2>
              <p className="mono text-muted">
                Sala: {report.roomName} · {new Date(report.date).toLocaleDateString("pt-BR")}
              </p>
            </div>

            <div className="grid responsive-grid-4 gap-md">
              {[
                { label: "Atendidos", value: report.totalServed, color: "var(--success)" },
                { label: "Abandonos", value: report.totalAbandoned, color: "var(--danger)" },
                { label: "Espera Média", value: `${report.avgWaitMinutes} min`, color: "var(--warn)" },
                { label: "Código", value: report.roomCode, color: "var(--purple)" },
              ].map((s) => (
                <div key={s.label} className="card stat-card" style={{ gridColumn: "span 2" }}>
                  <div className="stat-card-label">{s.label}</div>
                  <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="flex-col gap-md" style={{ margin: "var(--space-xl) 0" }}>
              <button className="btn btn-secondary" onClick={() => exportToCSV(report)}>
                📥 Baixar Relatório Completo (.CSV para Excel)
              </button>
              <button className="btn btn-ghost" onClick={() => exportToJSON(report)}>
                📥 Baixar Dados Técnicos (.JSON)
              </button>
            </div>

            <button
              className="btn btn-danger"
              onClick={() => { setCloseDayModal(false); onCloseDay(); }}
              style={{ width: "100%", minHeight: "56px" }}
            >
              Fechar Painel e Voltar ao Início
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QueueManagementScreen;