/**
 * screens/OrgSetupScreen.jsx
 *
 * Configuração e seleção inicial de organização.
 * Suporta:
 *   a) Criar nova organização
 *   b) Entrar via código / link de convite
 *   c) Selecionar organização existente
 */
import { useState } from "react";
import { ArrowRight, ArrowLeft, Plus, AlertCircle, Check, KeyRound, Building2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { createOrg, acceptInvite } from "../lib/api";

const OrgSetupScreen = ({ onReady, onBack }) => {
  const { orgs, switchOrg, refreshOrgs, signOut, user } = useAuth();

  const [activeTab, setActiveTab] = useState(orgs.length === 0 ? "create" : "list"); // 'list' | 'create' | 'join'
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
      const org = await createOrg(orgName.trim());
      await refreshOrgs();
      switchOrg(org);
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
          <span
            style={{
              fontSize: "26px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text)",
            }}
          >
            Kiwi<span style={{ color: "var(--primary)" }}>i</span>
          </span>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
            Olá, {user?.profile?.name ?? user?.email}
          </p>
        </div>

        {/* Abas quando sem orgs ou para alternar */}
        <div
          style={{
            display: "flex",
            background: "var(--surface-alt, var(--bg))",
            borderRadius: "8px",
            padding: "4px",
            marginBottom: "20px",
            border: "1px solid var(--border)",
          }}
        >
          {orgs.length > 0 && (
            <button
              onClick={() => { setActiveTab("list"); setError(""); }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                background: activeTab === "list" ? "var(--surface)" : "transparent",
                color: activeTab === "list" ? "var(--text)" : "var(--text-secondary)",
                fontWeight: activeTab === "list" ? 600 : 400,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Minhas Instituições ({orgs.length})
            </button>
          )}
          <button
            onClick={() => { setActiveTab("create"); setError(""); }}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "create" ? "var(--surface)" : "transparent",
              color: activeTab === "create" ? "var(--text)" : "var(--text-secondary)",
              fontWeight: activeTab === "create" ? 600 : 400,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Criar Nova
          </button>
          <button
            onClick={() => { setActiveTab("join"); setError(""); }}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "join" ? "var(--surface)" : "transparent",
              color: activeTab === "join" ? "var(--text)" : "var(--text-secondary)",
              fontWeight: activeTab === "join" ? 600 : 400,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Entrar via Convite
          </button>
        </div>

        {/* Lista de orgs existentes */}
        {activeTab === "list" && orgs.length > 0 && (
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: "var(--text)" }}>
              Selecione uma Instituição
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelect(org)}
                  className="btn"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    background: "var(--surface-alt, var(--bg))",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Building2 size={16} color="var(--primary)" />
                    <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "14px" }}>
                      {org.name}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="tag" style={{ fontSize: "11px" }}>{org.role}</span>
                    <ArrowRight size={14} color="var(--text-secondary)" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Criar organização */}
        {activeTab === "create" && (
          <div className="card" style={{ padding: "28px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px", color: "var(--text)" }}>
              Nova Instituição
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
              Dê um nome ao seu estabelecimento para começar a gerenciar filas.
            </p>

            <div style={{ marginBottom: "20px" }}>
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
                Nome da Instituição
              </label>
              <input
                className="input"
                placeholder="Ex: Clínica São Lucas, Cartório Central..."
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={loading || !orgName.trim()}
              style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 700 }}
            >
              {loading ? "Criando instituição..." : "Criar Instituição"}
            </button>
          </div>
        )}

        {/* Entrar via convite */}
        {activeTab === "join" && (
          <div className="card" style={{ padding: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <KeyRound size={18} color="var(--primary)" />
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>
                Entrar com Convite
              </h3>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
              Cole o link ou o código do convite que você recebeu de um administrador.
            </p>

            <div style={{ marginBottom: "20px" }}>
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
                Código ou Link do Convite
              </label>
              <input
                className="input mono"
                placeholder="ex: a1b2c3d4... ou https://.../invite/token"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAcceptInvite()}
                autoFocus
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleAcceptInvite}
              disabled={loading || !inviteToken.trim()}
              style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 700 }}
            >
              {loading ? "Validando..." : "Aceitar e Participar"}
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              background: "var(--danger-muted)",
              border: "1px solid var(--danger-border)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "var(--danger)",
              fontSize: "13px",
              marginTop: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              background: "var(--success-muted)",
              border: "1px solid var(--success-border)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "var(--success)",
              fontSize: "13px",
              marginTop: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Check size={15} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "20px", display: "flex", justifyContent: "center", gap: "16px" }}>
          {onBack && (
            <button
              onClick={onBack}
              className="btn"
              style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "12px" }}
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
