import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Building, Loader2, LogIn } from "lucide-react";
import { fetchInviteInfo, acceptInvite } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

const ROLE_LABELS = { owner: "Dono", admin: "Administrador", operator: "Operador" };

export default function InviteScreen({ token, onAccepted, onRequireLogin }) {
  const { user, refreshOrgs } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchInviteInfo(token)
      .then((data) => {
        if (isMounted) {
          setInvite(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      onRequireLogin();
      return;
    }
    setAccepting(true);
    setError("");
    try {
      await acceptInvite(token);
      await refreshOrgs();
      setSuccess(true);
      setTimeout(() => onAccepted(), 1200);
    } catch (err) {
      setError(err.message);
      setAccepting(false);
    }
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
      <div className="card animate-fade" style={{ width: "100%", maxWidth: "440px", textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--primary-muted)",
            border: "1px solid var(--primary-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary)",
            margin: "0 auto 16px",
          }}
        >
          <Building size={24} />
        </div>

        <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "8px", color: "var(--text)" }}>
          Convite para Instituição
        </h2>

        {loading ? (
          <div style={{ padding: "32px", display: "flex", justifyContent: "center" }}>
            <Loader2 size={24} className="spin" color="var(--primary)" />
          </div>
        ) : error ? (
          <div style={{ marginTop: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--danger)",
                fontSize: "13px",
                marginBottom: "20px",
                padding: "10px 14px",
                background: "var(--danger-muted)",
                borderRadius: "8px",
                border: "1px solid var(--danger-border)",
                textAlign: "left",
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
            <button className="btn btn-secondary" onClick={() => (window.location.href = "/")}>
              Voltar ao Início
            </button>
          </div>
        ) : success ? (
          <div style={{ marginTop: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--success)",
                fontSize: "14px",
                marginBottom: "20px",
                padding: "12px 14px",
                background: "var(--success-muted)",
                borderRadius: "8px",
                border: "1px solid var(--success-border)",
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>Convite aceito! Entrando na organização...</span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "16px" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
              Você foi convidado para fazer parte da instituição{" "}
              <strong style={{ color: "var(--text)" }}>{invite.org_name}</strong> com o cargo de{" "}
              <strong style={{ color: "var(--primary)" }}>{ROLE_LABELS[invite.role] || invite.role}</strong>.
            </p>

            {!user ? (
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Você precisa entrar com a sua conta ({invite.email}) para aceitar o convite.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={onRequireLogin}
                  style={{ width: "100%", padding: "12px", gap: "8px" }}
                >
                  <LogIn size={16} /> Entrar ou Criar Conta
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleAccept}
                disabled={accepting}
                style={{ width: "100%", padding: "14px", fontSize: "14px", fontWeight: 700 }}
              >
                {accepting ? "Aceitando convite..." : "Aceitar Convite e Entrar"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
