/**
 * screens/LandingScreen.jsx
 *
 * Tela inicial — Kiwii
 * - Mostra instituição ativa, cargo real (RBAC) e salas ativas (guichês).
 * - Acompanhamento em tempo real de senha ativa com alerta de chamado de volta.
 * - Navegação para criação de sala, membros, dashboard e troca de instituição.
 * - Onboarding fluido para contas sem instituição (convites pendentes por e-mail).
 */
import { useState, useEffect } from "react";
import {
  Users,
  LayoutDashboard,
  Ticket,
  Settings,
  Plus,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  X,
  Mail,
  Building2,
  CheckCircle,
  Lock,
  DoorOpen,
  BarChart3,
  LogOut,
  RotateCcw,
  Bell,
  Trash2,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import {
  createOrg,
  updateOrg,
  deleteOrg,
  fetchActiveRooms,
  fetchMyInvites,
  acceptInvite,
  fetchSavedRooms,
  openDayRoom,
  fetchJoinRequests,
} from "../lib/api";
import socket from "../lib/socket";
import ConfirmModal from "../components/ConfirmModal";
import Modal from "../components/Modal";

const ROLE_LABELS = { owner: "Administrador", admin: "Administrador", operator: "Operador" };

const LandingScreen = ({ onNavigate }) => {
  const { user, activeOrg, orgs, switchOrg, signOut, refreshOrgs } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [hovered, setHovered] = useState(null);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [editOrgName, setEditOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Salas ativas da instituição (para entrar como guichê) - Priority 5
  const [activeRooms, setActiveRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomWarning, setRoomWarning] = useState(null); // { title, message, roomCode }

  // Salas permanentes salvas (Modelos/Presets) e Solicitações de Entrada
  const [savedRooms, setSavedRooms] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [openingSavedRoomId, setOpeningSavedRoomId] = useState(null);

  // Convites pendentes por e-mail - Priority 7
  const [pendingInvites, setPendingInvites] = useState([]);
  const [acceptingToken, setAcceptingToken] = useState(null);

  // ── Ticket ativo do cliente (acompanhamento e recall no menu principal) (M1/M8) ──
  const [activeTicketData, setActiveTicketData] = useState(() => {
    try {
      const saved =
        localStorage.getItem("kiwii_active_ticket") ||
        localStorage.getItem("fila_io_active_ticket");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!activeTicketData?.ticket?.token || !activeTicketData?.room?.code) return;

    const { ticket, room } = activeTicketData;

    const joinRoom = () => {
      socket.emit("client:join", {
        roomCode: room.code,
        token: ticket.token,
      });
    };

    if (socket.connected) joinRoom();
    socket.on("connect", joinRoom);

    const handleQueueUpdate = ({ roomCode, queue }) => {
      if (roomCode?.toUpperCase() !== room.code?.toUpperCase()) return;
      const me = queue.find((t) => t.token === ticket.token);
      if (!me) return;
      setActiveTicketData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ticket: { ...prev.ticket, ...me, status: "waiting", isRecall: false },
        };
        try {
          localStorage.setItem("kiwii_active_ticket", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    const handleTicketCalled = (data) => {
      const t = data.token || data.ticket?.token;
      if (t !== ticket.token) return;
      navigator.vibrate?.([200, 100, 200, 100, 400]);
      setActiveTicketData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ticket: {
            ...prev.ticket,
            status: "called",
            isRecall: false,
            counter: data.counter || prev.ticket.counter,
          },
        };
        try {
          localStorage.setItem("kiwii_active_ticket", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    const handleTicketRecalled = (data) => {
      const t = data.token || data.ticket?.token;
      if (t !== ticket.token) return;
      navigator.vibrate?.([300, 150, 300, 150, 600]);
      setActiveTicketData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ticket: {
            ...prev.ticket,
            status: "called",
            isRecall: true,
            category: data.category || prev.ticket.category,
            counter: data.counterName || data.counter || prev.ticket.counter,
          },
        };
        try {
          localStorage.setItem("kiwii_active_ticket", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    const handleTicketServed = ({ token }) => {
      if (token !== ticket.token) return;
      setActiveTicketData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ticket: { ...prev.ticket, status: "served", isRecall: false },
        };
        try {
          localStorage.setItem("kiwii_active_ticket", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    socket.on("queue_update", handleQueueUpdate);
    socket.on("ticket_called", handleTicketCalled);
    socket.on("ticket_recalled", handleTicketRecalled);
    socket.on("ticket_served", handleTicketServed);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("queue_update", handleQueueUpdate);
      socket.off("ticket_called", handleTicketCalled);
      socket.off("ticket_recalled", handleTicketRecalled);
      socket.off("ticket_served", handleTicketServed);
    };
  }, [activeTicketData?.ticket?.token, activeTicketData?.room?.code]);

  // Carrega salas ativas, salas salvas e solicitações de entrada da instituição
  useEffect(() => {
    if (!activeOrg?.id) {
      setActiveRooms([]);
      setSavedRooms([]);
      setJoinRequests([]);
      return;
    }
    setLoadingRooms(true);
    fetchActiveRooms(activeOrg.id)
      .then((data) => setActiveRooms(data.rooms || []))
      .catch(() => setActiveRooms([]))
      .finally(() => setLoadingRooms(false));

    fetchSavedRooms(activeOrg.id)
      .then((data) => setSavedRooms(data.savedRooms || []))
      .catch(() => setSavedRooms([]));

    if (["admin", "owner"].includes(activeOrg.role)) {
      fetchJoinRequests(activeOrg.id)
        .then((data) => setJoinRequests(data.requests || []))
        .catch(() => setJoinRequests([]));
    }
  }, [activeOrg?.id, activeOrg?.role]);

  const handleOpenSavedRoom = async (savedRoom) => {
    setOpeningSavedRoomId(savedRoom.id);
    try {
      const room = await openDayRoom(activeOrg.id, { savedRoomId: savedRoom.id });
      onNavigate("host-panel", { roomCode: room.code });
    } catch (err) {
      alert(`Erro ao abrir sala: ${err.message}`);
    } finally {
      setOpeningSavedRoomId(null);
    }
  };

  // Carrega convites pendentes do usuário logado
  useEffect(() => {
    if (!user) return;
    fetchMyInvites()
      .then((data) => setPendingInvites(data.invites || []))
      .catch(() => setPendingInvites([]));
  }, [user]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setIsSubmitting(true);
    setOrgError("");
    try {
      const org = await createOrg(newOrgName.trim());
      await refreshOrgs();
      switchOrg(org);
      setNewOrgName("");
      setShowCreateModal(false);
    } catch (err) {
      setOrgError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrg = async () => {
    if (!editOrgName.trim() || !activeOrg) return;
    setIsSubmitting(true);
    setOrgError("");
    try {
      const updated = await updateOrg(activeOrg.id, { name: editOrgName.trim() });
      await refreshOrgs();
      switchOrg(updated);
      setShowSettingsModal(false);
    } catch (err) {
      setOrgError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!activeOrg) return;
    setIsSubmitting(true);
    try {
      await deleteOrg(activeOrg.id);
      await refreshOrgs();
      setDeleteConfirm(false);
      setShowSettingsModal(false);
    } catch (err) {
      setOrgError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptPendingInvite = async (token) => {
    setAcceptingToken(token);
    try {
      await acceptInvite(token);
      await refreshOrgs();
      setPendingInvites((prev) => prev.filter((i) => i.token !== token));
    } catch (err) {
      alert(`Erro ao aceitar convite: ${err.message}`);
    } finally {
      setAcceptingToken(null);
    }
  };

  const dismissActiveTicket = () => {
    try {
      localStorage.removeItem("kiwii_active_ticket");
      localStorage.removeItem("fila_io_active_ticket");
    } catch {}
    setActiveTicketData(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
      }}
    >
      {/* ── Banner de Senha Ativa com Suporte a Recall (M1/M8) ── */}
      {activeTicketData?.ticket && (
        <div
          className="animate-slide"
          style={{
            position: "fixed",
            top: "20px",
            zIndex: 100,
            maxWidth: "480px",
            width: "calc(100% - 40px)",
            background:
              activeTicketData.ticket.status === "called"
                ? "var(--primary-glow, rgba(45,212,168,0.15))"
                : "var(--surface)",
            border: `1.5px solid ${
              activeTicketData.ticket.status === "called"
                ? "var(--primary)"
                : "var(--border)"
            }`,
            borderRadius: "12px",
            padding: "14px 18px",
            boxShadow: "var(--shadow-lg)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background:
                  activeTicketData.ticket.status === "called"
                    ? "var(--primary)"
                    : "var(--primary-muted)",
                color: activeTicketData.ticket.status === "called" ? "#fff" : "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {activeTicketData.ticket.isRecall ? (
                <RotateCcw size={18} />
              ) : activeTicketData.ticket.status === "called" ? (
                <Bell size={18} />
              ) : (
                <Ticket size={18} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "13px",
                  color:
                    activeTicketData.ticket.status === "called"
                      ? "var(--primary)"
                      : "var(--text)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>Senha #{activeTicketData.ticket.code}</span>
                {activeTicketData.ticket.isRecall && (
                  <span
                    className="tag"
                    style={{
                      background: "var(--primary)",
                      color: "#fff",
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    Chamado de Volta
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {activeTicketData.ticket.status === "called"
                  ? "Dirija-se ao atendimento agora!"
                  : activeTicketData.ticket.status === "served"
                  ? "Atendimento finalizado"
                  : `Aguardando · Posição: ${activeTicketData.ticket.position ?? "-"}`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => onNavigate("live-ticket", activeTicketData)}
              className="btn btn-primary"
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              Acompanhar
            </button>
            <button
              onClick={dismissActiveTicket}
              className="btn"
              style={{
                background: "transparent",
                border: "none",
                padding: "6px",
                color: "var(--text-dim)",
                cursor: "pointer",
              }}
              title="Dispensar aviso"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Topbar (Instituição Ativa & Conta) ── */}
      <div
        style={{
          position: "absolute",
          top: "24px",
          left: "24px",
          right: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Seletor de Instituição */}
        {user && activeOrg ? (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowOrgMenu(!showOrgMenu)}
              className="btn btn-secondary"
              style={{ padding: "8px 14px", gap: "8px", fontSize: "13px", fontWeight: 600 }}
            >
              <Building2 size={16} color="var(--primary)" />
              <span>{activeOrg.name}</span>
              <span
                className="tag"
                style={{
                  fontSize: "11px",
                  background: "var(--primary-muted)",
                  color: "var(--primary)",
                }}
              >
                {ROLE_LABELS[activeOrg.role] || activeOrg.role}
              </span>
              <ChevronDown size={14} />
            </button>

            {showOrgMenu && (
              <div
                className="card animate-fade"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "6px",
                  width: "260px",
                  padding: "8px",
                  zIndex: 50,
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim)", padding: "6px 8px", textTransform: "uppercase" }}>
                  Suas Instituições
                </div>
                {orgs.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      switchOrg(o);
                      setShowOrgMenu(false);
                    }}
                    className="btn"
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      background: o.id === activeOrg.id ? "var(--surface-alt)" : "transparent",
                      border: "none",
                      fontSize: "13px",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: o.id === activeOrg.id ? 700 : 400 }}>{o.name}</span>
                    <span className="tag" style={{ fontSize: "10px" }}>{ROLE_LABELS[o.role] || o.role}</span>
                  </button>
                ))}
                <div style={{ borderTop: "1px solid var(--border)", marginTop: "6px", paddingTop: "6px" }}>
                  <button
                    onClick={() => {
                      setShowOrgMenu(false);
                      setShowCreateModal(true);
                    }}
                    className="btn"
                    style={{ width: "100%", justifyContent: "flex-start", padding: "8px 10px", border: "none", fontSize: "13px", gap: "6px", color: "var(--primary)" }}
                  >
                    <Plus size={14} /> Nova Instituição
                  </button>
                  {["owner", "admin"].includes(activeOrg.role) && (
                    <button
                      onClick={() => {
                        setShowOrgMenu(false);
                        setEditOrgName(activeOrg.name);
                        setShowSettingsModal(true);
                      }}
                      className="btn"
                      style={{ width: "100%", justifyContent: "flex-start", padding: "8px 10px", border: "none", fontSize: "13px", gap: "6px" }}
                    >
                      <Settings size={14} /> Configurações
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Perfil & Sair */}
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {user.profile?.name ?? user.email}
            </span>
            <button
              onClick={signOut}
              className="btn btn-secondary"
              style={{ padding: "8px 12px", gap: "6px", fontSize: "13px" }}
              title="Sair da conta"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        ) : (
          <button
            onClick={() => onNavigate("auth")}
            className="btn btn-primary"
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            Entrar / Cadastrar
          </button>
        )}
      </div>

      {/* ── Conteúdo Principal ── */}
      <div className="animate-fade" style={{ width: "100%", maxWidth: "560px", textAlign: "center" }}>
        <h1
          style={{
            fontSize: "36px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: "8px",
            color: "var(--text)",
          }}
        >
          Kiwi<span style={{ color: "var(--primary)" }}>i</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px", marginBottom: "32px" }}>
          Controle de filas em tempo real para seu estabelecimento
        </p>

        {/* ── Convites Pendentes Detectados por E-mail (Priority 7) ── */}
        {user && pendingInvites.length > 0 && (
          <div
            className="card"
            style={{
              padding: "16px 20px",
              marginBottom: "24px",
              border: "1.5px solid var(--primary-border)",
              background: "var(--primary-glow)",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--primary)", fontWeight: 700, fontSize: "14px" }}>
              <Mail size={16} /> Convites Pendentes Para Você
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pendingInvites.map((inv) => (
                <div
                  key={inv.token}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--surface)",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text)" }}>{inv.org_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Cargo: {ROLE_LABELS[inv.role] || inv.role}</div>
                  </div>
                  <button
                    onClick={() => handleAcceptPendingInvite(inv.token)}
                    disabled={acceptingToken === inv.token}
                    className="btn btn-primary btn-sm"
                  >
                    {acceptingToken === inv.token ? "Aceitando..." : "Aceitar Convite"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Caso usuário não tenha organizações criadas (Priority 7) ── */}
        {user && orgs.length === 0 ? (
          <div className="card" style={{ padding: "28px", textAlign: "center", marginBottom: "24px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", color: "var(--text)" }}>
              Bem-vindo ao Kiwii!
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
              Para começar a atender, crie sua instituição ou entre em uma já existente com código de convite.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                className="btn btn-primary"
                onClick={() => onNavigate("org-setup")}
                style={{ padding: "12px 20px" }}
              >
                Configurar Instituição
              </button>
            </div>
          </div>
        ) : (
          /* ── Cards de Ação Principal ── */
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
            {/* Paciente / Check-in */}
            <button
              onClick={() => onNavigate("client-checkin")}
              className="card btn"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                textAlign: "left",
                cursor: "pointer",
                border: "1.5px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "12px",
                    background: "var(--primary-muted)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Ticket size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--text)" }}>
                    Entrar em uma Fila
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    Pegue sua senha digital via QR Code ou código da sala
                  </div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-dim)" />
            </button>

            {/* Abrir Sala / Host */}
            {user && activeOrg && (
              <button
                onClick={() => onNavigate("host-setup")}
                className="card btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "20px 24px",
                  textAlign: "left",
                  cursor: "pointer",
                  border: "1.5px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "12px",
                      background: "var(--primary-muted)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--text)" }}>
                      Abrir Nova Sala
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                      Inicie uma sessão de atendimento para {activeOrg.name}
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-dim)" />
              </button>
            )}

            {/* Gerenciar Membros (Com indicador de solicitações pendentes) */}
            {user && activeOrg && ["owner", "admin"].includes(activeOrg.role) && (
              <button
                onClick={() => onNavigate("members")}
                className="card btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 24px",
                  textAlign: "left",
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <Users size={20} color="var(--primary)" />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                        Membros da Equipe
                      </span>
                      {joinRequests.length > 0 && (
                        <span
                          className="tag"
                          style={{
                            background: "var(--primary)",
                            color: "#fff",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "12px",
                          }}
                        >
                          {joinRequests.length} pendente{joinRequests.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      Convites com link temporário e aprovação de equipe
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-dim)" />
              </button>
            )}

            {/* Dashboard & Histórico (M4/M6) */}
            {user && activeOrg && (
              <button
                onClick={() => onNavigate("host-dashboard")}
                className="card btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 24px",
                  textAlign: "left",
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <BarChart3 size={20} color="var(--primary)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                      Dashboard & Histórico de Sessões
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      Acompanhe métricas, atendimentos passados e exporte relatórios
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-dim)" />
              </button>
            )}
          </div>
        )}

        {/* ── Salas Permanentes Cadastradas (Iniciar Dia - Prioridade 7) ── */}
        {user && activeOrg && savedRooms.length > 0 && (
          <div className="card" style={{ padding: "20px", textAlign: "left", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  Salas Cadastradas (Iniciar Dia)
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                  Abra a fila do dia com 1 clique sem precisar reconfigurar
                </p>
              </div>
              {["admin", "owner"].includes(activeOrg.role) && (
                <button
                  onClick={() => onNavigate("host-setup")}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: "4px", fontSize: "12px" }}
                >
                  <Plus size={14} /> Nova Sala
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {savedRooms.map((sr) => (
                <div
                  key={sr.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                      {sr.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {sr.desk_count || 1} guichê(s) · {sr.categories?.length || 0} categoria(s)
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {["admin", "owner"].includes(activeOrg.role) && (
                      <button
                        onClick={() => onNavigate("host-setup", { editSavedRoom: sr })}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: "12px", gap: "4px" }}
                        title="Configurar categorias, guichês e campos desta sala"
                      >
                        <Settings size={13} /> Configurar
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenSavedRoom(sr)}
                      disabled={openingSavedRoomId === sr.id}
                      className="btn btn-primary btn-sm"
                      style={{ fontWeight: 700 }}
                    >
                      {openingSavedRoomId === sr.id ? "Abrindo..." : "Iniciar Dia"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Salas Ativas da Instituição (Guichês - Priority 5) ── */}
        {user && activeOrg && activeRooms.length > 0 && (
          <div className="card" style={{ padding: "20px", textAlign: "left", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "12px", color: "var(--text)" }}>
              Sessões em Andamento (Trabalhar como Guichê)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {activeRooms.map((r) => (
                <div
                  key={r.code}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                      {r.name} · <span className="mono" style={{ color: "var(--primary)" }}>{r.code}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {r.queueLength} cliente(s) na fila · {r.totalCounters || r.counters?.length || 1} guichê(s)
                      {r.occupiedCountersCount > 0 && (
                        <span style={{ color: r.isFull ? "var(--warn)" : "var(--primary)", marginLeft: "6px" }}>
                          · {r.occupiedCountersCount}/{r.totalCounters || r.counters?.length || 1} ocupado(s)
                          {r.occupiedBy?.length > 0 ? ` (${r.occupiedBy.join(", ")})` : ""}
                        </span>
                      )}
                      {r.locked && <span style={{ color: "var(--danger)", marginLeft: "8px" }}>🔒 Trancada</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (r.isFull) {
                        const isSingle = (r.totalCounters || r.counters?.length || 1) === 1;
                        setRoomWarning({
                          title: isSingle ? "Guichê Já Ocupado" : "Capacidade Máxima Atingida",
                          message: isSingle
                            ? `O guichê desta sala já está sendo operado por ${r.occupiedBy?.[0] || "outro operador"}. Esta sala possui apenas 1 guichê para atendimento.`
                            : `Todos os ${r.totalCounters} guichês desta sala já estão ocupados no momento (${r.occupiedBy?.join(", ")}).`,
                          roomCode: r.code,
                        });
                        return;
                      }
                      onNavigate("host-panel", { roomCode: r.code });
                    }}
                    className={`btn ${r.isFull ? "btn-secondary" : "btn-primary"} btn-sm`}
                  >
                    {r.isFull ? "Acompanhar (Ocupada)" : "Entrar como Guichê"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Alerta de Sala Ocupada (Prioridades 3 e 4) ── */}
      <Modal open={!!roomWarning} onClose={() => setRoomWarning(null)} maxWidth="420px">
        <div style={{ textAlign: "center", marginBottom: "14px" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--warn-glow)",
              color: "var(--warn)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "10px",
            }}
          >
            <AlertCircle size={22} />
          </div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
            {roomWarning?.title}
          </h3>
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "20px", textAlign: "center" }}>
          {roomWarning?.message}
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-secondary" onClick={() => setRoomWarning(null)} style={{ flex: 1 }}>
            Voltar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              const code = roomWarning?.roomCode;
              setRoomWarning(null);
              onNavigate("host-panel", { roomCode: code });
            }}
            style={{ flex: 1 }}
          >
            Entrar como Visualizador
          </button>
        </div>
      </Modal>

      {/* ── Modal Criar Organização ── */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="400px">
        <h3 style={{ fontWeight: 700, fontSize: "17px", marginBottom: "16px", color: "var(--text)" }}>
          Nova Instituição
        </h3>
        <input
          className="input"
          placeholder="Nome da instituição..."
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
          autoFocus
        />
        {orgError && <p className="error-msg">{orgError}</p>}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleCreateOrg} disabled={isSubmitting || !newOrgName.trim()} style={{ flex: 1 }}>
            {isSubmitting ? "Criando..." : "Criar"}
          </button>
        </div>
      </Modal>

      {/* ── Modal Configurações da Organização ── */}
      <Modal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} maxWidth="420px">
        <h3 style={{ fontWeight: 700, fontSize: "17px", marginBottom: "16px", color: "var(--text)" }}>
          Configurações da Instituição
        </h3>
        <input
          className="input"
          value={editOrgName}
          onChange={(e) => setEditOrgName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUpdateOrg()}
        />
        {orgError && <p className="error-msg">{orgError}</p>}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleUpdateOrg} disabled={isSubmitting || !editOrgName.trim()} style={{ flex: 1 }}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {["admin", "owner"].includes(activeOrg?.role) && (
          <div style={{ borderTop: "1px solid var(--border)", marginTop: "20px", paddingTop: "14px" }}>
            <button
              className="btn btn-danger"
              onClick={() => setDeleteConfirm(true)}
              style={{ width: "100%", padding: "10px", fontSize: "13px" }}
            >
              Excluir Instituição Permanentemente
            </button>
          </div>
        )}
      </Modal>

      {/* Confirmar Exclusão */}
      <ConfirmModal
        open={deleteConfirm}
        title="Excluir Instituição"
        message={`Tem certeza que deseja excluir "${activeOrg?.name}"? Todas as salas e filas serão permanentemente removidas.`}
        confirmText="Sim, excluir"
        danger
        onConfirm={handleDeleteOrg}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  );
};

export default LandingScreen;
