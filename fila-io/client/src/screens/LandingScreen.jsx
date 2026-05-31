/**
 * screens/LandingScreen.jsx
 *
 * Tela inicial — agora mostra org ativa e opção de sair.
 */
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { createOrg, updateOrg, deleteOrg } from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";

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

  const canManageHost = ["owner", "admin", "operator"].includes(activeOrg?.role);

  const cards = [
    {
      role: "host",
      icon: "🏠",
      title: "Painel do Host",
      sub: "Criar e gerenciar sala de atendimento",
      color: "var(--accent)",
      shadow: "var(--accent-glow)",
      target: "host-setup",
      requiresAuth: true,
    },
    {
      role: "client",
      icon: "🎟️",
      title: "Entrar na Fila",
      sub: "Escaneie o QR ou digite o código da sala",
      color: "#A78BFA",
      shadow: "rgba(167,139,250,0.18)",
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
      {/* Grid + glow de fundo */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: "40px 40px", opacity: 0.3,
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% 50%, var(--accent-glow) 0%, transparent 70%)",
      }} />

      {/* Barra de usuário */}
      {user && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0,
          background: "var(--surface)", borderBottom: "1px solid var(--border)",
          padding: "10px 20px", display: "flex", alignItems: "center",
          justifyContent: "space-between", zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "15px", fontWeight: 700 }}>
              fila<span style={{ color: "var(--accent)" }}>.io</span>
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              Olá, {user.email}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
                <span style={{ color: "var(--text-muted)" }}>▾</span>
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
                    style={{ display: "block", width: "100%", padding: "10px 16px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--text)", fontSize: "13px" }}>
                    ➕ Nova Organização
                  </button>
                  {activeOrg && ["owner", "admin"].includes(activeOrg.role) && (
                    <button
                      onClick={() => { setEditOrgName(activeOrg.name); setShowOrgMenu(false); setShowSettingsModal(true); }}
                      style={{ display: "block", width: "100%", padding: "10px 16px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--text)", fontSize: "13px" }}>
                      ⚙️ Configurações
                    </button>
                  )}
                  <button
                    onClick={() => { onNavigate("members"); setShowOrgMenu(false); }}
                    style={{ display: "block", width: "100%", padding: "10px 16px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--accent)", fontSize: "13px" }}>
                    👥 Gerenciar Membros
                  </button>
                  <button
                    onClick={() => { toggleTheme(); setShowOrgMenu(false); }}
                    style={{ display: "block", width: "100%", padding: "10px 16px", textAlign: "left", background: "transparent", border: "none", borderTop: "1px solid var(--border)", cursor: "pointer", fontFamily: "inherit", color: "var(--text)", fontSize: "13px" }}>
                    {theme === 'light' ? '🌙 Modo Escuro' : '☀️ Modo Claro'}
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
          </div>
        </div>
      )}

      <div className="animate-fade" style={{
        position: "relative", zIndex: 1,
        textAlign: "center", width: "100%", maxWidth: "460px",
        marginTop: user ? "60px" : "0",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: "48px" }}>
          <div className="animate-float" style={{ display: "inline-flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div style={{
              width: 44, height: 44,
              background: "linear-gradient(135deg, var(--accent), #818cf8)",
              borderRadius: "12px", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "22px",
            }}>⚡</div>
            <span style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.03em" }}>
              fila<span style={{ color: "var(--accent)" }}>.io</span>
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
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
              onClick={() => onNavigate(c.target)}
              style={{
                padding: "26px 22px", textAlign: "left",
                display: "flex", alignItems: "center", gap: "20px",
                border: `1px solid ${hovered === c.role ? c.color + "55" : "var(--border)"}`,
                transition: "all 0.3s",
                transform: hovered === c.role ? "translateY(-3px)" : "none",
                boxShadow: hovered === c.role ? `0 20px 60px ${c.shadow}` : "none",
                cursor: "pointer", width: "100%",
                background: hovered === c.role ? `${c.color}08` : "var(--surface)",
              }}
            >
              <div style={{
                width: 58, height: 58,
                background: `${c.color}15`,
                borderRadius: "14px", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: "28px", flexShrink: 0,
                transition: "transform 0.3s",
                transform: hovered === c.role ? "scale(1.08)" : "scale(1)",
              }}>
                {c.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "20px", fontWeight: 700, color: hovered === c.role ? c.color : "var(--text)", transition: "color 0.2s" }}>
                  {c.title}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "3px" }}>
                  {c.sub}
                </div>
              </div>
              <div style={{ color: c.color, fontSize: "22px", opacity: hovered === c.role ? 1 : 0.25, transition: "all 0.2s", transform: hovered === c.role ? "translateX(4px)" : "none" }}>→</div>
            </button>
          ))}
        </div>

        <p className="mono" style={{ marginTop: "36px", color: "var(--text-dim)", fontSize: "11px", letterSpacing: "0.08em" }}>
          v2.0.0 · Cloud-first + Fallback Local · Socket.io
        </p>
      </div>

      {/* Modal Nova Organização */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", backdropFilter: "blur(4px)" }}>
          <div className="card animate-fade" style={{ background: "var(--surface)", width: "100%", maxWidth: "400px", padding: "32px", border: "1px solid var(--border)", position: "relative" }}>
            <button onClick={() => setShowCreateModal(false)} style={{ position: "absolute", top: "16px", right: "16px", background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>×</button>
            <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Nova Organização</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>Crie um novo espaço para gerenciar filas.</p>
            <input className="input" placeholder="Ex: Clínica Geral" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} style={{ marginBottom: "16px" }} autoFocus />
            {orgError && <div style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "16px" }}>⚠️ {orgError}</div>}
            <button className="btn" style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: 600, cursor: "pointer", width: "100%", opacity: isSubmitting ? 0.7 : 1 }} onClick={handleCreateOrg} disabled={isSubmitting || !newOrgName.trim()}>
              {isSubmitting ? "Criando..." : "Criar Organização"}
            </button>
          </div>
        </div>
      )}

      {/* Modal Configurações */}
      {showSettingsModal && activeOrg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", backdropFilter: "blur(4px)" }}>
          <div className="card animate-fade" style={{ background: "var(--surface)", width: "100%", maxWidth: "400px", padding: "32px", border: "1px solid var(--border)", position: "relative" }}>
            <button onClick={() => setShowSettingsModal(false)} style={{ position: "absolute", top: "16px", right: "16px", background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>×</button>
            <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Configurações</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>Editar detalhes de {activeOrg.name}</p>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>Nome da Organização</label>
            <input className="input" value={editOrgName} onChange={(e) => setEditOrgName(e.target.value)} style={{ marginBottom: "16px" }} />
            {orgError && <div style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "16px" }}>⚠️ {orgError}</div>}
            <button className="btn" style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: 600, cursor: "pointer", width: "100%", marginBottom: "24px", opacity: isSubmitting ? 0.7 : 1 }} onClick={handleUpdateOrg} disabled={isSubmitting || !editOrgName.trim()}>
              {isSubmitting ? "Salvando..." : "Salvar Alterações"}
            </button>
            
            {activeOrg.role === "owner" && (
              <div style={{ paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                <h3 style={{ color: "var(--danger)", fontSize: "14px", marginBottom: "8px" }}>Zona de Perigo</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>Excluir esta organização apagará todos os membros e salas permanentemente.</p>
                <button className="btn" style={{ width: "100%", padding: "10px", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.3)", background: "transparent", borderRadius: "8px", cursor: "pointer" }} onClick={() => setDeleteConfirm(true)} disabled={isSubmitting}>
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
