/**
 * screens/QueueManagementScreen.jsx
 *
 * Painel do host — Design System v3.0
 * Gerencia a fila em tempo real via Socket.io com ícones Lucide e zero emojis.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import socket from "../lib/socket";
import { closeDay as closeDayApi, fetchRoomPublic } from "../lib/api";
import QRDisplay from "../components/QRDisplay";
import Modal from "../components/Modal";
import { exportToCSV, exportToJSON } from "../lib/export";
import {
  ArrowLeft,
  Megaphone,
  UserPlus,
  Bell,
  Check,
  CheckCircle2,
  RotateCcw,
  BellRing,
  Trash2,
  ChevronDown,
  BarChart3,
  Download,
  X,
  Clock,
  Users,
  Radio,
  LogOut,
} from "lucide-react";

const PRIORITY_OPTIONS = [
  { value: 3, label: "Alta", color: "var(--priority-high)", bg: "var(--priority-high-bg)", border: "rgba(248,113,113,0.3)" },
  { value: 2, label: "Média", color: "var(--priority-med)", bg: "var(--priority-med-bg)", border: "rgba(251,191,36,0.3)" },
  { value: 1, label: "Baixa", color: "var(--priority-low)", bg: "var(--priority-low-bg)", border: "rgba(52,211,153,0.3)" },
];

const getPriorityColor = (p) =>
  p === 3 ? "var(--priority-high)" : p === 2 ? "var(--priority-med)" : "var(--priority-low)";

const QueueManagementScreen = ({ roomCode, room: roomProp, onCloseDay, onBack }) => {
  const { activeOrg } = useAuth();

  const [room, setRoom] = useState(roomProp || null);
  const [roomLoading, setRoomLoading] = useState(!roomProp && !!roomCode);

  const [queue, setQueue] = useState([]);
  const [calledTickets, setCalledTickets] = useState([]);
  const [servedTickets, setServedTickets] = useState([]);
  const [servedCount, setServedCount] = useState(0);
  const [manualModal, setManualModal] = useState(false);
  const [closeDayModal, setCloseDayModal] = useState(false);
  const [report, setReport] = useState(null);
  const [manualForm, setManualForm] = useState({ name: "", category: "" });
  const [callLoading, setCallLoading] = useState(false);
  const [selectedServed, setSelectedServed] = useState(null);

  // Busca dados da sala se não vieram via prop
  useEffect(() => {
    if (roomProp) {
      setRoom(roomProp);
      setManualForm((f) => ({ ...f, category: roomProp.categories?.[0]?.name || f.category }));
      return;
    }
    if (!roomCode) return;

    setRoomLoading(true);
    fetchRoomPublic(roomCode)
      .then((data) => {
        setRoom(data);
        setManualForm((f) => ({ ...f, category: data.categories?.[0]?.name || f.category }));
      })
      .catch((err) => console.error("[host] Falha ao carregar sala:", err.message))
      .finally(() => setRoomLoading(false));
  }, [roomCode, roomProp]);

  // ── Socket ────────────────────────────────────────────────────
  const joinRoom = useCallback(() => {
    if (roomCode) {
      socket.emit("host:join", { roomCode });
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;

    joinRoom();
    socket.on("connect", joinRoom);

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

    const handleTicketServed = ({ roomCode: rc, token, ticket }) => {
      if (rc !== roomCode) return;
      setCalledTickets((prev) => prev.filter((t) => t.token !== token));
      setServedCount((c) => c + 1);
      if (ticket) {
        setServedTickets((prev) => [{ ...ticket, servedAt: Date.now() }, ...prev]);
      } else {
        setServedTickets((prev) => [{ token, servedAt: Date.now() }, ...prev]);
      }
    };

    const handleTicketRecalled = ({ roomCode: rc, token, ticket }) => {
      if (rc !== roomCode) return;
      setServedTickets((prev) => prev.filter((t) => t.token !== token));
      setServedCount((c) => Math.max(0, c - 1));
      if (ticket) {
        setCalledTickets((prev) => [
          ...prev,
          { ...ticket, name: ticket.name, calledAt: Date.now() },
        ]);
      }
    };

    socket.on("queue_update", handleUpdate);
    socket.on("ticket_called", handleTicketCalled);
    socket.on("ticket_served", handleTicketServed);
    socket.on("ticket_recalled", handleTicketRecalled);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("queue_update", handleUpdate);
      socket.off("ticket_called", handleTicketCalled);
      socket.off("ticket_served", handleTicketServed);
      socket.off("ticket_recalled", handleTicketRecalled);
    };
  }, [roomCode, joinRoom]);

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

  const handleReadmit = (served) => {
    socket.emit("host:readmit", {
      roomCode,
      token: served.token,
      name: served.name,
      category: served.category,
      priority: served.priority ?? 1,
    });
    setServedTickets((prev) => prev.filter((t) => t.token !== served.token));
    setServedCount((c) => Math.max(0, c - 1));
    setSelectedServed(null);
  };

  const handleRecallServed = (served) => {
    socket.emit("host:recall_served", { roomCode, token: served.token });
    setSelectedServed(null);
  };

  const addManual = () => {
    if (!manualForm.name.trim()) return;
    socket.emit("host:add_manual", {
      roomCode,
      name: manualForm.name.trim(),
      category: manualForm.category,
    });
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

  const totalWait = queue.reduce((s, t) => s + (t.tma || 0), 0);
  const formatWait = (mins) => (mins === 0 ? "Imediato" : `~${mins} min`);

  const categories = Array.isArray(room?.categories)
    ? room.categories
    : JSON.parse(room?.categories || "[]");

  if (!room || roomLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "28px", fontWeight: 800 }}>
          fila<span style={{ color: "var(--primary)" }}>.io</span>
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "3px solid var(--border)",
            borderTopColor: "var(--primary)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
          Carregando sala...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "20px 24px 60px",
        maxWidth: "1040px",
        margin: "0 auto",
      }}
    >
      {/* ── Top Bar ── */}
      <header
        className="animate-fade"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "3px",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                fontWeight: 800,
                fontFamily: "var(--font-display)",
              }}
            >
              fila<span style={{ color: "var(--primary)" }}>.io</span>
            </span>
            <span className="tag" style={{ textTransform: "uppercase" }}>
              {activeOrg?.name}
            </span>
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            {room.name}
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="btn btn-secondary"
            onClick={onBack}
            style={{ fontSize: "12px", padding: "7px 12px", gap: "5px" }}
          >
            <ArrowLeft size={14} /> Voltar
          </button>
          <div
            className="card"
            style={{
              padding: "7px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--surface)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--primary)",
                boxShadow: "0 0 8px var(--primary)",
              }}
            />
            <span
              className="mono"
              style={{
                fontSize: "13px",
                color: "var(--primary)",
                fontWeight: 700,
                letterSpacing: "0.15em",
              }}
            >
              {roomCode}
            </span>
          </div>
          <button
            className="btn btn-danger"
            onClick={handleCloseDay}
            style={{ fontSize: "12px", padding: "7px 14px" }}
          >
            Encerrar Dia
          </button>
        </div>
      </header>

      {/* ── Stats Grid ── */}
      <div
        className="animate-fade"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {[
          { label: "Aguardando", value: queue.length, color: "var(--primary)" },
          { label: "Em Atendimento", value: calledTickets.length, color: "var(--accent)" },
          { label: "Atendidos Hoje", value: servedCount, color: "var(--success)" },
          { label: "Tempo Estimado", value: formatWait(totalWait), color: "var(--info)" },
        ].map((s) => (
          <div
            key={s.label}
            className="card"
            style={{ padding: "16px", textAlign: "center", background: "var(--surface)" }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 600,
              }}
            >
              {s.label}
            </div>
            <div
              className="mono"
              style={{ fontSize: "24px", fontWeight: 800, color: s.color }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── QR Code + Ações Rápidas ── */}
      <div
        className="animate-fade"
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          className="card"
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: "var(--surface)",
          }}
        >
          <QRDisplay code={roomCode} size={110} />
          <span
            className="mono"
            style={{
              fontSize: "10px",
              color: "var(--text-secondary)",
              letterSpacing: "0.08em",
            }}
          >
            QR CODE DA SALA
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            className="btn btn-primary"
            onClick={callNext}
            disabled={queue.length === 0 || callLoading}
            style={{
              flex: 1,
              minHeight: "58px",
              fontSize: "16px",
              fontWeight: 700,
              gap: "10px",
              opacity: queue.length === 0 ? 0.6 : 1,
            }}
          >
            {callLoading ? (
              <>
                <Radio size={18} className="animate-spin" /> Chamando paciente...
              </>
            ) : (
              <>
                <Megaphone size={18} /> Chamar Próximo Paciente
              </>
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setManualModal(true)}
            style={{
              flex: 1,
              minHeight: "44px",
              fontSize: "13px",
              fontWeight: 600,
              gap: "8px",
            }}
          >
            <UserPlus size={16} /> Adicionar Paciente Manualmente
          </button>
        </div>
      </div>

      {/* ── Em Atendimento (Prioridade Visual) ── */}
      {calledTickets.length > 0 && (
        <div
          className="card animate-fade"
          style={{
            overflow: "hidden",
            marginBottom: "24px",
            borderColor: "var(--accent-border)",
            background: "var(--surface)",
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--accent-muted)",
            }}
          >
            <h3
              style={{
                fontWeight: 700,
                fontSize: "14px",
                margin: 0,
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Bell size={16} /> Em Atendimento
            </h3>
            <span
              className="tag"
              style={{
                background: "var(--accent-muted)",
                color: "var(--accent)",
                borderColor: "var(--accent-border)",
              }}
            >
              {calledTickets.length} chamado{calledTickets.length > 1 ? "s" : ""}
            </span>
          </div>

          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {calledTickets.map((t) => (
              <div
                key={t.token}
                className="animate-slide"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "8px",
                      background: "var(--accent-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--accent)",
                    }}
                  >
                    <BellRing size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {t.category} · Chamado{" "}
                      {t.calledAt
                        ? `há ${Math.max(1, Math.round((Date.now() - t.calledAt) / 60000))} min`
                        : "agora"}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handleConfirmServed(t.token)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: 700,
                    gap: "6px",
                  }}
                >
                  <Check size={14} strokeWidth={3} /> Concluir Atendimento
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Fila Ativa ── */}
      <div
        className="card animate-fade"
        style={{ overflow: "hidden", marginBottom: "24px", background: "var(--surface)" }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={16} style={{ color: "var(--primary)" }} />
            <h3 style={{ fontWeight: 700, fontSize: "15px", margin: 0 }}>
              Fila de Espera
            </h3>
          </div>
          <span className="tag">{queue.length} pacientes</span>
        </div>

        {queue.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--primary-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
                margin: "0 auto 14px",
              }}
            >
              <CheckCircle2 size={26} />
            </div>
            <div
              style={{
                fontWeight: 600,
                fontSize: "15px",
                marginBottom: "4px",
                color: "var(--text)",
              }}
            >
              Fila vazia
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Nenhum paciente aguardando no momento.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["#", "Paciente", "Categoria", "Prioridade", "Espera Est.", "Ações"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          fontWeight: 600,
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {queue.map((t, i) => (
                  <tr
                    key={t.token}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: i === 0 ? "var(--primary-muted)" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: i === 0 ? "var(--primary)" : "var(--text-secondary)",
                        }}
                      >
                        {t.position}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</span>
                        {t.manual && (
                          <span
                            className="tag"
                            style={{
                              background: "var(--info-muted)",
                              color: "var(--info)",
                              borderColor: "var(--info-border)",
                              fontSize: "10px",
                              padding: "1px 5px",
                            }}
                          >
                            Manual
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        {t.category}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <select
                        value={t.priority}
                        onChange={(e) => changePriority(t.token, parseInt(e.target.value))}
                        style={{
                          background: "var(--surface)",
                          border: `1px solid ${getPriorityColor(t.priority)}`,
                          color: getPriorityColor(t.priority),
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        {PRIORITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        className="mono"
                        style={{ fontSize: "13px", color: "var(--accent)" }}
                      >
                        {formatWait(t.estimatedWait || 0)}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => callSpecificTicket(t.token)}
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            color: "var(--primary)",
                            borderColor: "var(--primary-border)",
                          }}
                        >
                          Chamar
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => removeTicket(t.token)}
                          style={{
                            padding: "6px 8px",
                            color: "var(--danger)",
                            borderColor: "var(--danger-border)",
                          }}
                          title="Remover da fila"
                        >
                          <Trash2 size={13} />
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

      {/* ── Atendidos Hoje ── */}
      {servedTickets.length > 0 && (
        <div
          className="card animate-fade"
          style={{ overflow: "hidden", marginBottom: "24px", background: "var(--surface)" }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
              <h3 style={{ fontWeight: 700, fontSize: "15px", margin: 0 }}>
                Atendidos na Sessão
              </h3>
            </div>
            <span
              className="tag"
              style={{
                background: "var(--success-muted)",
                color: "var(--success)",
                borderColor: "var(--success-border)",
              }}
            >
              {servedTickets.length} atendido{servedTickets.length > 1 ? "s" : ""}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Paciente", "Categoria", "Horário", "Ações"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        textAlign: "left",
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {servedTickets.map((t, i) => (
                  <tr
                    key={t.token || i}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>
                        {t.name || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        {t.category || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className="mono"
                        style={{ fontSize: "12px", color: "var(--text-dim)" }}
                      >
                        {t.servedAt
                          ? new Date(t.servedAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setSelectedServed(t)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          gap: "4px",
                          fontWeight: 600,
                        }}
                      >
                        Ações <ChevronDown size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Adicionar Manualmente ── */}
      <Modal open={manualModal} onClose={() => setManualModal(false)}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "8px",
              background: "var(--primary-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary)",
            }}
          >
            <UserPlus size={18} />
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "18px", margin: 0 }}>
            Adicionar Paciente Manualmente
          </h3>
        </div>

        <label
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            display: "block",
            marginBottom: "6px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Nome do Paciente
        </label>
        <input
          className="input"
          placeholder="Nome completo"
          value={manualForm.name}
          onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && addManual()}
          autoFocus
          style={{ marginBottom: "16px" }}
        />

        <label
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            display: "block",
            marginBottom: "6px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Categoria de Atendimento
        </label>
        <select
          className="input"
          value={manualForm.category}
          onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
          style={{ marginBottom: "24px" }}
        >
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn btn-secondary"
            onClick={() => setManualModal(false)}
            style={{ flex: 1, padding: "12px", fontSize: "13px" }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={addManual}
            style={{ flex: 2, padding: "12px", fontSize: "13px", fontWeight: 700 }}
          >
            Adicionar à Fila
          </button>
        </div>
      </Modal>

      {/* ── Popup: Ações sobre ticket atendido ── */}
      {selectedServed && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
          onClick={(e) => e.target === e.currentTarget && setSelectedServed(null)}
        >
          <div
            className="card animate-fade"
            style={{
              background: "var(--surface)",
              width: "100%",
              maxWidth: "420px",
              padding: "28px",
              position: "relative",
            }}
          >
            <button
              onClick={() => setSelectedServed(null)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex",
              }}
            >
              <X size={18} />
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: "var(--success-muted)",
                  border: "1px solid var(--success-border)",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--success)",
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "16px" }}>
                  {selectedServed.name || "—"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {selectedServed.category} · Atendido às{" "}
                  {selectedServed.servedAt
                    ? new Date(selectedServed.servedAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                marginBottom: "18px",
              }}
            >
              Selecione o procedimento para este paciente:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => handleRecallServed(selectedServed)}
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 16px",
                  textAlign: "left",
                  borderColor: "var(--accent-border)",
                  background: "var(--accent-muted)",
                  width: "100%",
                }}
              >
                <BellRing size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--accent)",
                      fontSize: "13px",
                    }}
                  >
                    Chamar de Volta ao Atendimento
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Retorna diretamente ao guichê ativo
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleReadmit(selectedServed)}
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 16px",
                  textAlign: "left",
                  borderColor: "var(--primary-border)",
                  background: "var(--primary-muted)",
                  width: "100%",
                }}
              >
                <RotateCcw size={20} style={{ color: "var(--primary)", flexShrink: 0 }} />
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--primary)",
                      fontSize: "13px",
                    }}
                  >
                    Recolocar na Fila de Espera
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Gera nova posição na categoria {selectedServed.category}
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedServed(null)}
                className="btn btn-secondary"
                style={{ width: "100%", padding: "10px", fontSize: "13px", marginTop: "6px" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Relatório de Encerramento ── */}
      <Modal open={closeDayModal} onClose={() => {}} maxWidth="500px">
        {report && (
          <>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "12px",
                  background: "var(--primary-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary)",
                  margin: "0 auto 12px",
                }}
              >
                <BarChart3 size={28} />
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px" }}>
                Relatório da Sessão
              </h2>
              <p
                className="mono"
                style={{ color: "var(--text-secondary)", fontSize: "12px", margin: 0 }}
              >
                {report.room_name} ·{" "}
                {new Date(report.generated_at).toLocaleDateString("pt-BR")}
              </p>
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
                { label: "Atendidos", value: report.total_served, color: "var(--success)" },
                { label: "Abandonos", value: report.total_abandoned, color: "var(--danger)" },
                { label: "Espera Média", value: `${report.avg_wait_minutes} min`, color: "var(--accent)" },
                { label: "Código da Sala", value: report.room_code, color: "var(--primary)" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "14px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--text-secondary)",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontWeight: 600,
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: "22px", fontWeight: 800, color: s.color }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => exportToCSV(report)}
                style={{ padding: "12px", fontSize: "13px", gap: "8px", fontWeight: 600 }}
              >
                <Download size={15} /> Exportar como Arquivo CSV
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => exportToJSON(report)}
                style={{ padding: "12px", fontSize: "13px", gap: "8px", fontWeight: 600 }}
              >
                <Download size={15} /> Exportar como Arquivo JSON
              </button>
            </div>

            <button
              className="btn btn-danger"
              onClick={() => {
                setCloseDayModal(false);
                onCloseDay();
              }}
              style={{ width: "100%", padding: "12px", fontSize: "13px", gap: "6px" }}
            >
              <LogOut size={14} /> Encerrar Sessão e Retornar ao Início
            </button>
          </>
        )}
      </Modal>
    </div>
  );
};

export default QueueManagementScreen;
