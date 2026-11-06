/**
 * screens/LandingScreen.jsx
 *
 * Tela inicial — Design System v3.0
 * Mostra organização ativa, seleção de perfil e ações com ícones Lucide.
 */
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { createOrg, updateOrg, deleteOrg } from "../lib/api";
import socket from "../lib/socket";
import ConfirmModal from "../components/ConfirmModal";
import {
  LayoutDashboard,
  Ticket,
  Plus,
  Settings,
  Users,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
  ArrowRight,
  X,
  AlertCircle,
  Radio,
  Building2,
  Trash2,
  Bell,
  RotateCcw,
  CheckCircle,
  BarChart3,
} from "lucide-react";

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

  // ── Ticket ativo do cliente (acompanhamento e recall no menu principal) ─
  const [activeTicketData, setActiveTicketData] = useState(() => {
    try {
      const saved = localStorage.getItem("fila_io_active_ticket");
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

    joinRoom();
    socket.on("connect", joinRoom);

    const handleQueueUpdate = ({ roomCode, queue }) => {
      if (roomCode !== room.code) return;
      const me = queue.find((t) => t.token === ticket.token);
      if (!me) return;
      setActiveTicketData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ticket: { ...prev.ticket, ...me, status: "waiting", isRecall: false },
        };
        try {
          localStorage.setItem("fila_io_active_ticket", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    const handleTicketCalled = ({ token }) => {
      if (token !== ticket.token) return;
      navigator.vibrate?.([200, 100, 200, 100, 400]);
      setActiveTicketData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ticket: { ...prev.ticket, status: "called", isRecall: false },
        };
        try {
          localStorage.setItem("fila_io_active_ticket", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    const handleTicketRecalled = ({ token }) => {
      if (token !== ticket.token) return;
      navigator.vibrate?.([300, 150, 300, 150, 600]);
      setActiveTicketData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ticket: { ...prev.ticket, status: "called", isRecall: true },
        };
        try {
          localStorage.setItem("fila_io_active_ticket", JSON.stringify(updated));
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
          localStorage.setItem("fila_io_active_ticket", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    const handleTicketStatus = ({ ticket: statusTicket }) => {
      if (!statusTicket || statusTicket.token !== ticket.token) return;
      setActiveTicketData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ticket: { ...prev.ticket, ...statusTicket },
        };
        try {
          localStorage.setItem("fila_io_active_ticket", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    const handleTicketRemoved = ({ token }) => {
      if (token !== ticket.token) return;
      try {
        localStorage.removeItem("fila_io_active_ticket");
      } catch {}
      setActiveTicketData(null);
    };

    socket.on("queue_update", handleQueueUpdate);
    socket.on("ticket_called", handleTicketCalled);
    socket.on("ticket_recalled", handleTicketRecalled);
    socket.on("ticket_served", handleTicketServed);
    socket.on("ticket_status", handleTicketStatus);
    socket.on("ticket_removed", handleTicketRemoved);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("queue_update", handleQueueUpdate);
      socket.off("ticket_called", handleTicketCalled);
      socket.off("ticket_recalled", handleTicketRecalled);
      socket.off("ticket_served", handleTicketServed);
      socket.off("ticket_status", handleTicketStatus);
      socket.off("ticket_removed", handleTicketRemoved);
    };
  }, [activeTicketData?.ticket?.token, activeTicketData?.room?.code]);

  const dismissActiveTicket = () => {
    try {
      localStorage.removeItem("fila_io_active_ticket");
    } catch {}
    setActiveTicketData(null);
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setIsSubmitting(true);
    setOrgError("");
    try {
      await createOrg(newOrgName);
      await refreshOrgs();
      setShowCreateModal(false);
      setNewOrgName("");
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
      await updateOrg(activeOrg.id, { name: editOrgName });
      await refreshOrgs();
      setShowSettingsModal(false);
    } catch (err) {
      setOrgError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!activeOrg || activeOrg.role !== "owner") return;
    setIsSubmitting(true);
    setOrgError("");
    try {
      await deleteOrg(activeOrg.id);
      await refreshOrgs();
      setShowSettingsModal(false);
    } catch (err) {
      setOrgError(err.message);
    } finally {
      setIsSubmitting(false);
      setDeleteConfirm(false);
    }
  };

  const cards = [
    {
      role: "host",
      icon: LayoutDashboard,
      title: "Painel do Host",
      sub: "Criar e gerenciar sala de atendimento",
      color: "var(--primary)",
      target: "host-setup",
      requiresAuth: true,
    },
    ...(user
      ? [
          {
            role: "dashboard",
            icon: BarChart3,
            title: "Histórico & Dashboard",
            sub: "Relatórios de sessões anteriores e métricas",
            color: "var(--priority-low)",
            target: "host-dashboard",
            requiresAuth: true,
          },
        ]
      : []),
    {
      role: "client",
      icon: Ticket,
      title: "Entrar na Fila",
      sub: "Escaneie o QR ou digite o código da sala",
      color: "var(--accent)",
      target: "client-checkin",
      requiresAuth: false,
    },
  ];

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
        overflow: "hidden",
      }}
    >
      {/* Padrão de fundo suave */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.25,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 50% at 50% 50%, var(--primary-glow) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Barra superior de usuário logado */}
      {user && (
        <header
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "6px",
                  background: "var(--primary-muted)",
                  border: "1px solid var(--primary-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary)",
                }}
              >
                <Radio size={15} />
              </div>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                fila<span style={{ color: "var(--primary)" }}>.io</span>
              </span>
            </div>
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "13px",
                borderLeft: "1px solid var(--border)",
                paddingLeft: "14px",
              }}
            >
              {user.email}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Seletor de organização */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowOrgMenu(!showOrgMenu)}
                className="btn btn-secondary"
                style={{
                  padding: "6px 12px",
                  fontSize: "13px",
                  gap: "8px",
                  fontWeight: 500,
                }}
              >
                <Building2 size={14} style={{ color: "var(--primary)" }} />
                <span
                  style={{
                    maxWidth: "150px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeOrg?.name ?? "Sem organização"}
                </span>
                <span
                  className="tag"
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    textTransform: "uppercase",
                  }}
                >
                  {activeOrg?.role}
                </span>
                <ChevronDown size={13} style={{ color: "var(--text-dim)" }} />
              </button>

              {showOrgMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    boxShadow: "var(--shadow-lg)",
                    minWidth: "230px",
                    zIndex: 100,
                    overflow: "hidden",
                    padding: "4px",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 12px",
                      fontSize: "11px",
                      color: "var(--text-dim)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 600,
                    }}
                  >
                    Organizações
                  </div>
                  {orgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        switchOrg(org);
                        setShowOrgMenu(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        padding: "10px 12px",
                        textAlign: "left",
                        background:
                          org.id === activeOrg?.id
                            ? "var(--primary-muted)"
                            : "transparent",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        color: "var(--text)",
                        fontSize: "13px",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{org.name}</span>
                      <span
                        className="tag"
                        style={{ fontSize: "10px", padding: "1px 5px" }}
                      >
                        {org.role}
                      </span>
                    </button>
                  ))}

                  <div
                    style={{
                      height: "1px",
                      background: "var(--border)",
                      margin: "4px 0",
                    }}
                  />

                  <button
                    onClick={() => {
                      setShowOrgMenu(false);
                      setShowCreateModal(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "9px 12px",
                      background: "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "var(--surface-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <Plus size={14} style={{ color: "var(--primary)" }} />
                    Nova Organização
                  </button>

                  {activeOrg && ["owner", "admin"].includes(activeOrg.role) && (
                    <button
                      onClick={() => {
                        setEditOrgName(activeOrg.name);
                        setShowOrgMenu(false);
                        setShowSettingsModal(true);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        padding: "9px 12px",
                        background: "transparent",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        color: "var(--text)",
                        fontSize: "13px",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "var(--surface-hover)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <Settings size={14} style={{ color: "var(--accent)" }} />
                      Configurações da Org
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onNavigate("members");
                      setShowOrgMenu(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "9px 12px",
                      background: "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "var(--surface-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <Users size={14} style={{ color: "var(--info)" }} />
                    Gerenciar Membros
                  </button>

                  <button
                    onClick={() => {
                      toggleTheme();
                      setShowOrgMenu(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "9px 12px",
                      background: "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "var(--surface-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {theme === "light" ? (
                      <Moon size={14} style={{ color: "var(--text-secondary)" }} />
                    ) : (
                      <Sun size={14} style={{ color: "var(--accent)" }} />
                    )}
                    {theme === "light" ? "Modo Escuro" : "Modo Claro"}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={signOut}
              className="btn btn-secondary"
              style={{
                fontSize: "12px",
                padding: "6px 12px",
                gap: "6px",
                color: "var(--text-secondary)",
              }}
              title="Desconectar"
            >
              <LogOut size={13} />
              Sair
            </button>
          </div>
        </header>
      )}

      <main
        className="animate-fade"
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          width: "100%",
          maxWidth: "480px",
          marginTop: user ? "50px" : "0",
        }}
      >
        {/* Header Branding */}
        <div style={{ marginBottom: "40px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                background: "var(--surface)",
                border: "1px solid var(--primary-border)",
                boxShadow: "0 0 20px var(--primary-glow)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
              }}
            >
              <Radio size={24} />
            </div>
            <span
              style={{
                fontSize: "32px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                fontFamily: "var(--font-display)",
              }}
            >
              fila<span style={{ color: "var(--primary)" }}>.io</span>
            </span>
          </div>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "13px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Sistema de Filas em Tempo Real
          </p>
        </div>

        {/* Banner de Senha Ativa / Alerta de Chamada ou Recall */}
        {activeTicketData?.ticket && (
          <div
            className="card animate-fade"
            style={{
              marginBottom: "28px",
              padding: "16px 20px",
              textAlign: "left",
              position: "relative",
              border: activeTicketData.ticket.isRecall
                ? "2px solid var(--accent)"
                : activeTicketData.ticket.status === "called"
                ? "2px solid var(--primary)"
                : "1px solid var(--border)",
              background: activeTicketData.ticket.isRecall
                ? "var(--accent-muted)"
                : activeTicketData.ticket.status === "called"
                ? "var(--primary-muted)"
                : "var(--surface)",
              boxShadow:
                activeTicketData.ticket.isRecall || activeTicketData.ticket.status === "called"
                  ? "var(--shadow-lg)"
                  : "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: activeTicketData.ticket.isRecall
                      ? "var(--accent)"
                      : activeTicketData.ticket.status === "called"
                      ? "var(--primary)"
                      : "var(--surface-hover)",
                    color:
                      activeTicketData.ticket.isRecall || activeTicketData.ticket.status === "called"
                        ? "#000"
                        : "var(--text)",
                    flexShrink: 0,
                    animation:
                      activeTicketData.ticket.isRecall || activeTicketData.ticket.status === "called"
                        ? "pulse 1.8s infinite ease-in-out"
                        : "none",
                  }}
                >
                  {activeTicketData.ticket.isRecall ? (
                    <RotateCcw size={22} />
                  ) : activeTicketData.ticket.status === "called" ? (
                    <Bell size={22} />
                  ) : activeTicketData.ticket.status === "served" ? (
                    <CheckCircle size={22} />
                  ) : (
                    <Ticket size={22} />
                  )}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                    <span
                      className="mono"
                      style={{
                        fontWeight: 800,
                        fontSize: "16px",
                        color: activeTicketData.ticket.isRecall
                          ? "var(--accent)"
                          : activeTicketData.ticket.status === "called"
                          ? "var(--primary)"
                          : "var(--text)",
                      }}
                    >
                      #{activeTicketData.ticket.token?.split("-").slice(-1)[0].toUpperCase()}
                    </span>
                    <span
                      className="tag"
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        fontWeight: 700,
                        background: activeTicketData.ticket.isRecall
                          ? "var(--accent)"
                          : activeTicketData.ticket.status === "called"
                          ? "var(--primary)"
                          : "var(--border)",
                        color:
                          activeTicketData.ticket.isRecall || activeTicketData.ticket.status === "called"
                            ? "#000"
                            : "var(--text-secondary)",
                      }}
                    >
                      {activeTicketData.ticket.isRecall
                        ? "CHAMADO DE VOLTA!"
                        : activeTicketData.ticket.status === "called"
                        ? "É SUA VEZ!"
                        : activeTicketData.ticket.status === "served"
                        ? "ATENDIDO"
                        : `${activeTicketData.ticket.position || 1}º NA FILA`}
                    </span>
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {activeTicketData.ticket.isRecall
                      ? "Você foi chamado de volta! Compareça ao guichê."
                      : activeTicketData.ticket.status === "called"
                      ? "Sua vez foi chamada! Dirija-se ao guichê."
                      : activeTicketData.ticket.status === "served"
                      ? "Atendimento finalizado com sucesso."
                      : `${activeTicketData.room?.name || "Sala"} • Categoria: ${activeTicketData.ticket.category}`}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  onClick={() =>
                    onNavigate("live-ticket", {
                      ticket: activeTicketData.ticket,
                      room: activeTicketData.room,
                    })
                  }
                  className="btn btn-primary"
                  style={{
                    fontSize: "12px",
                    padding: "8px 14px",
                    gap: "6px",
                    whiteSpace: "nowrap",
                    background: activeTicketData.ticket.isRecall ? "var(--accent)" : "var(--primary)",
                    color: "#000",
                    border: "none",
                  }}
                >
                  Ver Senha <ArrowRight size={14} />
                </button>
                <button
                  onClick={dismissActiveTicket}
                  className="btn btn-secondary"
                  style={{
                    padding: "8px",
                    minWidth: "auto",
                    borderRadius: "6px",
                    color: "var(--text-dim)",
                  }}
                  title="Ocultar aviso"
                  aria-label="Ocultar aviso de senha"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {cards.map((c) => {
            const Icon = c.icon;
            const isHovered = hovered === c.role;
            return (
              <button
                key={c.role}
                className="card"
                onMouseEnter={() => setHovered(c.role)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onNavigate(c.target)}
                style={{
                  padding: "24px 20px",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "18px",
                  borderColor: isHovered ? c.color : "var(--border)",
                  transition: "all 0.2s var(--ease-out)",
                  transform: isHovered ? "translateY(-2px)" : "none",
                  boxShadow: isHovered
                    ? `0 12px 30px rgba(0,0,0,0.3), 0 0 20px ${
                        c.role === "host"
                          ? "var(--primary-glow)"
                          : "var(--accent-muted)"
                      }`
                    : "var(--shadow-sm)",
                  cursor: "pointer",
                  width: "100%",
                  background: isHovered ? "var(--surface-hover)" : "var(--surface)",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    background:
                      c.role === "host"
                        ? "var(--primary-muted)"
                        : "var(--accent-muted)",
                    border: `1px solid ${
                      c.role === "host"
                        ? "var(--primary-border)"
                        : "var(--accent-border)"
                    }`,
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: c.color,
                    flexShrink: 0,
                    transition: "transform 0.2s var(--ease-spring)",
                    transform: isHovered ? "scale(1.06)" : "scale(1)",
                  }}
                >
                  <Icon size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      color: isHovered ? c.color : "var(--text)",
                      transition: "color 0.2s",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {c.title}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      marginTop: "4px",
                    }}
                  >
                    {c.sub}
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  style={{
                    color: c.color,
                    opacity: isHovered ? 1 : 0.4,
                    transition: "all 0.2s var(--ease-out)",
                    transform: isHovered ? "translateX(4px)" : "none",
                  }}
                />
              </button>
            );
          })}
        </div>
      </main>

      {/* Modal Nova Organização */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            className="card animate-fade"
            style={{
              background: "var(--surface)",
              width: "100%",
              maxWidth: "420px",
              padding: "28px",
              border: "1px solid var(--border)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowCreateModal(false)}
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
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "8px",
                  background: "var(--primary-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary)",
                }}
              >
                <Plus size={18} />
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
                Nova Organização
              </h2>
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              Crie um novo espaço corporativo para gerenciar salas e filas.
            </p>
            <input
              className="input"
              placeholder="Ex: Clínica Saúde Integrada"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              style={{ marginBottom: "16px" }}
              autoFocus
            />
            {orgError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--danger)",
                  fontSize: "13px",
                  marginBottom: "16px",
                  background: "var(--danger-muted)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--danger-border)",
                }}
              >
                <AlertCircle size={15} />
                <span>{orgError}</span>
              </div>
            )}
            <button
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px" }}
              onClick={handleCreateOrg}
              disabled={isSubmitting || !newOrgName.trim()}
            >
              {isSubmitting ? "Criando organização..." : "Criar Organização"}
            </button>
          </div>
        </div>
      )}

      {/* Modal Configurações da Organização */}
      {showSettingsModal && activeOrg && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            className="card animate-fade"
            style={{
              background: "var(--surface)",
              width: "100%",
              maxWidth: "420px",
              padding: "28px",
              border: "1px solid var(--border)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowSettingsModal(false)}
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
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "8px",
                  background: "var(--accent-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                }}
              >
                <Settings size={18} />
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
                Configurações
              </h2>
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              Gerencie os dados de <strong>{activeOrg.name}</strong>
            </p>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "8px",
              }}
            >
              Nome da Organização
            </label>
            <input
              className="input"
              value={editOrgName}
              onChange={(e) => setEditOrgName(e.target.value)}
              style={{ marginBottom: "16px" }}
            />
            {orgError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--danger)",
                  fontSize: "13px",
                  marginBottom: "16px",
                  background: "var(--danger-muted)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--danger-border)",
                }}
              >
                <AlertCircle size={15} />
                <span>{orgError}</span>
              </div>
            )}
            <button
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", marginBottom: "24px" }}
              onClick={handleUpdateOrg}
              disabled={isSubmitting || !editOrgName.trim()}
            >
              {isSubmitting ? "Salvando alterações..." : "Salvar Alterações"}
            </button>

            {activeOrg.role === "owner" && (
              <div
                style={{
                  paddingTop: "20px",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <h3
                  style={{
                    color: "var(--danger)",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Trash2 size={14} /> Zona de Perigo
                </h3>
                <p
                  style={{
                    color: "var(--text-dim)",
                    fontSize: "12px",
                    marginBottom: "14px",
                    lineHeight: 1.4,
                  }}
                >
                  Excluir esta organização removerá permanentemente todos os
                  membros, salas e histórico de atendimentos.
                </p>
                <button
                  className="btn btn-danger"
                  style={{ width: "100%", padding: "10px" }}
                  onClick={() => setDeleteConfirm(true)}
                  disabled={isSubmitting}
                >
                  Excluir Organização
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      <ConfirmModal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDeleteOrg}
        title="Excluir Organização"
        message={`Tem certeza que deseja excluir permanentemente a organização "${activeOrg?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir Permanentemente"
        danger
      />
    </div>
  );
};

export default LandingScreen;
