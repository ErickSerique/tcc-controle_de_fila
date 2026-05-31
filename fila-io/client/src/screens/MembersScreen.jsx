/**
 * screens/MembersScreen.jsx
 *
 * Gerenciamento de membros da organização.
 * Acessível por: admin, owner
 */
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { fetchOrgMembers, inviteMember, updateMemberRole, removeMember } from "../lib/api";

const ROLE_LABELS = { owner: "Owner", admin: "Admin", operator: "Operador" };
const ROLE_COLORS = { owner: "var(--accent)", admin: "var(--warn)", operator: "var(--text-muted)" };

const MembersScreen = ({ onBack }) => {
  const { activeOrg, user } = useAuth();

  const [members, setMembers]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState("operator");
  const [inviting,    setInviting]    = useState(false);
  const [inviteOk,    setInviteOk]    = useState("");
  const [error,       setError]       = useState("");

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

    // Validação básica de e-mail no frontend
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setError("Por favor, informe um e-mail válido.");
      return;
    }

    setInviting(true); setError(""); setInviteOk("");
    try {
      await inviteMember(activeOrg.id, inviteEmail, inviteRole);
      setInviteOk(`Convite enviado para ${inviteEmail}`);
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
      setMembers((m) => m.map((mb) => mb.user_id === userId ? { ...mb, role: newRole } : mb));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async (userId, memberName) => {
    if (!confirm(`Remover ${memberName} da organização?`)) return;
    try {
      await removeMember(activeOrg.id, userId);
      setMembers((m) => m.filter((mb) => mb.user_id !== userId));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <div className="animate-fade">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px", paddingTop: "8px" }}>
          <button className="btn" onClick={onBack} style={{ padding: "8px 14px", fontSize: "13px" }}>← Voltar</button>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "2px" }}>Membros</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>{activeOrg?.name}</p>
          </div>
        </div>

        {/* Convidar membro */}
        {canManage && (
          <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "14px" }}>Convidar Membro</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "10px", alignItems: "end" }}>
              <input
                className="input"
                type="email"
                placeholder="E-mail do convidado"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
              <select
                className="input"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="operator">Operador</option>
                <option value="admin">Admin</option>
              </select>
              <button
                className="btn btn-primary"
                onClick={handleInvite}
                disabled={inviting || !inviteEmail}
              >
                {inviting ? "..." : "Convidar"}
              </button>
            </div>
            {inviteOk && <p style={{ color: "var(--success)", fontSize: "13px", marginTop: "8px" }}>✓ {inviteOk}</p>}
          </div>
        )}

        {error && (
          <div style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "14px", padding: "10px 14px", background: "rgba(239,68,68,0.1)", borderRadius: "8px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Lista de membros */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontWeight: 700, fontSize: "14px" }}>
              {members.length} membro{members.length !== 1 ? "s" : ""}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Carregando...</div>
          ) : (
            members.map((m, i) => (
              <div
                key={m.user_id}
                style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "14px 20px",
                  borderBottom: i < members.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: "var(--accent-glow)", border: "1px solid var(--accent-dim)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "15px", fontWeight: 700, color: "var(--accent)", flexShrink: 0,
                }}>
                  {m.name?.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>
                    {m.name}
                    {m.user_id === user?.id && (
                      <span className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "8px" }}>
                        (você)
                      </span>
                    )}
                  </div>
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
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className="tag" style={{ color: ROLE_COLORS[m.role] }}>
                    {ROLE_LABELS[m.role]}
                  </span>
                )}

                {/* Remover */}
                {canManage && m.user_id !== user?.id && m.role !== "owner" && (
                  <button
                    className="btn"
                    onClick={() => handleRemove(m.user_id, m.name)}
                    style={{ padding: "6px 10px", color: "var(--danger)", fontSize: "13px", background: "transparent", border: "none" }}
                    aria-label="Remover membro"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MembersScreen;
