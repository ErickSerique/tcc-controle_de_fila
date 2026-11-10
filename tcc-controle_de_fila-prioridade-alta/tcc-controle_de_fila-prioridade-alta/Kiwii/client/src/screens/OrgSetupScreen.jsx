/**
 * screens/OrgSetupScreen.jsx
 *
 * Exibida quando o usuário está autenticado mas:
 *   a) Não pertence a nenhuma organização → cria a primeira OU entra via código de convite
 *   b) Pertence a várias → escolhe qual usar ou cria nova
 */
import { useState } from "react";
import { ArrowRight, ArrowLeft, Plus, AlertTriangle, KeyRound, Building, CheckCircle2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { createOrg, acceptInvite } from "../lib/api";

const OrgSetupScreen = ({ onReady, onBack }) => {
  const { orgs, switchOrg, refreshOrgs, signOut, user } = useAuth();

  const [activeTab, setActiveTab] = useState("create"); // 'create' | 'join'
  const [orgName, setOrgName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreate = async () => {
    if (!orgName.trim()) return;
    setLoading(true);
    setError("");
    try {
      await createOrg(orgName.trim());
      await refreshOrgs();
      onReady();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // Extrai token caso tenham colado a URL inteira
      const cleanToken = inviteToken.trim().split("/").pop();
      await acceptInvite(cleanToken);
      await refreshOrgs();
      setSuccess("Convite aceito com sucesso!");
      setTimeout(() => onReady(), 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (org) => {
    switchOrg(org);
    onReady();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div className="animate-fade" style={{ width: "100%", maxWidth: "460px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div className="display" style={{ fontSize: "28px", fontWeight: 800, marginBottom: "6px" }}>
            Kiwi<span style={{ color: "var(--accent)" }}>i</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Olá, {user?.profile?.name ?? user?.email}
          </p>
        </div>

        {/* Lista de orgs existentes */}
        {orgs.length > 0 && activeTab === "list" && (
          <div className="card" style={{ padding: "24px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "15px", marginBottom: "16px" }}>Suas Organizações</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  className="btn"
                  onClick={() => handleSelect(org)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                      {org.name}
                    </div>
                    <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {org.role === "owner" ? "Dono" : org.role === "admin" ? "Admin" : "Operador"}
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--accent)" />
                </button>
              ))}
            </div>

            <button
              className="btn"
              onClick={() => setActiveTab("create")}
              style={{
                marginTop: "14px",
                width: "100%",
                padding: "12px",
                color: "var(--accent)",
                border: "1px dashed var(--accent-dim)",
                fontSize: "13px",
              }}
            >
              <Plus size={14} /> Criar nova organização
            </button>
          </div>
        )}

        {/* Escolha entre Criar Instituição ou Participar via Convite (Priority 7) */}
        {(orgs.length === 0 || activeTab !== "list") && (
          <div className="card" style={{ padding: "28px" }}>
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--border)",
                marginBottom: "20px",
              }}
            >
              <button
                onClick={() => {
                  setActiveTab("create");
                  setError("");
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === "create" ? "var(--accent)" : "transparent"}`,
                  color: activeTab === "create" ? "var(--text)" : "var(--text-muted)",
                  fontWeight: activeTab === "create" ? 700 : 500,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Building size={14} /> Criar Instituição
              </button>
              <button
                onClick={() => {
                  setActiveTab("join");
                  setError("");
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === "join" ? "var(--accent)" : "transparent"}`,
                  color: activeTab === "join" ? "var(--text)" : "var(--text-muted)",
                  fontWeight: activeTab === "join" ? 700 : 500,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <KeyRound size={14} /> Participar via Convite
              </button>
            </div>

            {activeTab === "create" ? (
              <div>
                <h3 style={{ fontSize: "16px", marginBottom: "6px" }}>
                  {orgs.length === 0 ? "Crie sua primeira instituição" : "Nova Instituição"}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
                  Representa sua clínica, cartório, hospital ou estabelecimento comercial.
                </p>

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
                  Nome do Estabelecimento
                </label>
                <input
                  className="input"
                  placeholder="ex: Clínica Santa Helena"
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                  style={{ marginBottom: "16px" }}
                />

                <div style={{ display: "flex", gap: "10px" }}>
                  {orgs.length > 0 && (
                    <button
                      className="btn"
                      onClick={() => setActiveTab("list")}
                      style={{ padding: "12px 16px" }}
                    >
                      <ArrowLeft size={15} />
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={handleCreate}
                    disabled={loading || !orgName.trim()}
                    style={{ flex: 1, padding: "14px", fontSize: "14px", fontWeight: 700 }}
                  >
                    {loading ? "Criando..." : "Criar Instituição"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 style={{ fontSize: "16px", marginBottom: "6px" }}>Entrar em uma Instituição</h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
                  Foi convidado para trabalhar em uma instituição? Cole o código ou link de convite recebido.
                </p>

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
                  Código ou Link do Convite
                </label>
                <input
                  className="input mono"
                  placeholder="ex: a1b2c3d4... ou https://.../invite/token"
                  value={inviteToken}
                  onChange={(e) => {
                    setInviteToken(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleAcceptInvite()}
                  autoFocus
                  style={{ marginBottom: "16px", fontSize: "13px" }}
                />

                <div style={{ display: "flex", gap: "10px" }}>
                  {orgs.length > 0 && (
                    <button
                      className="btn"
                      onClick={() => setActiveTab("list")}
                      style={{ padding: "12px 16px" }}
                    >
                      <ArrowLeft size={15} />
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={handleAcceptInvite}
                    disabled={loading || !inviteToken.trim()}
                    style={{ flex: 1, padding: "14px", fontSize: "14px", fontWeight: 700 }}
                  >
                    {loading ? "Validando..." : "Aceitar e Participar"}
                  </button>
                </div>
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
                  marginTop: "16px",
                  padding: "10px 14px",
                  background: "var(--danger-glow)",
                  borderRadius: "8px",
                }}
              >
                <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--success)",
                  fontSize: "13px",
                  marginTop: "16px",
                  padding: "10px 14px",
                  background: "var(--success-glow)",
                  borderRadius: "8px",
                }}
              >
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} /> {success}
              </div>
            )}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "20px", display: "flex", justifyContent: "center", gap: "16px" }}>
          {onBack && (
            <button
              onClick={onBack}
              className="btn"
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "12px" }}
            >
              ← Voltar ao início
            </button>
          )}
          <button
            onClick={signOut}
            className="btn"
            style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: "12px" }}
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrgSetupScreen;
