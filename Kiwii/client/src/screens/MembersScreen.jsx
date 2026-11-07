/**
 * screens/MembersScreen.jsx
 *
 * Gerenciamento de membros da organização e convites.
 * Acessível por: admin, owner
 */
import { useState, useEffect } from "react";
import { ArrowLeft, AlertTriangle, CheckCircle2, X, Copy, Check, Mail, Shield } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { fetchOrgMembers, inviteMember, updateMemberRole, removeMember } from "../lib/api";

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

  const isOwner = activeOrg?.role === "owner";
  const canManage = isOwner || activeOrg?.role === "admin";

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

  const handleRemove = async (targetUserId, memberName) => {
    if (!confirm(`Remover ${memberName} da organização?`)) return;
    try {
      await removeMember(activeOrg.id, targetUserId);
      setMembers((m) => m.filter((mb) => mb.user_id !== targetUserId));
    } catch (err) {
      setError(err.message);
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "28px",
            paddingTop: "8px",
          }}
        >
          <button className="btn" onClick={onBack} style={{ padding: "8px 14px", fontSize: "13px" }}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <div>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "2px" }}>Membros e Cargos</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
              {activeOrg?.name} ({ROLE_LABELS[activeOrg?.role] || activeOrg?.role})
            </p>
          </div>
        </div>

        {/* Convidar membro (Priority 3) */}
        {canManage && (
          <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "15px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Mail size={16} color="var(--accent)" /> Convidar Novo Membro
            </h3>
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
                  className="mono"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  E-mail do Convidado
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="usuario@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                />
              </div>

              <div>
                <label
                  className="mono"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Cargo Designado
                </label>
                <select
                  className="input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{ width: "auto" }}
                >
                  <option value="operator">Operador (Atendimento)</option>
                  <option value="admin">Administrador</option>
                  {isOwner && <option value="owner">Dono (Co-propriedade)</option>}
                </select>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleInvite}
                disabled={inviting || !inviteEmail}
                style={{ padding: "10px 18px", fontSize: "13px" }}
              >
                {inviting ? "Enviando..." : "Gerar Convite"}
              </button>
            </div>

            {/* Resultado do Convite: Link direto copiável */}
            {inviteResult && (
              <div
                className="card"
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  background: "var(--surface-hover)",
                  border: "1px solid var(--accent-dim)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--success)",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "8px",
                  }}
                >
                  <CheckCircle2 size={16} /> Convite criado com sucesso!
                </div>

                {inviteResult.emailSent ? (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                    Um e-mail foi disparado para o destinatário. Você também pode enviar o link abaixo diretamente:
                  </p>
                ) : (
                  <p style={{ fontSize: "12px", color: "var(--warn)", marginBottom: "12px" }}>
                    O envio automático por e-mail não foi concluído. Copie o link abaixo e compartilhe diretamente com o membro:
                  </p>
                )}

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    className="input mono"
                    readOnly
                    value={inviteResult.link}
                    style={{ fontSize: "12px", background: "var(--bg)", flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={copyInviteLink}
                    style={{ padding: "8px 14px", fontSize: "12px", gap: "6px" }}
                  >
                    {copied ? (
                      <>
                        <Check size={14} /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copiar Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "16px",
              padding: "10px 14px",
              background: "var(--danger-glow)",
              borderRadius: "8px",
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* Lista de membros */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
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
              {members.length} membro{members.length !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Hierarquia: Dono &gt; Administrador &gt; Operador
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              Carregando membros...
            </div>
          ) : (
            members.map((m, i) => {
              const isTargetOwner = m.role === "owner";
              const isSelf = m.user_id === user?.id;
              // Apenas Dono pode alterar cargo de outro Dono ou promover a Dono.
              // Admin só pode alterar entre operator e admin para quem NÃO é Dono.
              const canEditThisMember =
                canManage &&
                !isSelf &&
                (!isTargetOwner || isOwner);

              return (
                <div
                  key={m.user_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "14px 20px",
                    borderBottom: i < members.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--accent-light)",
                      border: "1px solid var(--accent-dim)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "var(--accent)",
                      flexShrink: 0,
                    }}
                  >
                    {m.name?.charAt(0).toUpperCase() || "U"}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                      {m.name}
                      {isSelf && (
                        <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          (você)
                        </span>
                      )}
                    </div>
                  </div>

                  {canEditThisMember ? (
                    <select
                      className="input"
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                      style={{ width: "auto", fontSize: "12px", padding: "6px 10px" }}
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
                      onClick={() => handleRemove(m.user_id, m.name)}
                      style={{
                        padding: "6px",
                        color: "var(--danger)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                      aria-label="Remover membro"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MembersScreen;
