/**
 * screens/LandingScreen.jsx
 *
 * Tela inicial — mostra org ativa, cargo real, salas ativas da instituição (guichês),
 * convites pendentes e opções de navegação.
 */
import { useState, useEffect } from "react";
import {
  Users,
  LayoutDashboard,
  Ticket,
  Settings,
  Plus,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
  Mail,
  Building,
  CheckCircle2,
  Lock,
  DoorOpen,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  createOrg,
  updateOrg,
  deleteOrg,
  fetchActiveRooms,
  fetchMyInvites,
  acceptInvite,
} from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";
import Modal from "../components/Modal";

const ROLE_LABELS = { owner: "Dono", admin: "Administrador", operator: "Operador" };

const LandingScreen = ({ onNavigate }) => {
  const { user, activeOrg, orgs, switchOrg, signOut, refreshOrgs } = useAuth();
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

  // Convites pendentes do usuário - Priority 7
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showInvitesModal, setShowInvitesModal] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  // Carrega salas ativas e convites pendentes
  useEffect(() => {
    if (user && activeOrg) {
      setLoadingRooms(true);
      fetchActiveRooms(activeOrg.id)
        .then((data) => setActiveRooms(data.rooms || []))
        .catch(() => setActiveRooms([]))
        .finally(() => setLoadingRooms(false));
    } else {
      setActiveRooms([]);
    }

    if (user) {
      fetchMyInvites()
        .then((data) => setPendingInvites(data.invites || []))
        .catch(() => setPendingInvites([]));
    }
  }, [user, activeOrg]);

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

  const handleAcceptInviteDirect = async (token) => {
    setAcceptingInvite(true);
    try {
      await acceptInvite(token);
      await refreshOrgs();
      const updated = await fetchMyInvites();
      setPendingInvites(updated.invites || []);
      setShowInvitesModal(false);
    } catch (err) {
      alert("Erro ao aceitar convite: " + err.message);
    } finally {
      setAcceptingInvite(false);
    }
  };

  const cards = [
    {
      role: "host",
      Icon: LayoutDashboard,
      title: "Painel do Host / Nova Sala",
      sub: "Criar uma nova sala de atendimento e configurar guichês",
      color: "var(--accent)",
      shadow: "var(--accent-glow)",
      target: "host-setup",
      requiresAuth: true,
    },
    {
      role: "client",
      Icon: Ticket,
      title: "Entrar na Fila (Cliente)",
      sub: "Escaneie o QR da sala ou digite o código de 6 dígitos",
      color: "var(--info)",
      shadow: "rgba(91,141,190,0.18)",
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
        padding: "80px 24px 40px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Padrão de fundo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 45% at 50% 40%, var(--accent-glow) 0%, transparent 70%)",
        }}
      />

      {/* ── Top Bar ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span className="display" style={{ fontSize: "16px", fontWeight: 800 }}>
            Kiwi<span style={{ color: "var(--accent)" }}>i</span>
          </span>
          {user && (
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              {user.profile?.name || user.email}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {user ? (
            <>
              {/* Notificação de Convites Pendentes (Priority 7) */}
              {pendingInvites.length > 0 && (
                <button
                  onClick={() => setShowInvitesModal(true)}
                  className="btn"
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    gap: "6px",
                    background: "var(--accent-glow)",
                    borderColor: "var(--accent)",
                    color: "var(--accent)",
                    fontWeight: 700,
                  }}
                >
                  <Mail size={14} /> Convites ({pendingInvites.length})
                </button>
              )}

              {/* Seletor de Organização e Cargo (Priority 4 & 7) */}
              {orgs.length > 0 && (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowOrgMenu(!showOrgMenu)}
                    className="btn"
                    style={{ padding: "6px 12px", fontSize: "13px", gap: "8px" }}
                  >
                    <Building size={14} color="var(--text-muted)" />
                    <span
                      style={{
                        maxWidth: "160px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: 600,
                      }}
                    >
                      {activeOrg?.name ?? "Selecionar Org"}
                    </span>
                    {activeOrg && (
                      <span className="tag" style={{ fontSize: "10px" }}>
                        {ROLE_LABELS[activeOrg.role] || activeOrg.role}
                      </span>
                    )}
                    <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
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
                        minWidth: "240px",
                        zIndex: 100,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 14px",
                          borderBottom: "1px solid var(--border)",
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Suas Instituições
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
                            padding: "12px 16px",
                            textAlign: "left",
                            background: org.id === activeOrg?.id ? "var(--accent-glow)" : "transparent",
                            border: "none",
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            color: "var(--text)",
                            fontSize: "13px",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{org.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              Cargo: {ROLE_LABELS[org.role] || org.role}
                            </div>
                          </div>
                          {org.id === activeOrg?.id && (
                            <CheckCircle2 size={16} color="var(--accent)" />
                          )}
                        </button>
                      ))}

                      <button
                        onClick={() => {
                          setShowOrgMenu(false);
                          setShowCreateModal(true);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          width: "100%",
                          padding: "10px 16px",
                          textAlign: "left",
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid var(--border)",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          color: "var(--text)",
                          fontSize: "13px",
                        }}
                      >
                        <Plus size={15} /> Nova Instituição
                      </button>

                      {activeOrg && ["owner", "admin"].includes(activeOrg.role) && (
                        <>
                          <button
                            onClick={() => {
                              onNavigate("members");
                              setShowOrgMenu(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              width: "100%",
                              padding: "10px 16px",
                              textAlign: "left",
                              background: "transparent",
                              border: "none",
                              borderBottom: "1px solid var(--border)",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              color: "var(--accent)",
                              fontSize: "13px",
                            }}
                          >
                            <Users size={15} /> Gerenciar Membros e Cargos
                          </button>
                          <button
                            onClick={() => {
                              setEditOrgName(activeOrg.name);
                              setShowOrgMenu(false);
                              setShowSettingsModal(true);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              width: "100%",
                              padding: "10px 16px",
                              textAlign: "left",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              color: "var(--text)",
                              fontSize: "13px",
                            }}
                          >
                            <Settings size={15} /> Configurações da Instituição
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={signOut}
                className="btn"
                style={{ fontSize: "12px", padding: "6px 12px", color: "var(--text-muted)" }}
              >
                Sair
              </button>
            </>
          ) : (
            <button
              onClick={() => onNavigate("auth")}
              className="btn btn-primary"
              style={{ fontSize: "13px", padding: "6px 16px" }}
            >
              Entrar / Cadastrar
            </button>
          )}
        </div>
      </div>

      <div
        className="animate-fade"
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          width: "100%",
          maxWidth: "480px",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: "36px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                background: "var(--accent)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={22} color="#04141C" strokeWidth={2.25} />
            </div>
            <span
              className="display"
              style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em" }}
            >
              Kiwi<span style={{ color: "var(--accent)" }}>i</span>
            </span>
          </div>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Controle de Filas Inteligente
          </p>
        </div>

        {/* ── Se o usuário NÃO tem organizações (Priority 7) ── */}
        {user && orgs.length === 0 && (
          <div className="card" style={{ padding: "26px", marginBottom: "24px", textAlign: "left" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Bem-vindo ao Kiwii!</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
              Você ainda não está associado a nenhuma instituição. O que deseja fazer?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                className="btn btn-primary"
                onClick={() => onNavigate("org-setup")}
                style={{
                  padding: "14px",
                  fontSize: "14px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Building size={18} />
                  <span>Criar Minha Própria Instituição</span>
                </div>
                <ChevronRight size={18} />
              </button>

              <button
                className="btn"
                onClick={() => onNavigate("org-setup")}
                style={{
                  padding: "14px",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Mail size={18} />
                  <span>Participar com Código de Convite</span>
                </div>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── Salas Ativas da Instituição (Operar como Guichê) (Priority 5) ── */}
        {user && activeOrg && activeRooms.length > 0 && (
          <div
            className="card"
            style={{
              padding: "20px",
              marginBottom: "24px",
              textAlign: "left",
              borderColor: "var(--accent-dim)",
              background: "var(--surface)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "14px",
              }}
            >
              <div>
                <h3 style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Building size={16} color="var(--accent)" /> Sessões Abertas na Instituição
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Entre para atender em um guichê na mesma fila em tempo real
                </p>
              </div>
              <span className="tag">{activeRooms.length}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {activeRooms.map((r) => {
                const totalCounters = r.counters?.length || 1;
                const claimedCount = Object.keys(r.counterClaims || {}).length;

                return (
                  <div
                    key={r.code}
                    className="card"
                    style={{
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      background: "var(--surface-hover)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 700, fontSize: "14px" }}>{r.name}</span>
                        <span
                          className="mono"
                          style={{ fontSize: "11px", color: "var(--accent)", letterSpacing: "0.08em" }}
                        >
                          #{r.code}
                        </span>
                        {r.locked && (
                          <span
                            className="tag"
                            style={{
                              background: "rgba(245,158,11,0.15)",
                              color: "var(--warn)",
                              fontSize: "10px",
                            }}
                          >
                            <Lock size={10} /> Trancada
                          </span>
                        )}
                      </div>
                      <div
                        style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}
                      >
                        {r.queueLength} na fila · Guichês ocupados: {claimedCount}/{totalCounters}
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={() => onNavigate("host-panel", { roomCode: r.code, room: r })}
                      style={{ padding: "8px 14px", fontSize: "12px", fontWeight: 700, gap: "6px" }}
                    >
                      <DoorOpen size={14} /> Atender
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Cards Principais ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {cards.map((c) => (
            <button
              key={c.role}
              className="btn card"
              onMouseEnter={() => setHovered(c.role)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => {
                if (c.requiresAuth && !user) {
                  onNavigate("auth");
                } else if (c.requiresAuth && orgs.length === 0) {
                  onNavigate("org-setup");
                } else {
                  onNavigate(c.target);
                }
              }}
              style={{
                padding: "24px 20px",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "18px",
                border: `1px solid ${hovered === c.role ? c.color : "var(--border)"}`,
                transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
                transform: hovered === c.role ? "translateY(-2px)" : "none",
                boxShadow: hovered === c.role ? `0 12px 32px ${c.shadow}` : "none",
                cursor: "pointer",
                width: "100%",
                background: "var(--surface)",
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <c.Icon size={22} color={c.color} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)" }}>{c.title}</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
                  {c.sub}
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-dim)" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Modal de Convites Pendentes (Priority 7) ── */}
      <Modal open={showInvitesModal} onClose={() => setShowInvitesModal(false)} maxWidth="460px">
        <h3 style={{ fontSize: "17px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Mail size={18} color="var(--accent)" /> Convites Recebidos
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
          Você foi convidado para participar das seguintes organizações:
        </p>

        {pendingInvites.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>
            Nenhum convite pendente.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {pendingInvites.map((inv) => (
              <div
                key={inv.token}
                className="card"
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--surface-hover)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px" }}>{inv.org_name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Cargo: {ROLE_LABELS[inv.role] || inv.role}
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => handleAcceptInviteDirect(inv.token)}
                  disabled={acceptingInvite}
                  style={{ padding: "6px 14px", fontSize: "12px", fontWeight: 700 }}
                >
                  {acceptingInvite ? "Aceitando..." : "Aceitar Convite"}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          className="btn"
          onClick={() => setShowInvitesModal(false)}
          style={{ width: "100%", padding: "10px", fontSize: "13px" }}
        >
          Fechar
        </button>
      </Modal>

      {/* ── Modal: Criar Organização ── */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="420px">
        <h3 style={{ fontSize: "16px", marginBottom: "14px" }}>Criar Nova Instituição</h3>
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
            Nome da Instituição
          </label>
          <input
            className="input"
            placeholder="ex: Filial Centro"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
            autoFocus
          />
        </div>

        {orgError && (
          <div
            style={{
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <AlertTriangle size={14} /> {orgError}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn"
            onClick={() => setShowCreateModal(false)}
            style={{ flex: 1, padding: "12px" }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreateOrg}
            disabled={isSubmitting || !newOrgName.trim()}
            style={{ flex: 1, padding: "12px", fontWeight: 700 }}
          >
            {isSubmitting ? "Criando..." : "Criar"}
          </button>
        </div>
      </Modal>

      {/* ── Modal: Configurações da Organização ── */}
      <Modal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} maxWidth="420px">
        <h3 style={{ fontSize: "16px", marginBottom: "14px" }}>Configurações da Instituição</h3>
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
            Nome
          </label>
          <input
            className="input"
            value={editOrgName}
            onChange={(e) => setEditOrgName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUpdateOrg()}
          />
        </div>

        {orgError && (
          <div
            style={{
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <AlertTriangle size={14} /> {orgError}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <button
            className="btn"
            onClick={() => setShowSettingsModal(false)}
            style={{ flex: 1, padding: "10px" }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleUpdateOrg}
            disabled={isSubmitting || !editOrgName.trim()}
            style={{ flex: 1, padding: "10px", fontWeight: 700 }}
          >
            {isSubmitting ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {activeOrg?.role === "owner" && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
            <button
              className="btn"
              onClick={() => setDeleteConfirm(true)}
              style={{
                width: "100%",
                padding: "10px",
                color: "var(--danger)",
                borderColor: "var(--danger-glow)",
                background: "transparent",
                fontSize: "13px",
              }}
            >
              Excluir Instituição
            </button>
          </div>
        )}
      </Modal>

      {/* Modal: Confirmar exclusão */}
      <ConfirmModal
        open={deleteConfirm}
        title="Excluir Instituição"
        message={`Tem certeza que deseja excluir "${activeOrg?.name}"? Todas as salas, filas e membros serão permanentemente removidos.`}
        confirmText="Sim, excluir"
        danger
        onConfirm={handleDeleteOrg}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  );
};

export default LandingScreen;
