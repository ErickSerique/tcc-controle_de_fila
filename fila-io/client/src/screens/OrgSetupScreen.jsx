/**
 * screens/OrgSetupScreen.jsx
 *
 * Exibida quando o usuário está autenticado mas:
 *   a) Não pertence a nenhuma organização → cria a primeira
 *   b) Pertence a várias → escolhe qual usar ou cria nova
 */
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { createOrg } from "../lib/api";

const OrgSetupScreen = ({ onReady }) => {
  const { orgs, switchOrg, refreshOrgs, signOut, user } = useAuth();

  const [creating,  setCreating]  = useState(orgs.length === 0);
  const [orgName,   setOrgName]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const handleCreate = async () => {
    if (!orgName.trim()) return;
    setLoading(true);
    setError("");
    try {
      await createOrg(orgName.trim());
      await refreshOrgs();
      // refreshOrgs atualiza o contexto; onReady será chamado pelo App
      onReady();
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
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div className="animate-fade" style={{ width: "100%", maxWidth: "440px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, marginBottom: "6px" }}>
            fila<span style={{ color: "var(--accent)" }}>.io</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Olá, {user?.profile?.name ?? user?.email} 👋
          </p>
        </div>

        {/* Lista de orgs existentes */}
        {orgs.length > 0 && !creating && (
          <div className="card" style={{ padding: "24px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>
              Suas Organizações
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelect(org)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px", borderRadius: "10px",
                    border: "1px solid var(--border)", cursor: "pointer",
                    background: "var(--surface)", transition: "all 0.2s",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.background = "var(--accent-glow)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "var(--surface)";
                  }}
                >
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                      {org.name}
                    </div>
                    <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {org.role}
                    </div>
                  </div>
                  <span style={{ color: "var(--accent)", fontSize: "18px" }}>→</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setCreating(true)}
              style={{
                marginTop: "14px", width: "100%", padding: "12px",
                background: "transparent", color: "var(--accent)",
                border: "1px dashed var(--accent-dim)", borderRadius: "8px",
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + Criar nova organização
            </button>
          </div>
        )}

        {/* Formulário de criação */}
        {creating && (
          <div className="card" style={{ padding: "28px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>
              {orgs.length === 0 ? "Crie sua primeira organização" : "Nova Organização"}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              Uma organização representa seu estabelecimento (clínica, loja, hospital, etc.)
            </p>

            <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>
              Nome do Estabelecimento
            </label>
            <input
              className="input"
              placeholder="ex: Clínica Central, Prefeitura de..."
              value={orgName}
              onChange={(e) => { setOrgName(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
              style={{ marginBottom: "16px" }}
            />

            {error && (
              <div style={{
                color: "var(--danger)", fontSize: "13px",
                marginBottom: "12px", padding: "10px 14px",
                background: "rgba(239,68,68,0.1)", borderRadius: "8px",
              }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              {orgs.length > 0 && (
                <button
                  onClick={() => setCreating(false)}
                  style={{
                    padding: "12px 18px", borderRadius: "8px",
                    border: "1px solid var(--border)", background: "transparent",
                    color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  ←
                </button>
              )}
              <button
                onClick={handleCreate}
                disabled={loading || !orgName.trim()}
                style={{
                  flex: 1, padding: "14px",
                  background: loading || !orgName.trim()
                    ? "var(--surface-hover)"
                    : "linear-gradient(135deg, var(--accent), #818cf8)",
                  color: loading || !orgName.trim() ? "var(--text-dim)" : "#fff",
                  border: "none", borderRadius: "10px",
                  fontSize: "14px", fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit", transition: "all 0.2s",
                }}
              >
                {loading ? "Criando..." : "Criar Organização"}
              </button>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={signOut}
            style={{
              background: "transparent", border: "none",
              color: "var(--text-dim)", fontSize: "12px",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrgSetupScreen;
