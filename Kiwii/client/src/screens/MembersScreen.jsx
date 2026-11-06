/**
 * screens/MembersScreen.jsx
 *
 * Gerenciamento de membros da organização — Design System v3.0
 * Zero emojis e com ConfirmModal customizado.
 */
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { fetchOrgMembers, inviteMember, updateMemberRole, removeMember } from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";
import {
  ArrowLeft,
  Users,
  UserPlus,
  Trash2,
  AlertCircle,
  Check,
  Shield,
  ShieldCheck,
  User,
} from "lucide-react";

const ROLE_LABELS = { owner: "Proprietário", admin: "Administrador", operator: "Operador" };

const MembersScreen = ({ onBack }) => {
  const { activeOrg, user } = useAuth();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operator");
  const [inviting, setInviting] = useState(false);
  const [inviteOk, setInviteOk] = useState("");
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);

  const canManage = ["admin", "owner"].includes(activeOrg?.role);

  useEffect(() => {
    if (!activeOrg) return;
    fetchOrgMembers(activeOrg.id)
      .then((d) => setMembers(d.members))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeOrg]);

  const handleInvite = async () => {
    if (!inviteEmail) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setError("Por favor, informe um endereço de e-mail válido.");
      return;
    }

    setInviting(true);
    setError("");
    setInviteOk("");
    try {
      await inviteMember(activeOrg.id, inviteEmail, inviteRole);
      setInviteOk(`Convite enviado com sucesso para ${inviteEmail}`);
      setInviteEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateMemberRole(activeOrg.id, userId, newRole);
      setMembers((m) =>
        m.map((mb) => (mb.user_id === userId ? { ...mb, role: newRole } : mb))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmRemoveMember = async () => {
    if (!removeTarget) return;
    try {
      await removeMember(activeOrg.id, removeTarget.user_id);
      setMembers((m) => m.filter((mb) => mb.user_id !== removeTarget.user_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoveTarget(null);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "32px 24px",
        maxWidth: "680px",
        margin: "0 auto",
      }}
    >
      <div className="animate-fade">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "28px",
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={onBack}
            style={{ padding: "8px 12px", fontSize: "12px", gap: "6px" }}
          >
            <ArrowLeft size={14} /> Voltar
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={18} style={{ color: "var(--primary)" }} />
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
                Membros da Equipe
              </h2>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                margin: "2px 0 0",
              }}
            >
              {activeOrg?.name}
            </p>
          </div>
        </div>

        {/* Convidar membro */}
        {canManage && (
          <div
            className="card"
            style={{
              padding: "20px",
              marginBottom: "24px",
              background: "var(--surface)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "14px",
              }}
            >
              <UserPlus size={16} style={{ color: "var(--primary)" }} />
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
                Convidar Novo Membro
              </h3>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "10px",
                alignItems: "end",
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                  }}
                >
                  E-mail institucional
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="colega@clinica.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                  }}
                >
                  Função
                </label>
                <select
                  className="input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{ width: "auto" }}
                >
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleInvite}
                disabled={inviting || !inviteEmail}
                style={{ padding: "10px 16px", fontSize: "13px" }}
              >
                {inviting ? "Enviando..." : "Enviar Convite"}
              </button>
            </div>
            {inviteOk && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "var(--success)",
                  fontSize: "13px",
                  marginTop: "12px",
                  background: "var(--success-muted)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--success-border)",
                }}
              >
                <Check size={15} />
                <span>{inviteOk}</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "16px",
              padding: "10px 14px",
              background: "var(--danger-muted)",
              borderRadius: "8px",
              border: "1px solid var(--danger-border)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Lista de membros */}
        <div
          className="card"
          style={{ overflow: "hidden", padding: 0, background: "var(--surface)" }}
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
            <span style={{ fontWeight: 700, fontSize: "14px" }}>
              Membros Ativos ({members.length})
            </span>
          </div>

          {loading ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: "13px",
              }}
            >
              Carregando membros...
            </div>
          ) : (
            members.map((m, i) => (
              <div
                key={m.user_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px 20px",
                  borderBottom:
                    i < members.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                {/* Avatar minimalista */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "8px",
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "var(--primary)",
                    flexShrink: 0,
                  }}
                >
                  {m.name ? m.name.charAt(0).toUpperCase() : <User size={16} />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                    {m.name || m.email}
                    {m.user_id === user?.id && (
                      <span
                        className="tag"
                        style={{
                          fontSize: "10px",
                          marginLeft: "8px",
                          background: "var(--primary-muted)",
                          color: "var(--primary)",
                          borderColor: "var(--primary-border)",
                        }}
                      >
                        você
                      </span>
                    )}
                  </div>
                  {m.email && m.name && (
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {m.email}
                    </div>
                  )}
                </div>

                {/* Role selector ou badge */}
                {canManage && m.user_id !== user?.id && m.role !== "owner" ? (
                  <select
                    className="input"
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                    style={{ width: "auto", fontSize: "12px", padding: "6px 10px" }}
                  >
                    <option value="operator">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                ) : (
                  <span
                    className="tag"
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderColor:
                        m.role === "owner"
                          ? "var(--primary-border)"
                          : m.role === "admin"
                          ? "var(--accent-border)"
                          : "var(--border)",
                      color:
                        m.role === "owner"
                          ? "var(--primary)"
                          : m.role === "admin"
                          ? "var(--accent)"
                          : "var(--text-secondary)",
                    }}
                  >
                    {ROLE_LABELS[m.role] || m.role}
                  </span>
                )}

                {/* Remover membro */}
                {canManage && m.user_id !== user?.id && m.role !== "owner" && (
                  <button
                    onClick={() => setRemoveTarget(m)}
                    style={{
                      padding: "8px",
                      color: "var(--text-dim)",
                      background: "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--danger)";
                      e.currentTarget.style.background = "var(--danger-muted)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-dim)";
                      e.currentTarget.style.background = "transparent";
                    }}
                    title="Remover membro"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal de confirmação para remoção */}
        <ConfirmModal
          open={!!removeTarget}
          onClose={() => setRemoveTarget(null)}
          onConfirm={confirmRemoveMember}
          title="Remover Membro"
          message={`Tem certeza que deseja remover ${removeTarget?.name || "este membro"} da organização? O usuário perderá acesso a todas as salas.`}
          confirmText="Remover Membro"
          danger
        />
      </div>
    </div>
  );
};

export default MembersScreen;
