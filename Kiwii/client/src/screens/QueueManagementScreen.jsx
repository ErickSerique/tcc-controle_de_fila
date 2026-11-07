import { useState, useEffect } from "react";
<<<<<<< Updated upstream
=======
import {
  ArrowLeft,
  Monitor,
  History,
  ScrollText,
  AlertTriangle,
  X,
  Inbox,
  Volume2,
  Check,
  ClipboardList,
  RotateCcw,
  Plus,
  Download,
  Loader2,
  Lock,
  Unlock,
  Building,
  UserCheck,
} from "lucide-react";
>>>>>>> Stashed changes
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
  { value: 3, label: "🔴 Alta", color: "#F87171" },
  { value: 2, label: "🟡 Média", color: "#FCD34D" },
  { value: 1, label: "🟢 Baixa", color: "#6EE7B7" },
];
<<<<<<< Updated upstream
const getPriorityColor = (p) => (p === 3 ? "#F87171" : p === 2 ? "#FCD34D" : "#6EE7B7");

const STATUS_BADGE = {
  served:           { label: "✅ Atendido", color: "var(--accent)", bg: "rgba(110,231,183,0.1)" },
  removed_by_host:  { label: "❌ Removido", color: "var(--danger)", bg: "#7f1d1d33" },
  left_voluntarily: { label: "🚪 Saiu",     color: "var(--warn)",   bg: "#78350f33" },
};

/** Lê a identidade do operador salva pelo HostSetupScreen. */
const getStaffIdentity = () => {
  try {
    return JSON.parse(sessionStorage.getItem("staff_identity")) || { name: "Operador", role: "operator" };
  } catch {
    return { name: "Operador", role: "operator" };
  }
=======
const getPriorityColor = (p) =>
  p === 3 ? "var(--danger)" : p === 2 ? "var(--warn)" : "var(--success)";

const STATUS_BADGE = {
  served: { label: "Atendido", Icon: Check, color: "var(--success)", bg: "var(--success-glow)" },
  removed_by_host: { label: "Removido", Icon: X, color: "var(--danger)", bg: "var(--danger-glow)" },
  left_voluntarily: { label: "Saiu", Icon: RotateCcw, color: "var(--warn)", bg: "var(--warn-glow)" },
>>>>>>> Stashed changes
};

const QueueManagementScreen = ({ roomCode, room, onCloseDay, onBack }) => {
  const staff = getStaffIdentity();
  const canViewLogs = staff.role === "owner" || staff.role === "admin";

  const [queue, setQueue] = useState([]);
  const [archive, setArchive] = useState([]);
  const [counters, setCounters] = useState(
    room?.counters?.length ? room.counters : [{ id: "default", name: "Guichê Único" }]
  );
  const [counterClaims, setCounterClaims] = useState({});
  const [myCounter, setMyCounter] = useState(null); // { id, name }
  const [counterModalOpen, setCounterModalOpen] = useState(false);

  const [locked, setLocked] = useState(!!room?.locked);

  const [manualModal, setManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: "",
    category: room?.categories?.[0]?.name || "",
  });
  const [manualCustom, setManualCustom] = useState({});

  // Modais de encerramento
  const [confirmCloseModalOpen, setConfirmCloseModalOpen] = useState(false);
  const [closeDayModal, setCloseDayModal] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
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

    if (socket.connected) {
      joinRoom();
    }
    socket.on("connect", joinRoom);

    const handleQueue = ({ roomCode: rc, queue: q }) => {
      if (rc?.toUpperCase() === roomCode?.toUpperCase()) setQueue([...q]);
    };
    const handleArchive = ({ roomCode: rc, archive: a }) => {
      if (rc?.toUpperCase() === roomCode?.toUpperCase()) setArchive([...a]);
    };
    const handleCounters = ({ roomCode: rc, counterClaims: claims }) => {
      if (rc?.toUpperCase() === roomCode?.toUpperCase()) setCounterClaims(claims || {});
    };
    const handleRoomStatus = ({ roomCode: rc, locked: isLocked }) => {
      if (rc?.toUpperCase() === roomCode?.toUpperCase()) setLocked(!!isLocked);
    };
    const handleYouAre = ({ counters: roomCounters, claimedCounterId, claimedCounterName }) => {
      if (roomCounters?.length) setCounters(roomCounters);
      if (claimedCounterId) {
        setMyCounter({ id: claimedCounterId, name: claimedCounterName });
      } else if (roomCounters?.length > 1) {
        setCounterModalOpen(true);
      }
    };
    const handleCounterClaimed = ({ counterId, counterName }) => {
      setMyCounter({ id: counterId, name: counterName });
      setCounterModalOpen(false);
    };
    const handleSocketError = ({ message }) => setError(message);

    socket.on("queue_update", handleQueue);
    socket.on("archive_update", handleArchive);
    socket.on("counters_update", handleCounters);
    socket.on("room_status", handleRoomStatus);
    socket.on("you_are", handleYouAre);
    socket.on("counter_claimed", handleCounterClaimed);
    socket.on("error", handleSocketError);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("queue_update", handleQueue);
      socket.off("archive_update", handleArchive);
      socket.off("counters_update", handleCounters);
      socket.off("room_status", handleRoomStatus);
      socket.off("you_are", handleYouAre);
      socket.off("counter_claimed", handleCounterClaimed);
      socket.off("error", handleSocketError);
    };
