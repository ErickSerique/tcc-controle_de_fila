/**
 * screens/LandingScreen.jsx
 *
 * Tela inicial — mostra org ativa e opção de entrar/sair.
 */
import { useState } from "react";
import { Users, LayoutDashboard, Ticket, Settings, Plus, AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { createOrg, updateOrg, deleteOrg } from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";

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

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setIsSubmitting(true); setOrgError("");
    try {
      await createOrg(newOrgName);
      await refreshOrgs();
      setShowCreateModal(false);
      setNewOrgName("");
    } catch (err) { setOrgError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleUpdateOrg = async () => {
    if (!editOrgName.trim() || !activeOrg) return;
    setIsSubmitting(true); setOrgError("");
    try {
      await updateOrg(activeOrg.id, { name: editOrgName });
      await refreshOrgs();
      setShowSettingsModal(false);
    } catch (err) { setOrgError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteOrg = async () => {
    if (!activeOrg || activeOrg.role !== "owner") return;
    setIsSubmitting(true); setOrgError("");
    try {
      await deleteOrg(activeOrg.id);
      await refreshOrgs();
      setShowSettingsModal(false);
    } catch (err) { setOrgError(err.message); }
    finally { setIsSubmitting(false); setDeleteConfirm(false); }
  };

  const cards = [
    {
      role: "host",
      Icon: LayoutDashboard,
      title: "Painel do Host",
      sub: "Criar e gerenciar sala de atendimento",
      color: "var(--accent)",
      shadow: "var(--accent-glow)",
      target: "host-setup",
      requiresAuth: true,
    },
    {
      role: "client",
      Icon: Ticket,
      title: "Entrar na Fila",
      sub: "Escaneie o QR ou digite o código da sala",
      color: "var(--info)",
      shadow: "rgba(91,141,190,0.18)",
      target: "client-checkin",
      requiresAuth: false,
    },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px", position: "relative", overflow: "hidden",
    }}>
      {/* Fundo: padrão de pontos sutil + glow suave e único */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
        backgroundSize: "28px 28px", opacity: 0.5,
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 60% 45% at 50% 40%, var(--accent-glow) 0%, transparent 70%)",
      }} />

      {/* Barra de usuário / Autenticação no topo */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0,
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "10px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span className="display" style={{ fontSize: "15px", fontWeight: 700 }}>
            Kiwi<span style={{ color: "var(--accent)" }}>i</span>
          </span>
          {user && (
            <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              Olá, {user.email}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {user ? (
            <>
              {/* Org switcher */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowOrgMenu(!showOrgMenu)}
                  className="btn"
                  style={{ padding: "6px 12px", fontSize: "13px", gap: "6px" }}
                >
                  <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeOrg?.name ?? "Sem organização"}
                  </span>
                  <span className="tag" style={{ fontSize: "10px" }}>{activeOrg?.role}</span>
                  <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
                </button>

                {showOrgMenu && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: "10px", boxShadow: "var(--shadow-lg)",
                    minWidth: "220px", zIndex: 100, overflow: "hidden",
                  }}>
                    {orgs.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => { switchOrg(org); setShowOrgMenu(false); }}
                        style={{
                          display: "block", width: "100%", padding: "12px 16px",
                          textAlign: "left", background: org.id === activeOrg?.id ? "var(--accent-glow)" : "transparent",
                          border: "none", borderBottom: "1px solid var(--border)",
                          cursor: "pointer", fontFamily: "inherit", color: "var(--text)", fontSize: "13px",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{org.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{org.role}</div>
                      </button>
                    ))}
                    <button
                      onClick={() => { setShowOrgMenu(false); setShowCreateModal(true); }}
                      style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--text)", fontSize: "13px" }}>
                      <Plus size={15} /> Nova Organização
                    </button>
                    {activeOrg && ["owner", "admin"].includes(activeOrg.role) && (
                      <button
                        onClick={() => { setEditOrgName(activeOrg.name); setShowOrgMenu(false); setShowSettingsModal(true); }}
                        style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--text)", fontSize: "13px" }}>
                        <Settings size={15} /> Configurações
                      </button>
                    )}
                    <button
                      onClick={() => { onNavigate("members"); setShowOrgMenu(false); }}
                      style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--accent)", fontSize: "13px" }}>
                      <Users size={15} /> Gerenciar Membros
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={signOut}
                className="btn"
                style={{ fontSize: "12px", padding: "6px 12px", color: "var(--text-muted)" }}>
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

      <div className="animate-fade" style={{
        position: "relative", zIndex: 1,
        textAlign: "center", width: "100%", maxWidth: "460px",
        marginTop: "60px",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: "48px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div style={{
              width: 44, height: 44,
              background: "var(--accent)",
              borderRadius: "12px", display: "flex", alignItems: "center",
              justifyContent: "center",
            }}>
              <Users size={22} color="#04141C" strokeWidth={2.25} />
            </div>
            <span className="display" style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Kiwi<span style={{ color: "var(--accent)" }}>i</span>
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Gestão de Filas em Tempo Real
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {cards.map((c) => (
            <button
              key={c.role}
              className="btn card"
              onMouseEnter={() => setHovered(c.role)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onNavigate(c.requiresAuth && !user ? "auth" : c.target)}
              style={{
                padding: "26px 22px", textAlign: "left",
                display: "flex", alignItems: "center", gap: "20px",
                border: `1px solid ${hovered === c.role ? c.color : "var(--border)"}`,
                transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
                transform: hovered === c.role ? "translateY(-2px)" : "none",
                boxShadow: hovered === c.role ? `0 12px 32px ${c.shadow}` : "none",
                cursor: "pointer", width: "100%",
                background: "var(--surface)",
              }}
            >
              <div style={{
                width: 52, height: 52,
                background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: "12px", display: "flex",
                alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <c.Icon size={24} color={c.color} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "17px", fontWeight: 700, color: hovered === c.role ? c.color : "var(--text)", transition: "color 0.2s" }}>
                  {c.title}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "3px" }}>
                  {c.sub}
                </div>
              </div>
              <ChevronRight size={20} style={{ color: c.color, opacity: hovered === c.role ? 1 : 0.3, transition: "opacity 0.2s, transform 0.2s", transform: hovered === c.role ? "translateX(3px)" : "none", flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>

      {/* Modal Nova Organização */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", backdropFilter: "blur(4px)" }}>
          <div className="card animate-fade" style={{ width: "100%", maxWidth: "400px", padding: "32px", position: "relative" }}>
            <button onClick={() => setShowCreateModal(false)} style={{ position: "absolute", top: "16px", right: "16px", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}><X size={20} /></button>
            <h2 style={{ marginBottom: "8px" }}>Nova Organização</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>Crie um novo espaço para gerenciar filas.</p>
            <input className="input" placeholder="Ex: Clínica Geral" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} style={{ marginBottom: "16px" }} autoFocus />
            {orgError && <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--danger)", fontSize: "13px", marginBottom: "16px" }}><AlertTriangle size={14} /> {orgError}</div>}
            <button className="btn btn-primary" style={{ padding: "12px", width: "100%" }} onClick={handleCreateOrg} disabled={isSubmitting || !newOrgName.trim()}>
              {isSubmitting ? "Criando..." : "Criar Organização"}
            </button>
          </div>
        </div>
      )}

      {/* Modal Configurações */}
      {showSettingsModal && activeOrg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", backdropFilter: "blur(4px)" }}>
          <div className="card animate-fade" style={{ width: "100%", maxWidth: "400px", padding: "32px", position: "relative" }}>
            <button onClick={() => setShowSettingsModal(false)} style={{ position: "absolute", top: "16px", right: "16px", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}><X size={20} /></button>
            <h2 style={{ marginBottom: "8px" }}>Configurações</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>Editar detalhes de {activeOrg.name}</p>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>Nome da Organização</label>
            <input className="input" value={editOrgName} onChange={(e) => setEditOrgName(e.target.value)} style={{ marginBottom: "16px" }} />
            {orgError && <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--danger)", fontSize: "13px", marginBottom: "16px" }}><AlertTriangle size={14} /> {orgError}</div>}
            <button className="btn btn-primary" style={{ padding: "12px", width: "100%", marginBottom: "24px" }} onClick={handleUpdateOrg} disabled={isSubmitting || !editOrgName.trim()}>
              {isSubmitting ? "Salvando..." : "Salvar Alterações"}
            </button>

            {activeOrg.role === "owner" && (
              <div style={{ paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                <h3 style={{ color: "var(--danger)", fontSize: "14px", marginBottom: "8px" }}>Zona de Risco</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>Excluir esta organização apagará todos os membros e salas permanentemente.</p>
                <button className="btn" style={{ width: "100%", padding: "10px", color: "var(--danger)", border: "1px solid var(--danger-glow)" }} onClick={() => setDeleteConfirm(true)} disabled={isSubmitting}>
                  Excluir Organização
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDeleteOrg}
        title="Excluir Organização"
        message={`Tem certeza que deseja EXCLUIR a organização "${activeOrg?.name}"? Isso é irreversível e excluirá todas as salas e membros.`}
        confirmText="Excluir Permanentemente"
        danger
      />
    </div>
  );
};

export default LandingScreen;
