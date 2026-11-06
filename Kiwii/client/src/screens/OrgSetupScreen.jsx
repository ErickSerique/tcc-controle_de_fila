/**
 * screens/OrgSetupScreen.jsx
 *
 * Configuração e seleção inicial de organização — Design System v3.0
 * Zero emojis e design limpo.
 */
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { createOrg } from "../lib/api";
import {
  Building2,
  Plus,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Radio,
  LogOut,
} from "lucide-react";

const OrgSetupScreen = ({ onReady }) => {
  const { orgs, switchOrg, refreshOrgs, signOut, user } = useAuth();

  const [creating, setCreating] = useState(orgs.length === 0);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
      }}
    >
      <div className="animate-fade" style={{ width: "100%", maxWidth: "440px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                background: "var(--primary-muted)",
                border: "1px solid var(--primary-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
              }}
            >
              <Radio size={20} />
            </div>
            <span
              style={{
                fontSize: "26px",
                fontWeight: 800,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.02em",
              }}
            >
              fila<span style={{ color: "var(--primary)" }}>.io</span>
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
            Olá, {user?.profile?.name ?? user?.email}
          </p>
        </div>

        {/* Lista de orgs existentes */}
        {orgs.length > 0 && !creating && (
          <div className="card" style={{ padding: "24px", marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <Building2 size={16} style={{ color: "var(--primary)" }} />
              <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
                Suas Organizações
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelect(org)}
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    cursor: "pointer",
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    transition: "all 0.15s ease",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.background = "var(--primary-muted)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "var(--surface-alt)";
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "var(--text)",
                      }}
                    >
                      {org.name}
                    </div>
                    <span
                      className="tag"
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        marginTop: "4px",
                        display: "inline-block",
                        textTransform: "uppercase",
                      }}
                    >
                      {org.role}
                    </span>
                  </div>
                  <ArrowRight
                    size={16}
                    style={{ color: "var(--primary)", opacity: 0.8 }}
                  />
                </button>
              ))}
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setCreating(true)}
              style={{
                marginTop: "16px",
                width: "100%",
                padding: "12px",
                fontSize: "13px",
                fontWeight: 600,
                gap: "8px",
                borderStyle: "dashed",
              }}
            >
              <Plus size={15} /> Criar nova organização
            </button>
          </div>
        )}

        {/* Formulário de criação */}
        {creating && (
          <div className="card" style={{ padding: "28px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>
              {orgs.length === 0
                ? "Crie sua primeira organização"
                : "Nova Organização"}
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                marginBottom: "20px",
                lineHeight: 1.4,
              }}
            >
              Uma organização representa seu estabelecimento comercial ou
              atendimento (clínica, consultório, cartório, etc.)
            </p>

            <label
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Nome do Estabelecimento
            </label>
            <input
              className="input"
              placeholder="Ex: Clínica Central Médica"
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
              style={{ marginBottom: "16px" }}
            />

            {error && (
              <div
                style={{
                  background: "var(--danger-muted)",
                  border: "1px solid var(--danger-border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "var(--danger)",
                  fontSize: "13px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              {orgs.length > 0 && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setCreating(false)}
                  style={{ padding: "12px 16px" }}
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={loading || !orgName.trim()}
                style={{ flex: 1, padding: "12px", fontSize: "14px", fontWeight: 700 }}
              >
                {loading ? "Criando organização..." : "Criar Organização"}
              </button>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={signOut}
            className="btn btn-secondary"
            style={{
              fontSize: "12px",
              padding: "6px 12px",
              gap: "6px",
              color: "var(--text-dim)",
              border: "none",
              background: "transparent",
            }}
          >
            <LogOut size={13} /> Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrgSetupScreen;