<<<<<<< Updated upstream
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);
=======
  }, [roomCode, user?.id]);
>>>>>>> Stashed changes

  // ── Ações de Fila e Guichê ──────────────────────────────────
  const claimCounterAction = (counterId) => {
    socket.emit("host:claim_counter", { roomCode, counterId });
  };

  const toggleLock = () => {
    socket.emit("host:toggle_lock", { roomCode, locked: !locked });
  };

  const callNext = () => {
    if (queue.length === 0 || callLoading) return;
    if (counters.length > 1 && !myCounter) {
      setCounterModalOpen(true);
      setError("Escolha um guichê antes de chamar.");
      return;
    }
    setCallLoading(true);
    socket.emit("host:call_next", { roomCode });
    setTimeout(() => setCallLoading(false), 600);
  };

  const callSpecificTicket = (token) => {
    if (counters.length > 1 && !myCounter) {
      setCounterModalOpen(true);
      setError("Escolha um guichê antes de chamar.");
      return;
    }
    socket.emit("host:call_specific", { roomCode, token });
  };

  const confirmServed = (token) => socket.emit("host:confirm_served", { roomCode, token });
  const removeTicket = (token) => socket.emit("host:remove", { roomCode, token });
  const changePriority = (token, priority) =>
    socket.emit("host:priority", { roomCode, token, priority });

  const addManual = () => {
    if (!manualForm.name.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    const err = validateCustomFields(room.customFields, manualCustom);
    if (err) {
      setError(err);
      return;
    }

    socket.emit("host:add_manual", {
      roomCode,
      name: manualForm.name.trim(),
      category: manualForm.category,
      customData: manualCustom,
    });
    setManualForm({ name: "", category: room.categories[0]?.name || "" });
    setManualCustom({});
    setManualModal(false);
    setError("");
  };

  const handleRecall = (token, mode) => {
    if (mode === "counter" && counters.length > 1 && !myCounter) {
      setCounterModalOpen(true);
      setError("Escolha um guichê antes de chamar.");
      return;
    }
    socket.emit("host:recall", { roomCode, token, mode });
  };

  const fetchLogs = async () => {
    try {
<<<<<<< Updated upstream
      const data = await apiFetch(`/api/rooms/${roomCode}/logs`, { headers: { "X-Actor-Role": staff.role } });
      setLogs(data.logs);
=======
      const data = await apiFetch(`/api/rooms/${roomCode}/logs`, {
        orgId: room.orgId || activeOrg?.id,
      });
      setLogs(data.logs || []);
>>>>>>> Stashed changes
      setLogsModalOpen(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchHistory = async () => {
    try {
<<<<<<< Updated upstream
      const data = await apiFetch("/api/rooms/meta/history");
=======
      const targetOrgId = room.orgId || activeOrg?.id;
      const data = await apiFetch("/api/rooms/meta/history", { orgId: targetOrgId });
>>>>>>> Stashed changes
      setHistoryData(data.history || []);
      setHistoryModalOpen(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const openMonitor = () => window.open(`/monitor/${roomCode}`, "_blank");

<<<<<<< Updated upstream
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
=======
  // ── Encerramento do Dia (Priority 2) ─────────────────────────
>>>>>>> Stashed changes
  const calledTickets = archive.filter((t) => t.status === "called");
  const registryTickets = archive.filter((t) =>
    ["served", "removed_by_host", "left_voluntarily"].includes(t.status)
  );
  const totalWait = queue.reduce((s, t) => s + t.tma, 0);
  const formatWait = (mins) => (mins === 0 ? "Agora" : `~${mins}min`);
  const categories = Array.isArray(room?.categories) ? room.categories : [];

  const canCloseDay = queue.length === 0 && calledTickets.length === 0;

  const handleExecuteCloseDay = async () => {
    setClosingDay(true);
    try {
      const data = await apiFetch(`/api/rooms/${roomCode}/close`, { method: "POST" });
      setReport(data.report);
      setConfirmCloseModalOpen(false);
      setCloseDayModal(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setClosingDay(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "16px 20px 40px",
        maxWidth: "1040px",
        margin: "0 auto",
      }}
    >
      {/* ── Top Bar ── */}
      <div
        className="animate-fade"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          paddingTop: "8px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
<<<<<<< Updated upstream
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "18px", fontWeight: 800 }}>fila<span style={{ color: "var(--accent)" }}>.io</span></span>
            <span className="tag" style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent-dim)" }}>HOST</span>
            <span className="tag" style={{ background: "rgba(167,139,250,0.1)", color: "var(--purple)" }}>
              {staff.name} · {staff.role === "owner" ? "Owner" : staff.role === "admin" ? "Admin" : "Operador"}
=======
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "4px",
              flexWrap: "wrap",
            }}
          >
            <span className="display" style={{ fontSize: "17px", fontWeight: 800 }}>
              Kiwi<span style={{ color: "var(--accent)" }}>i</span>
>>>>>>> Stashed changes
            </span>
            <span className="tag">HOST</span>
            <span
              className="tag"
              style={{
                background: "var(--surface-hover)",
                color: "var(--text-muted)",
                borderColor: "var(--border)",
              }}
            >
              {staff.name} · {staff.role === "owner" ? "Dono" : staff.role === "admin" ? "Admin" : "Operador"}
            </span>

            {/* Guichê Indicador / Seletor */}
            {counters.length > 1 && (
              <button
                className="btn"
                onClick={() => setCounterModalOpen(true)}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  gap: "6px",
                  background: myCounter ? "var(--surface)" : "var(--warn-glow)",
                  borderColor: myCounter ? "var(--border)" : "var(--warn)",
                  color: myCounter ? "var(--text)" : "var(--warn)",
                  fontWeight: 600,
                }}
              >
                <Building size={13} />
                {myCounter ? `Seu Guichê: ${myCounter.name}` : "⚠️ Selecionar Guichê"}
              </button>
            )}
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>{room.name}</div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
<<<<<<< Updated upstream
          <button className="btn" onClick={onBack} style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", padding: "7px 14px", borderRadius: "8px", fontSize: "13px" }}>
            ← Voltar
          </button>
          <div className="card" style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
            <span className="mono" style={{ fontSize: "14px", color: "var(--accent)", fontWeight: 600, letterSpacing: "0.15em" }}>{roomCode}</span>
          </div>
          <button className="btn" onClick={openMonitor} style={{ background: "rgba(96,165,250,0.08)", color: "var(--info)", border: "1px solid rgba(96,165,250,0.25)", padding: "7px 14px", borderRadius: "8px", fontSize: "13px" }}>
            📺 Monitor
          </button>
          <button className="btn" onClick={fetchHistory} style={{ background: "rgba(167,139,250,0.08)", color: "var(--purple)", border: "1px solid rgba(167,139,250,0.25)", padding: "7px 14px", borderRadius: "8px", fontSize: "13px" }}>
            📊 Histórico
=======
          <button className="btn" onClick={onBack} style={{ padding: "7px 14px", fontSize: "13px" }}>
            <ArrowLeft size={14} /> Início
          </button>
          <div
            className="card"
            style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
            <span
              className="mono"
              style={{
                fontSize: "14px",
                color: "var(--accent)",
                fontWeight: 600,
                letterSpacing: "0.15em",
              }}
            >
              {roomCode}
            </span>
          </div>

          <button className="btn" onClick={openMonitor} style={{ padding: "7px 14px", fontSize: "13px" }}>
            <Monitor size={14} /> Monitor
          </button>

          <button className="btn" onClick={fetchHistory} style={{ padding: "7px 14px", fontSize: "13px" }}>
            <History size={14} /> Histórico
>>>>>>> Stashed changes
          </button>

          {canViewLogs && (
            <button className="btn" onClick={fetchLogs} style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)", padding: "7px 14px", borderRadius: "8px", fontSize: "13px" }}>
              📜 Logs
            </button>
          )}
<<<<<<< Updated upstream
          <button className="btn" onClick={handleCloseDay} style={{ background: "#7f1d1d44", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.3)", padding: "7px 14px", borderRadius: "8px", fontSize: "13px" }}>
=======

          {/* Botão Trancar / Destrancar Fila (Priority 8) */}
          <button
            className="btn"
            onClick={toggleLock}
            style={{
              padding: "7px 14px",
              fontSize: "13px",
              gap: "6px",
              background: locked ? "var(--warn-glow)" : "transparent",
              borderColor: locked ? "var(--warn)" : "var(--border)",
              color: locked ? "var(--warn)" : "var(--text)",
              fontWeight: locked ? 700 : 500,
            }}
          >
            {locked ? (
              <>
                <Unlock size={14} /> Destrancar Fila
              </>
            ) : (
              <>
                <Lock size={14} /> Trancar Fila
              </>
            )}
          </button>

          {/* Botão Encerrar Dia (Priority 2) */}
          <button
            className="btn"
            onClick={() => setConfirmCloseModalOpen(true)}
            style={{
              padding: "7px 14px",
              fontSize: "13px",
              color: "var(--danger)",
              borderColor: "var(--danger-glow)",
              background: "transparent",
            }}
          >
>>>>>>> Stashed changes
            Encerrar Dia
          </button>
        </div>
      </div>

      {/* ── Aviso de Fila Trancada (Priority 8) ── */}
      {locked && (
        <div
          className="animate-fade"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid var(--warn)",
            borderRadius: "8px",
            padding: "12px 18px",
            color: "var(--warn)",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          <Lock size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Fila trancada:</strong> Novos clientes não podem entrar via aplicativo ou QR Code.
            Novas senhas manuais ainda podem ser adicionadas pelo balcão.
          </div>
        </div>
      )}

      {error && (
<<<<<<< Updated upstream
        <div className="animate-fade" style={{ background: "#7f1d1d44", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "8px", padding: "10px 16px", color: "var(--danger)", fontSize: "13px", marginBottom: "16px", display: "flex", justifyContent: "space-between" }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer" }}>×</button>
=======
        <div
          className="animate-fade"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--danger-glow)",
            border: "1px solid var(--danger-glow)",
            borderRadius: "8px",
            padding: "10px 16px",
            color: "var(--danger)",
            fontSize: "13px",
            marginBottom: "16px",
            justifyContent: "space-between",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={15} /> {error}
          </span>
          <button
            onClick={() => setError("")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--danger)",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <X size={16} />
          </button>
>>>>>>> Stashed changes
        </div>
      )}

      {/* ── Stats ── */}
      <div
        className="animate-fade"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        {[
          { label: "Na Fila", value: queue.length, color: "var(--accent)" },
          { label: "Em Atendim.", value: calledTickets.length, color: "var(--info)" },
<<<<<<< Updated upstream
          { label: "Atendidos Hoje", value: registryTickets.filter((t) => t.status === "served").length, color: "var(--purple)" },
=======
          {
            label: "Atendidos Hoje",
            value: registryTickets.filter((t) => t.status === "served").length,
            color: "var(--success)",
          },
>>>>>>> Stashed changes
          { label: "Espera Máx", value: formatWait(totalWait), color: "var(--warn)" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "14px", textAlign: "center" }}>
            <div
              className="mono"
              style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {s.label}
            </div>
            <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── QR + Ações de chamada ── */}
      <div
        className="animate-fade"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div
          className="card"
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <QRDisplay code={roomCode} size={110} />
          <span
            className="mono"
            style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.08em" }}
          >
            QR DA SALA
          </span>
        </div>

<<<<<<< Updated upstream
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <select className="input" value={selectedCounter} onChange={(e) => setSelectedCounter(e.target.value)} style={{ maxWidth: "180px" }}>
              {counters.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <button className="btn" onClick={callNext} disabled={queue.length === 0 || callLoading}
              style={{ flex: 1, background: queue.length > 0 && !callLoading ? "linear-gradient(135deg, var(--accent), #34d399)" : "#1e293b", color: queue.length > 0 && !callLoading ? "#022c22" : "var(--text-dim)", borderRadius: "10px", fontSize: "14px", fontWeight: 800, minHeight: "48px" }}>
              {callLoading ? "📡 Chamando..." : "📢 Chamar Próximo"}
            </button>
          </div>
          <button className="btn" onClick={() => setManualModal(true)}
            style={{ background: "rgba(96,165,250,0.08)", color: "var(--info)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: "10px", fontSize: "13px", fontWeight: 600, minHeight: "44px" }}>
            ➕ Adicionar Manualmente
          </button>
=======
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", justifyContent: "center" }}>
          {/* Card do Guichê do Operador */}
          <div
            className="card"
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <UserCheck size={16} color="var(--accent)" />
              <span style={{ fontSize: "13px" }}>
                Operando no guichê:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {myCounter?.name || (counters.length === 1 ? counters[0].name : "Nenhum guichê escolhido")}
                </strong>
              </span>
            </div>
            {counters.length > 1 && (
              <button
                className="btn"
                onClick={() => setCounterModalOpen(true)}
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                Trocar Guichê
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn btn-primary"
              onClick={callNext}
              disabled={queue.length === 0 || callLoading}
              style={{ flex: 1, fontSize: "15px", minHeight: "48px", fontWeight: 700 }}
            >
              {callLoading ? (
                <>
                  <Loader2 size={16} className="spin" /> Chamando...
                </>
              ) : (
                <>
                  <Volume2 size={17} /> Chamar Próximo
                </>
              )}
            </button>
            <button
              className="btn"
              onClick={() => setManualModal(true)}
              style={{ fontSize: "13px", minHeight: "48px", padding: "0 18px" }}
            >
              <Plus size={15} /> Adicionar Manualmente
            </button>
          </div>
>>>>>>> Stashed changes
        </div>
      </div>

      {/* ── Fila Ativa ── */}
      <div className="card animate-fade" style={{ overflow: "hidden", marginBottom: "20px" }}>
<<<<<<< Updated upstream
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontWeight: 700, fontSize: "15px" }}>Fila Ativa</h3>
          <span className="tag" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>{queue.length} aguardando</span>
=======
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ fontSize: "15px" }}>Fila Ativa</h3>
          <span className="tag">{queue.length} aguardando</span>
>>>>>>> Stashed changes
        </div>

        {queue.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>🎉</div>
            <div style={{ fontWeight: 600 }}>Fila vazia!</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["#", "Nome", "Categoria", "Prioridade", "Espera Est.", "Ações"].map((h) => (
                    <th
                      key={h}
                      className="mono"
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((t, i) => (
<<<<<<< Updated upstream
                  <tr key={t.token} className="animate-slide" style={{ borderBottom: "1px solid var(--border)", animationDelay: `${i * 0.03}s`, background: i === 0 ? "rgba(110,231,183,0.04)" : "transparent" }}>
=======
                  <tr
                    key={t.token}
                    className="animate-slide"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      animationDelay: `${i * 0.03}s`,
                      background: i === 0 ? "var(--accent-light)" : "transparent",
                    }}
                  >
>>>>>>> Stashed changes
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: i === 0 ? "var(--accent)" : "var(--text-muted)",
                        }}
                      >
                        {t.position}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</span>
<<<<<<< Updated upstream
                      {t.manual && <span className="tag" style={{ marginLeft: "8px", background: "rgba(96,165,250,0.12)", color: "var(--info)", fontSize: "10px" }}>Manual</span>}
=======
                      {t.manual && (
                        <span className="tag" style={{ marginLeft: "8px", fontSize: "10px" }}>
                          Manual
                        </span>
                      )}
>>>>>>> Stashed changes
                    </td>
                    <td style={{ padding: "12px 14px" }}>
<<<<<<< Updated upstream
                      <select className="mono" value={t.priority} onChange={(e) => changePriority(t.token, parseInt(e.target.value))}
                        style={{ background: "var(--surface)", border: `1px solid ${getPriorityColor(t.priority)}44`, color: getPriorityColor(t.priority), borderRadius: "6px", padding: "4px 8px", fontSize: "12px", cursor: "pointer", outline: "none" }}>
                        {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
=======
                      <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t.category}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <select
                        className="mono"
                        value={t.priority}
                        onChange={(e) => changePriority(t.token, parseInt(e.target.value))}
                        style={{
                          background: "var(--surface)",
                          border: `1px solid ${getPriorityColor(t.priority)}`,
                          color: getPriorityColor(t.priority),
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "12px",
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        {PRIORITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
>>>>>>> Stashed changes
                      </select>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span className="mono" style={{ fontSize: "13px", color: "var(--warn)" }}>
                        {formatWait(t.estimatedWait || 0)}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
<<<<<<< Updated upstream
                        <button className="btn" onClick={() => callSpecificTicket(t.token)} style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent-dim)", padding: "6px 10px", borderRadius: "6px", fontSize: "12px" }}>Chamar</button>
                        <button className="btn" onClick={() => removeTicket(t.token)} style={{ background: "#7f1d1d44", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.2)", padding: "6px 10px", borderRadius: "6px", fontSize: "12px" }} aria-label="Remover">✕</button>
=======
                        <button
                          className="btn"
                          onClick={() => callSpecificTicket(t.token)}
                          style={{ padding: "6px 10px", fontSize: "12px" }}
                        >
                          Chamar
                        </button>
                        <button
                          className="btn"
                          onClick={() => removeTicket(t.token)}
                          style={{ padding: "6px", color: "var(--danger)", borderColor: "var(--danger-glow)" }}
                          aria-label="Remover"
                        >
                          <X size={14} />
                        </button>
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontWeight: 700, fontSize: "15px" }}>🔔 Em Atendimento</h3>
            <span className="tag" style={{ background: "rgba(96,165,250,0.12)", color: "var(--info)" }}>{calledTickets.length}</span>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {calledTickets.map((t) => (
              <div key={t.token} className="animate-slide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: "10px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "20px" }}>📢</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.category} · {t.counter}</div>
                  </div>
                </div>
                <button className="btn" onClick={() => confirmServed(t.token)} style={{ background: "linear-gradient(135deg, #10b981, #34d399)", color: "#fff", borderRadius: "8px", padding: "8px 14px", fontSize: "12px", fontWeight: 700 }}>
                  ✓ Confirmar Atendimento
=======
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Volume2 size={16} color="var(--info)" /> Em Atendimento
            </h3>
            <span className="tag" style={{ background: "var(--accent-light)", color: "var(--info)" }}>
              {calledTickets.length}
            </span>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {calledTickets.map((t) => (
              <div
                key={t.token}
                className="animate-slide"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  background: "var(--surface-hover)",
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {t.category} · {t.counter}
                  </div>
                </div>
                <button
                  className="btn"
                  onClick={() => confirmServed(t.token)}
                  style={{
                    background: "var(--success)",
                    color: "#06231A",
                    borderColor: "var(--success)",
                    padding: "8px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <Check size={14} /> Confirmar Atendimento
>>>>>>> Stashed changes
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Registro do Dia ── */}
      {registryTickets.length > 0 && (
        <div className="card animate-fade" style={{ overflow: "hidden" }}>
<<<<<<< Updated upstream
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontWeight: 700, fontSize: "15px" }}>📋 Registro do Dia</h3>
            <span className="tag" style={{ background: "rgba(167,139,250,0.12)", color: "var(--purple)" }}>{registryTickets.length}</span>
=======
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
              <ClipboardList size={16} /> Registro do Dia
            </h3>
            <span className="tag">{registryTickets.length}</span>
>>>>>>> Stashed changes
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Nome", "Categoria", "Status", "Guichê", "Horário", "Ações"].map((h) => (
                    <th
                      key={h}
                      className="mono"
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registryTickets.map((t, i) => {
<<<<<<< Updated upstream
                  const badge = STATUS_BADGE[t.status] || { label: t.status, color: "var(--text-muted)", bg: "transparent" };
=======
                  const badge = STATUS_BADGE[t.status] || {
                    label: t.status,
                    Icon: Check,
                    color: "var(--text-muted)",
                    bg: "transparent",
                  };
>>>>>>> Stashed changes
                  const timeShown = t.servedAt || t.removedAt || t.leftAt || t.joinedAt;
                  return (
                    <tr
                      key={t.token}
                      className="animate-slide"
                      style={{
                        borderBottom: "1px solid var(--border)",
                        animationDelay: `${i * 0.02}s`,
                      }}
                    >
                      <td style={{ padding: "12px 14px" }}>
<<<<<<< Updated upstream
                        <span className="tag" style={{ background: badge.bg, color: badge.color, fontSize: "11px" }}>{badge.label}</span>
=======
                        <span style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t.category}</span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          className="tag"
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            borderColor: badge.bg,
                            fontSize: "11px",
                          }}
                        >
                          <badge.Icon size={11} /> {badge.label}
                        </span>
>>>>>>> Stashed changes
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                          {t.counter || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
<<<<<<< Updated upstream
                        <button className="btn" onClick={() => setRecallTarget(t)} style={{ background: "rgba(167,139,250,0.1)", color: "var(--purple)", border: "1px solid rgba(167,139,250,0.25)", padding: "6px 12px", borderRadius: "6px", fontSize: "12px" }}>
                          🔁 Chamar de Volta
=======
                        <span className="mono" style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                          {new Date(timeShown).toLocaleTimeString("pt-BR")}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <button
                          className="btn"
                          onClick={() => setRecallTarget(t)}
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                        >
                          <RotateCcw size={13} /> Chamar de Volta
>>>>>>> Stashed changes
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

      {/* ── Modal: Seleção de Guichê (Priority 5) ── */}
      <Modal open={counterModalOpen} onClose={() => setCounterModalOpen(false)} maxWidth="480px">
        <h3 style={{ marginBottom: "8px", fontSize: "17px" }}>Escolha seu Guichê</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
          Selecione em qual guichê você irá atender. Cada funcionário opera um guichê individual.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          {counters.map((c) => {
            const claim = counterClaims[c.id];
            const isMine = myCounter?.id === c.id;
            const isTaken = claim && !isMine;

            return (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: isMine
                    ? "var(--accent-glow)"
                    : isTaken
                    ? "var(--surface-hover)"
                    : "var(--surface)",
                  borderColor: isMine ? "var(--accent)" : "var(--border)",
                  opacity: isTaken ? 0.7 : 1,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>{c.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {isMine
                      ? "Seu guichê atual"
                      : isTaken
                      ? `Em uso por: ${claim.name}`
                      : "Livre para atendimento"}
                  </div>
                </div>

                {isMine ? (
                  <span className="tag" style={{ background: "var(--accent)", color: "#04141C" }}>
                    Ativo
                  </span>
                ) : isTaken ? (
                  <span className="tag" style={{ background: "transparent", color: "var(--text-muted)" }}>
                    Ocupado
                  </span>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => claimCounterAction(c.id)}
                    style={{ padding: "6px 14px", fontSize: "12px" }}
                  >
                    Assumir Guichê
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          className="btn"
          onClick={() => setCounterModalOpen(false)}
          style={{ width: "100%", padding: "10px", fontSize: "13px" }}
        >
          Fechar
        </button>
      </Modal>

      {/* ── Modal: Adicionar Manualmente ── */}
      <Modal open={manualModal} onClose={() => setManualModal(false)}>
        <h3 style={{ fontWeight: 700, marginBottom: "18px", fontSize: "18px" }}>➕ Adicionar Manualmente</h3>
        <div style={{ marginBottom: "14px" }}>
          <label
            className="mono"
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "block",
              marginBottom: "6px",
              textTransform: "uppercase",
            }}
          >
            Nome do Cliente
          </label>
          <input
            className="input"
            placeholder="Nome completo"
            value={manualForm.name}
            onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
            autoFocus
          />
        </div>
        <div style={{ marginBottom: "14px" }}>
          <label
            className="mono"
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "block",
              marginBottom: "6px",
              textTransform: "uppercase",
            }}
          >
            Categoria
          </label>
          <select
            className="input"
            value={manualForm.category}
            onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {room.customFields?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
            {room.customFields.map((field) => (
              <CustomFieldInput
                key={field.id}
                field={field}
                value={manualCustom[field.id]}
                onChange={(v) => setManualCustom({ ...manualCustom, [field.id]: v })}
              />
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
<<<<<<< Updated upstream
          <button className="btn" onClick={() => setManualModal(false)} style={{ flex: 1, padding: "12px", background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancelar</button>
          <button className="btn" onClick={addManual} style={{ flex: 2, padding: "12px", background: "linear-gradient(135deg, var(--accent), #34d399)", color: "#022c22", fontWeight: 800 }}>Adicionar à Fila</button>
=======
          <button
            className="btn"
            onClick={() => setManualModal(false)}
            style={{ flex: 1, padding: "12px" }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={addManual}
            style={{ flex: 2, padding: "12px", fontWeight: 700 }}
          >
            Adicionar à Fila
          </button>
>>>>>>> Stashed changes
        </div>
      </Modal>

      {/* ── Modal de Confirmação para Encerrar Dia (Priority 2) ── */}
      <Modal open={confirmCloseModalOpen} onClose={() => setConfirmCloseModalOpen(false)} maxWidth="480px">
        <h3 style={{ fontSize: "18px", marginBottom: "12px" }}>Encerrar Expediente</h3>

        {!canCloseDay ? (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                background: "var(--danger-glow)",
                border: "1px solid var(--danger-glow)",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px",
                color: "var(--danger)",
              }}
            >
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>
                  A fila ainda não está vazia!
                </div>
                <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                  Ainda constam:
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {queue.length > 0 && <li>{queue.length} cliente(s) aguardando na fila.</li>}
                    {calledTickets.length > 0 && (
                      <li>{calledTickets.length} cliente(s) em atendimento no momento.</li>
                    )}
                  </ul>
                  Conclua os atendimentos ou remova todos antes de encerrar o expediente.
                </div>
              </div>
            </div>

            <button
              className="btn"
              onClick={() => setConfirmCloseModalOpen(false)}
              style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 600 }}
            >
              Entendido, voltar à fila
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px", lineHeight: "1.5" }}>
              Todos os clientes do dia foram atendidos ou removidos. Tem certeza de que deseja finalizar o
              dia de hoje? A sala será encerrada e um relatório detalhado será gerado.
            </p>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn"
                onClick={() => setConfirmCloseModalOpen(false)}
                style={{ flex: 1, padding: "12px" }}
                disabled={closingDay}
              >
                Cancelar
              </button>
              <button
                className="btn"
                onClick={handleExecuteCloseDay}
                disabled={closingDay}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "var(--danger)",
                  color: "#fff",
                  borderColor: "var(--danger)",
                  fontWeight: 700,
                }}
              >
                {closingDay ? "Encerrando..." : "Sim, Encerrar Dia"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <RecallModal
        open={!!recallTarget}
        onClose={() => setRecallTarget(null)}
        ticket={recallTarget}
        counters={counters}
        myCounterName={myCounter?.name}
        onRecall={handleRecall}
      />
      <LogsModal open={logsModalOpen} onClose={() => setLogsModalOpen(false)} logs={logs} />
      <HistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        history={historyData}
      />

      {/* ── Modal: Relatório Final pós Encerramento ── */}
      <Modal open={closeDayModal} onClose={() => {}} maxWidth="500px">
        {report && (
          <>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
<<<<<<< Updated upstream
              <div style={{ fontSize: "48px", marginBottom: "10px" }}>📊</div>
              <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Relatório da Sessão</h2>
              <p className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>{report.roomName} · {new Date(report.date).toLocaleDateString("pt-BR")}</p>
=======
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "14px",
                  background: "var(--accent-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <ClipboardList size={26} color="var(--accent)" />
              </div>
              <h2>Relatório da Sessão</h2>
              <p className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                {report.roomName} · {new Date(report.date).toLocaleDateString("pt-BR")}
              </p>
>>>>>>> Stashed changes
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              {[
                { label: "Atendidos", value: report.totalServed, color: "var(--accent)" },
                { label: "Removidos", value: report.totalRemovedByHost, color: "var(--danger)" },
                { label: "Saíram", value: report.totalLeftVoluntarily, color: "var(--warn)" },
                { label: "Espera Média", value: `${report.avgWaitMinutes}min`, color: "var(--purple)" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "var(--surface-hover)",
                    borderRadius: "10px",
                    padding: "14px",
                    textAlign: "center",
                  }}
                >
                  <div
                    className="mono"
                    style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px" }}
                  >
                    {s.label}
                  </div>
                  <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: s.color }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
<<<<<<< Updated upstream
              <button className="btn" onClick={() => exportToCSV(report)} style={{ padding: "14px", background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent-dim)", fontWeight: 700 }}>📥 Baixar como .CSV</button>
              <button className="btn" onClick={() => exportToJSON(report)} style={{ padding: "14px", background: "rgba(167,139,250,0.08)", color: "var(--purple)", border: "1px solid rgba(167,139,250,0.25)", fontWeight: 700 }}>📥 Baixar como .JSON</button>
            </div>
            <button className="btn" onClick={() => { setCloseDayModal(false); onCloseDay(); }} style={{ width: "100%", padding: "12px", background: "#7f1d1d44", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.25)" }}>
              Encerrar e Voltar ao Início
=======
              <button
                className="btn"
                onClick={() => exportToCSV(report)}
                style={{ padding: "14px", fontWeight: 700 }}
              >
                <Download size={16} /> Baixar como .CSV
              </button>
              <button
                className="btn"
                onClick={() => exportToJSON(report)}
                style={{ padding: "14px", fontWeight: 700 }}
              >
                <Download size={16} /> Baixar como .JSON
              </button>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setCloseDayModal(false);
                onCloseDay();
              }}
              style={{ width: "100%", padding: "12px" }}
            >
              Concluir e Voltar ao Início
>>>>>>> Stashed changes
            </button>
          </>
        )}
      </Modal>
    </div>
  );
};

export default QueueManagementScreen;
