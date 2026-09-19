/**
 * screens/OrgSetupScreen.jsx
 *
 * Exibida quando o usuário está autenticado mas:
 *   a) Não pertence a nenhuma organização → cria a primeira
 *   b) Pertence a várias → escolhe qual usar ou cria nova
 */
import { useState } from "react";
import { ArrowRight, ArrowLeft, Plus, AlertTriangle } from "lucide-react";
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
          <div className="display" style={{ fontSize: "26px", fontWeight: 800, marginBottom: "6px" }}>
            Kiwi<span style={{ color: "var(--accent)" }}>i</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Olá, {user?.profile?.name ?? user?.email}
          </p>
        </div>

        {/* Lista de orgs existentes */}
        {orgs.length > 0 && !creating && (
          <div className="card" style={{ padding: "24px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "15px", marginBottom: "16px" }}>
              Suas Organizações
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  className="btn"
                  onClick={() => handleSelect(org)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px",
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
                  <ArrowRight size={16} color="var(--accent)" />
                </button>
              ))}
            </div>

            <button className="btn" onClick={() => setCreating(true)}
              style={{ marginTop: "14px", width: "100%", padding: "12px", color: "var(--accent)", border: "1px dashed var(--accent-dim)", fontSize: "13px" }}>
              <Plus size={14} /> Criar nova organização
            </button>
          </div>
        )}

        {/* Formulário de criação */}
        {creating && (
          <div className="card" style={{ padding: "28px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "6px" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--danger)", fontSize: "13px", marginBottom: "12px", padding: "10px 14px", background: "var(--danger-glow)", borderRadius: "8px" }}>
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              {orgs.length > 0 && (
                <button className="btn" onClick={() => setCreating(false)} style={{ padding: "12px 16px" }}>
                  <ArrowLeft size={15} />
                </button>
              )}
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading || !orgName.trim()} style={{ flex: 1, padding: "14px", fontSize: "14px" }}>
                {loading ? "Criando..." : "Criar Organização"}
              </button>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button onClick={signOut} className="btn" style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: "12px" }}>
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrgSetupScreen;
