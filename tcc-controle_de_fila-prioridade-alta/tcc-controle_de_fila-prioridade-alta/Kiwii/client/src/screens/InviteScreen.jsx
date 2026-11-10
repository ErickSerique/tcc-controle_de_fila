/**
 * screens/InviteScreen.jsx
 *
 * Tela de prévia e aceite de convite nominal para uma instituição.
 */
import { useState, useEffect } from "react";
import { Building, Shield, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { fetchInviteInfo, acceptInvite } from "../lib/api";

const ROLE_LABELS = { owner: "Dono", admin: "Administrador", operator: "Operador" };

const InviteScreen = ({ token, onAccepted, onRequireLogin }) => {
  const { user, refreshOrgs } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchInviteInfo(token)
      .then((data) => setInvite(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      sessionStorage.setItem("pending_invite_token", token);
      onRequireLogin?.();
      return;
    }

    setAccepting(true);
    setError("");
    try {
      await acceptInvite(token);
      await refreshOrgs();
      setSuccess(true);
      setTimeout(() => onAccepted?.(), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  const emailMatches =
    user?.email && invite?.email && user.email.toLowerCase() === invite.email.toLowerCase();

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
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div className="display" style={{ fontSize: "28px", fontWeight: 800, marginBottom: "6px" }}>
            Kiwi<span style={{ color: "var(--accent)" }}>i</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Convite para Instituição
          </p>
        </div>

        <div className="card" style={{ padding: "32px", textAlign: "center" }}>
          {loading ? (
            <div style={{ padding: "30px 0" }}>
              <Loader2 size={32} className="spin" style={{ margin: "0 auto 12px", color: "var(--accent)" }} />
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Verificando convite...</p>
            </div>
          ) : error ? (
            <div>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--danger-glow)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  color: "var(--danger)",
                }}
              >
                <AlertTriangle size={28} />
              </div>
              <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>Convite Inválido</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px" }}>
                {error}
              </p>
              <button
                className="btn"
                onClick={() => (window.location.href = "/")}
                style={{ width: "100%", padding: "12px" }}
              >
                Ir para o Início
              </button>
            </div>
          ) : success ? (
            <div>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--success-glow)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  color: "var(--success)",
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>Convite Aceito!</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                Redirecionando para o painel da instituição...
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "16px",
                  background: "var(--accent-light)",
                  border: "1px solid var(--accent-dim)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  color: "var(--accent)",
                }}
              >
                <Building size={28} />
              </div>

              <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>
                {invite?.orgName}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
                Você foi convidado para integrar esta organização
              </p>

              <div
                className="card"
                style={{
                  padding: "16px",
                  background: "var(--surface-hover)",
                  marginBottom: "20px",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Cargo Proposto:</span>
                  <span className="tag" style={{ fontSize: "11px" }}>
                    {ROLE_LABELS[invite?.role] || invite?.role}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Destinado a:</span>
                  <span className="mono" style={{ fontSize: "12px", color: "var(--text)" }}>
                    {invite?.email}
                  </span>
                </div>
              </div>

              {user && !emailMatches && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "var(--danger-glow)",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    color: "var(--danger)",
                    fontSize: "12px",
                    marginBottom: "16px",
                    textAlign: "left",
                  }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    Você está conectado como <strong>{user.email}</strong>. Entre com a conta{" "}
                    <strong>{invite?.email}</strong> para aceitar este convite.
                  </div>
                </div>
              )}

              {user ? (
                <button
                  className="btn btn-primary"
                  onClick={handleAccept}
                  disabled={accepting || (!emailMatches && !!user)}
                  style={{ width: "100%", padding: "14px", fontSize: "15px", fontWeight: 700 }}
                >
                  {accepting ? "Aceitando..." : "Aceitar Convite e Entrar"}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    sessionStorage.setItem("pending_invite_token", token);
                    onRequireLogin?.();
                  }}
                  style={{ width: "100%", padding: "14px", fontSize: "15px", fontWeight: 700 }}
                >
                  Entrar ou Cadastrar para Aceitar <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteScreen;
