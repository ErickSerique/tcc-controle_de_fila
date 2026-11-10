/**
 * screens/MembersScreen.jsx
 *
 * Kiwii Design System v3.0 — Gerenciamento de Membros e Convites
 * Suporta RBAC estrito (Dono/Admin/Operador) e link direto de convite com fallback a SMTP.
 */
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Mail,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { fetchOrgMembers, inviteMember, updateMemberRole, removeMember } from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";

const ROLE_LABELS = { owner: "Dono", admin: "Administrador", operator: "Operador" };
const ROLE_COLORS = { owner: "var(--accent)", admin: "var(--warn)", operator: "var(--text-muted)" };

const MembersScreen = ({ onBack }) => {
  const { activeOrg, user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operator");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null); // { link, emailSent, emailError }
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);

  const isOwner = activeOrg?.role === "owner";
  const canManage = isOwner || activeOrg?.role === "admin";

  useEffect(() => {
    if (!activeOrg) return;
    fetchOrgMembers(activeOrg.id)
      .then((data) => setMembers(data.members || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeOrg]);

  const handleInvite = async (e) => {
    e?.preventDefault();
    if (!inviteEmail.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setError("Por favor, informe um e-mail válido.");
      return;
    }

    setInviting(true);
    setError("");
    setInviteResult(null);
    setCopied(false);

    try {
      const data = await inviteMember(activeOrg.id, inviteEmail, inviteRole);
      setInviteResult(data.invite || data);
      setInviteEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = () => {
    if (!inviteResult?.link) return;
    navigator.clipboard.writeText(inviteResult.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      await updateMemberRole(activeOrg.id, targetUserId, newRole);
      setMembers((m) =>
        m.map((mb) => (mb.user_id === targetUserId ? { ...mb, role: newRole } : mb))
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
        padding: "24px",
        maxWidth: "680px",
        margin: "0 auto",
      }}
    >
      <div className="animate-fade">
        {/* Header */}
        <div style={{ paddingTop: "16px", marginBottom: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="display" style={{ fontSize: "18px", fontWeight: 800 }}>
                Kiwi<span style={{ color: "var(--accent)" }}>i</span>
              </span>
              <span className="tag">{activeOrg?.name || "Organização"}</span>
            </div>
            <button className="btn" onClick={onBack} style={{ padding: "7px 14px", fontSize: "13px" }}>
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
          <h1 style={{ fontSize: "1.5rem" }}>Membros da Equipe</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Gerencie o acesso à instituição e atribua funções a novos colaboradores.
          </p>
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--danger-glow)",
              border: "1px solid var(--danger-glow)",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "20px",
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* Formulário de convite (Alta 3 & Alta 4) */}
        {canManage && (
          <div className="card" style={{ padding: "20px", marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <UserPlus size={16} color="var(--accent)" />
              <div style={{ fontWeight: 700, fontSize: "14px" }}>Convidar Novo Membro</div>
            </div>

            <form
              onSubmit={handleInvite}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px auto",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <input
                className="input"
                type="email"
                placeholder="colaborador@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
              <select
                className="input"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="operator">Operador</option>
                <option value="admin">Administrador</option>
                {isOwner && <option value="owner">Dono</option>}
              </select>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={inviting}
                style={{ padding: "10px 18px", whiteSpace: "nowrap" }}
              >
                {inviting ? "Enviando..." : "Convidar"}
              </button>
            </form>

            {/* Resultado do Convite: Link direto ou e-mail (Alta 3) */}
            {inviteResult && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px",
                  borderRadius: "8px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: inviteResult.emailSent ? "var(--success)" : "var(--warn)",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "8px",
                  }}
                >
                  <CheckCircle2 size={16} />
                  {inviteResult.emailSent
                    ? "Convite enviado por e-mail com sucesso!"
                    : "Convite criado! Copie o link direto abaixo para enviar ao colaborador:"}
                </div>

                {inviteResult.link && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      className="input mono"
                      readOnly
                      value={inviteResult.link}
                      style={{ fontSize: "12px", background: "var(--bg)", color: "var(--text-muted)" }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={copyInviteLink}
                      style={{ padding: "8px 14px", whiteSpace: "nowrap", gap: "6px" }}
                    >
                      {copied ? (
                        <>
                          <Check size={14} color="var(--success)" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Copiar Link
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lista de membros */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Membros Ativos ({members.length})
            </span>
          </div>

          {loading ? (
            <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
              Carregando membros...
            </div>
          ) : members.length === 0 ? (
            <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
              Nenhum membro encontrado.
            </div>
          ) : (
            members.map((m) => {
              const isSelf = m.user_id === user?.id;
              // RBAC: Dono edita todos exceto a si mesmo; Admin só edita Operador.
              const canEditThisMember =
                canManage &&
                !isSelf &&
                (isOwner || (activeOrg?.role === "admin" && m.role === "operator"));

              return (
                <div
                  key={m.user_id}
                  className="card"
                  style={{
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: ROLE_COLORS[m.role],
                      flexShrink: 0,
                    }}
                  >
                    <Shield size={16} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.name || m.email}
                      </span>
                      {isSelf && (
                        <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          (você)
                        </span>
                      )}
                    </div>
                    {m.email && m.name && (
                      <div className="mono" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {m.email}
                      </div>
                    )}
                  </div>

                  {canEditThisMember ? (
                    <select
                      className="input"
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                      style={{ width: "140px", fontSize: "12px", padding: "6px 10px" }}
                    >
                      <option value="operator">Operador</option>
                      <option value="admin">Administrador</option>
                      {isOwner && <option value="owner">Dono</option>}
                    </select>
                  ) : (
                    <span
                      className="tag"
                      style={{
                        color: ROLE_COLORS[m.role],
                        borderColor: ROLE_COLORS[m.role],
                        fontSize: "11px",
                      }}
                    >
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  )}

                  {canEditThisMember && (
                    <button
                      className="btn"
                      onClick={() => setRemoveTarget(m)}
                      style={{
                        padding: "8px",
                        color: "var(--danger)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                      aria-label="Remover membro"
                      title="Remover da organização"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal de confirmação para remoção */}
        <ConfirmModal
          open={!!removeTarget}
          onClose={() => setRemoveTarget(null)}
          onConfirm={confirmRemoveMember}
          title="Remover Membro"
          message={`Tem certeza que deseja remover ${
            removeTarget?.name || removeTarget?.email || "este membro"
          } da organização? O usuário perderá o acesso às salas da instituição.`}
          confirmText="Remover Membro"
          danger
        />
      </div>
    </div>
  );
};

export default MembersScreen;
