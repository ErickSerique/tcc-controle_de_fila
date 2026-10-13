import { useState, useEffect } from "react";
import {
  ArrowLeft, Monitor, History, ScrollText, AlertTriangle, X, Inbox,
  Volume2, Check, ClipboardList, RotateCcw, Plus, Download, Loader2,
} from "lucide-react";
import socket from "../lib/socket";
import { apiFetch } from "../lib/api";
import QRDisplay from "../components/QRDisplay";
import Modal from "../components/Modal";
import RecallModal from "../components/RecallModal";
import LogsModal from "../components/LogsModal";
import HistoryModal from "../components/HistoryModal";
import CustomFieldInput, { validateCustomFields } from "../components/CustomFieldInput";
import { exportToCSV, exportToJSON } from "../lib/export";

const PRIORITY_OPTIONS = [
  { value: 3, label: "Alta", color: "var(--danger)" },
  { value: 2, label: "Média", color: "var(--warn)" },
  { value: 1, label: "Baixa", color: "var(--success)" },
];
const getPriorityColor = (p) => (p === 3 ? "var(--danger)" : p === 2 ? "var(--warn)" : "var(--success)");

const STATUS_BADGE = {
  served:           { label: "Atendido", Icon: Check,     color: "var(--success)", bg: "var(--success-glow)" },
  removed_by_host:  { label: "Removido", Icon: X,         color: "var(--danger)",  bg: "var(--danger-glow)" },
  left_voluntarily: { label: "Saiu",     Icon: RotateCcw, color: "var(--warn)",    bg: "var(--warn-glow)" },
};

/** Lê a identidade do operador salva pelo HostSetupScreen. */
const getStaffIdentity = () => {
  try {
    return JSON.parse(sessionStorage.getItem("staff_identity")) || { name: "Operador", role: "operator" };
  } catch {
    return { name: "Operador", role: "operator" };
  }
};

const QueueManagementScreen = ({ roomCode, room, onCloseDay, onBack }) => {
  const staff = getStaffIdentity();
  const canViewLogs = staff.role === "owner" || staff.role === "admin";

  const [queue, setQueue] = useState([]);
  const [archive, setArchive] = useState([]);
  const [selectedCounter, setSelectedCounter] = useState(room.counters?.[0]?.name || "");

  const [manualModal, setManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ name: "", category: room.categories[0]?.name || "" });
  const [manualCustom, setManualCustom] = useState({});

  const [closeDayModal, setCloseDayModal] = useState(false);
  const [report, setReport] = useState(null);

  const [recallTarget, setRecallTarget] = useState(null);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);

  const [callLoading, setCallLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Socket ──────────────────────────────────────────────────
  useEffect(() => {
    const joinRoom = () => {
      socket.emit("host:join", { roomCode, actorName: staff.name, actorRole: staff.role });
    };

    if (socket.connected) joinRoom();
    socket.on("connect", joinRoom);

    const handleQueue = ({ roomCode: rc, queue: q }) => {
      if (rc?.toUpperCase() === roomCode?.toUpperCase()) setQueue([...q]);
    };
    const handleArchive = ({ roomCode: rc, archive: a }) => {
      if (rc?.toUpperCase() === roomCode?.toUpperCase()) setArchive([...a]);
    };
    const handleSocketError = ({ message }) => setError(message);

    socket.on("queue_update", handleQueue);
    socket.on("archive_update", handleArchive);
    socket.on("error", handleSocketError);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("queue_update", handleQueue);
      socket.off("archive_update", handleArchive);
      socket.off("error", handleSocketError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // ── Ações ───────────────────────────────────────────────────
  const callNext = () => {
    if (queue.length === 0 || callLoading) return;
    setCallLoading(true);
    socket.emit("host:call_next", { roomCode, counter: selectedCounter });
    setTimeout(() => setCallLoading(false), 600);
  };

  const callSpecificTicket = (token) => socket.emit("host:call_specific", { roomCode, token, counter: selectedCounter });
  const confirmServed = (token) => socket.emit("host:confirm_served", { roomCode, token });
  const removeTicket = (token) => socket.emit("host:remove", { roomCode, token });
  const changePriority = (token, priority) => socket.emit("host:priority", { roomCode, token, priority });

  const addManual = () => {
    if (!manualForm.name.trim()) { setError("Informe o nome do cliente."); return; }
    const err = validateCustomFields(room.customFields, manualCustom);
    if (err) { setError(err); return; }

    socket.emit("host:add_manual", { roomCode, name: manualForm.name.trim(), category: manualForm.category, customData: manualCustom });
    setManualForm({ name: "", category: room.categories[0]?.name || "" });
    setManualCustom({});
    setManualModal(false);
    setError("");
  };

  const handleRecall = (token, mode, counter) => {
    socket.emit("host:recall", { roomCode, token, mode, counter });
  };

  const fetchLogs = async () => {
    try {
      const data = await apiFetch(`/api/rooms/${roomCode}/logs`, { headers: { "X-Actor-Role": staff.role } });
      setLogs(data.logs);
      setLogsModalOpen(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await apiFetch("/api/rooms/meta/history");
      setHistoryData(data.history || []);
      setHistoryModalOpen(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const openMonitor = () => window.open(`/monitor/${roomCode}`, "_blank");

  const handleCloseDay = async () => {
    try {
      const data = await apiFetch(`/api/rooms/${roomCode}/close`, {
        method: "POST",
        headers: { "X-Actor-Name": staff.name, "X-Actor-Role": staff.role },
      });
      setReport(data.report);
      setCloseDayModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Derivados ───────────────────────────────────────────────
  const calledTickets = archive.filter((t) => t.status === "called");
  const registryTickets = archive.filter((t) => ["served", "removed_by_host", "left_voluntarily"].includes(t.status));
  const totalWait = queue.reduce((s, t) => s + t.tma, 0);
  const formatWait = (mins) => (mins === 0 ? "Agora" : `~${mins}min`);
  const categories = Array.isArray(room?.categories) ? room.categories : [];
  const counters = room?.counters?.length ? room.counters : [{ id: "default", name: "Guichê Único" }];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "16px 20px 40px", maxWidth: "1020px", margin: "0 auto" }}>
      {/* ── Top Bar ── */}
      <div className="animate-fade" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", paddingTop: "8px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span className="display" style={{ fontSize: "17px", fontWeight: 800 }}>Kiwi<span style={{ color: "var(--accent)" }}>i</span></span>
            <span className="tag">HOST</span>
            <span className="tag" style={{ background: "var(--surface-hover)", color: "var(--text-muted)", borderColor: "var(--border)" }}>
              {staff.name} · {staff.role === "owner" ? "Owner" : staff.role === "admin" ? "Admin" : "Operador"}
            </span>
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>{room.name}</div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" onClick={onBack} style={{ padding: "7px 14px", fontSize: "13px" }}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <div className="card" style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
            <span className="mono" style={{ fontSize: "14px", color: "var(--accent)", fontWeight: 600, letterSpacing: "0.15em" }}>{roomCode}</span>
          </div>
          <button className="btn" onClick={openMonitor} style={{ padding: "7px 14px", fontSize: "13px" }}>
            <Monitor size={14} /> Monitor
          </button>
          <button className="btn" onClick={fetchHistory} style={{ padding: "7px 14px", fontSize: "13px" }}>
            <History size={14} /> Histórico
          </button>
          {canViewLogs && (
            <button className="btn" onClick={fetchLogs} style={{ padding: "7px 14px", fontSize: "13px" }}>
              <ScrollText size={14} /> Logs
            </button>
          )}
          <button className="btn" onClick={handleCloseDay} style={{ padding: "7px 14px", fontSize: "13px", color: "var(--danger)", borderColor: "var(--danger-glow)" }}>
            Encerrar Dia
          </button>
        </div>
      </div>

      {error && (
        <div className="animate-fade" style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--danger-glow)", border: "1px solid var(--danger-glow)", borderRadius: "8px", padding: "10px 16px", color: "var(--danger)", fontSize: "13px", marginBottom: "16px", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><AlertTriangle size={15} /> {error}</span>
          <button onClick={() => setError("")} style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", display: "flex" }}><X size={16} /></button>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="animate-fade" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
        {[
          { label: "Na Fila", value: queue.length, color: "var(--accent)" },
          { label: "Em Atendim.", value: calledTickets.length, color: "var(--info)" },
          { label: "Atendidos Hoje", value: registryTickets.filter((t) => t.status === "served").length, color: "var(--success)" },
          { label: "Espera Máx", value: formatWait(totalWait), color: "var(--warn)" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "14px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
            <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── QR + Ações de chamada ── */}
      <div className="animate-fade" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "16px", marginBottom: "20px" }}>
        <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <QRDisplay code={roomCode} size={110} />
          <span className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.08em" }}>QR DA SALA</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <select className="input" value={selectedCounter} onChange={(e) => setSelectedCounter(e.target.value)} style={{ maxWidth: "180px" }}>
              {counters.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <button className="btn btn-primary" onClick={callNext} disabled={queue.length === 0 || callLoading}
              style={{ flex: 1, fontSize: "14px", minHeight: "48px" }}>
              {callLoading ? <><Loader2 size={16} className="spin" /> Chamando...</> : <><Volume2 size={16} /> Chamar Próximo</>}
            </button>
          </div>
          <button className="btn" onClick={() => setManualModal(true)} style={{ fontSize: "13px", minHeight: "44px" }}>
            <Plus size={15} /> Adicionar Manualmente
          </button>
        </div>
      </div>

      {/* ── Fila Ativa ── */}
      <div className="card animate-fade" style={{ overflow: "hidden", marginBottom: "20px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "15px" }}>Fila Ativa</h3>
          <span className="tag">{queue.length} aguardando</span>
        </div>

        {queue.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <Inbox size={32} style={{ marginBottom: "10px", opacity: 0.6 }} />
            <div style={{ fontWeight: 600 }}>Fila vazia</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["#", "Nome", "Categoria", "Prioridade", "Espera Est.", "Ações"].map((h) => (
                    <th key={h} className="mono" style={{ padding: "10px 14px", textAlign: "left", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((t, i) => (
                  <tr key={t.token} className="animate-slide" style={{ borderBottom: "1px solid var(--border)", animationDelay: `${i * 0.03}s`, background: i === 0 ? "var(--accent-light)" : "transparent" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <span className="mono" style={{ fontSize: "15px", fontWeight: 700, color: i === 0 ? "var(--accent)" : "var(--text-muted)" }}>{t.position}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</span>
                      {t.manual && <span className="tag" style={{ marginLeft: "8px", fontSize: "10px" }}>Manual</span>}
                    </td>
                    <td style={{ padding: "12px 14px" }}><span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t.category}</span></td>
                    <td style={{ padding: "12px 14px" }}>
                      <select className="mono" value={t.priority} onChange={(e) => changePriority(t.token, parseInt(e.target.value))}
                        style={{ background: "var(--surface)", border: `1px solid ${getPriorityColor(t.priority)}`, color: getPriorityColor(t.priority), borderRadius: "6px", padding: "4px 8px", fontSize: "12px", cursor: "pointer", outline: "none" }}>
                        {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "12px 14px" }}><span className="mono" style={{ fontSize: "13px", color: "var(--warn)" }}>{formatWait(t.estimatedWait || 0)}</span></td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="btn" onClick={() => callSpecificTicket(t.token)} style={{ padding: "6px 10px", fontSize: "12px" }}>Chamar</button>
                        <button className="btn" onClick={() => removeTicket(t.token)} style={{ padding: "6px", color: "var(--danger)", borderColor: "var(--danger-glow)" }} aria-label="Remover">
                          <X size={14} />
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

      {/* ── Em Atendimento ── */}
      {calledTickets.length > 0 && (
        <div className="card animate-fade" style={{ overflow: "hidden", marginBottom: "20px" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><Volume2 size={16} color="var(--info)" /> Em Atendimento</h3>
            <span className="tag" style={{ background: "var(--accent-light)", color: "var(--info)" }}>{calledTickets.length}</span>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {calledTickets.map((t) => (
              <div key={t.token} className="animate-slide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: "10px", background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.category} · {t.counter}</div>
                </div>
                <button className="btn" onClick={() => confirmServed(t.token)} style={{ background: "var(--success)", color: "#06231A", borderColor: "var(--success)", padding: "8px 14px", fontSize: "12px", fontWeight: 700 }}>
                  <Check size={14} /> Confirmar Atendimento
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Registro do Dia ── */}
      {registryTickets.length > 0 && (
        <div className="card animate-fade" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><ClipboardList size={16} /> Registro do Dia</h3>
            <span className="tag">{registryTickets.length}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Nome", "Categoria", "Status", "Guichê", "Horário", "Ações"].map((h) => (
                    <th key={h} className="mono" style={{ padding: "10px 14px", textAlign: "left", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registryTickets.map((t, i) => {
                  const badge = STATUS_BADGE[t.status] || { label: t.status, Icon: Check, color: "var(--text-muted)", bg: "transparent" };
                  const timeShown = t.servedAt || t.removedAt || t.leftAt || t.joinedAt;
                  return (
                    <tr key={t.token} className="animate-slide" style={{ borderBottom: "1px solid var(--border)", animationDelay: `${i * 0.02}s` }}>
                      <td style={{ padding: "12px 14px" }}><span style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</span></td>
                      <td style={{ padding: "12px 14px" }}><span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t.category}</span></td>
                      <td style={{ padding: "12px 14px" }}>
                        <span className="tag" style={{ background: badge.bg, color: badge.color, borderColor: badge.bg, fontSize: "11px" }}>
                          <badge.Icon size={11} /> {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}><span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t.counter || "—"}</span></td>
                      <td style={{ padding: "12px 14px" }}>
                        <span className="mono" style={{ fontSize: "12px", color: "var(--text-dim)" }}>{new Date(timeShown).toLocaleTimeString("pt-BR")}</span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <button className="btn" onClick={() => setRecallTarget(t)} style={{ padding: "6px 12px", fontSize: "12px" }}>
                          <RotateCcw size={13} /> Chamar de Volta
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Adicionar Manualmente ── */}
      <Modal open={manualModal} onClose={() => setManualModal(false)}>
        <h3 style={{ marginBottom: "18px" }}>Adicionar Manualmente</h3>
        <div style={{ marginBottom: "14px" }}>
          <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Nome do Cliente</label>
          <input className="input" placeholder="Nome completo" value={manualForm.name} onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })} autoFocus />
        </div>
        <div style={{ marginBottom: "14px" }}>
          <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Categoria</label>
          <select className="input" value={manualForm.category} onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}>
            {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {room.customFields?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
            {room.customFields.map((field) => (
              <CustomFieldInput key={field.id} field={field} value={manualCustom[field.id]} onChange={(v) => setManualCustom({ ...manualCustom, [field.id]: v })} />
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn" onClick={() => setManualModal(false)} style={{ flex: 1, padding: "12px" }}>Cancelar</button>
          <button className="btn btn-primary" onClick={addManual} style={{ flex: 2, padding: "12px", fontWeight: 700 }}>Adicionar à Fila</button>
        </div>
      </Modal>

      <RecallModal open={!!recallTarget} onClose={() => setRecallTarget(null)} ticket={recallTarget} counters={counters} onRecall={handleRecall} />
      <LogsModal open={logsModalOpen} onClose={() => setLogsModalOpen(false)} logs={logs} />
      <HistoryModal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} history={historyData} />

      {/* ── Modal: Encerrar Dia / Relatório ── */}
      <Modal open={closeDayModal} onClose={() => {}} maxWidth="500px">
        {report && (
          <>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "14px", background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <ClipboardList size={26} color="var(--accent)" />
              </div>
              <h2>Relatório da Sessão</h2>
              <p className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>{report.roomName} · {new Date(report.date).toLocaleDateString("pt-BR")}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              {[
                { label: "Atendidos", value: report.totalServed, color: "var(--success)" },
                { label: "Removidos", value: report.totalRemovedByHost, color: "var(--danger)" },
                { label: "Saíram", value: report.totalLeftVoluntarily, color: "var(--warn)" },
                { label: "Espera Média", value: `${report.avgWaitMinutes}min`, color: "var(--info)" },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--surface-hover)", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
                  <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px" }}>{s.label}</div>
                  <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              <button className="btn" onClick={() => exportToCSV(report)} style={{ padding: "14px", fontWeight: 700 }}><Download size={16} /> Baixar como .CSV</button>
              <button className="btn" onClick={() => exportToJSON(report)} style={{ padding: "14px", fontWeight: 700 }}><Download size={16} /> Baixar como .JSON</button>
            </div>
            <button className="btn" onClick={() => { setCloseDayModal(false); onCloseDay(); }} style={{ width: "100%", padding: "12px", color: "var(--danger)", borderColor: "var(--danger-glow)" }}>
              Encerrar e Voltar ao Início
            </button>
          </>
        )}
      </Modal>
    </div>
  );
};

export default QueueManagementScreen;
