import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Building, Loader2, LogIn, Clock } from "lucide-react";
import { fetchInviteInfo, acceptInvite, requestJoinOrg } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

const ROLE_LABELS = { owner: "Administrador", admin: "Administrador", operator: "Operador" };

export default function InviteScreen({ token, onAccepted, onRequireLogin }) {
  const { user, refreshOrgs } = useAuth();
  const [invite, setInvite] = useState(null);
  const [applicantName, setApplicantName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchInviteInfo(token)
      .then((data) => {
        if (isMounted) {
          setInvite(data);
          if (user?.profile?.name) setApplicantName(user.profile.name);
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
  }, [token, user]);

  const handleAction = async () => {
    if (!user) {
      onRequireLogin();
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      if (invite?.isTemporary) {
        await requestJoinOrg(token, applicantName || user?.profile?.name || user?.email);
        setPendingApproval(true);
      } else {
        await acceptInvite(token);
        await refreshOrgs();
        setSuccess(true);
        setTimeout(() => onAccepted(), 1200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
          {invite?.isTemporary ? "Entrar na Equipe" : "Convite para Instituição"}
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
        ) : pendingApproval ? (
          <div style={{ marginTop: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--primary)",
                fontSize: "14px",
                marginBottom: "16px",
                padding: "14px",
                background: "var(--primary-glow)",
                borderRadius: "8px",
                border: "1px solid var(--primary)",
                textAlign: "left",
              }}
            >
              <Clock size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ display: "block", marginBottom: "4px" }}>Solicitação Enviada!</strong>
                Você entrou na fila de aprovação da instituição <strong>{invite?.org_name}</strong>. Assim que o administrador aprovar sua entrada, você terá acesso à equipe.
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => (window.location.href = "/")} style={{ width: "100%", padding: "12px" }}>
              Ir para o Início
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
            {invite?.isTemporary ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
                Você está acessando um link de convite temporário para a instituição{" "}
                <strong style={{ color: "var(--text)" }}>{invite.org_name}</strong>.
              </p>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
                Você foi convidado para fazer parte da instituição{" "}
                <strong style={{ color: "var(--text)" }}>{invite.org_name}</strong> com o cargo de{" "}
                <strong style={{ color: "var(--primary)" }}>{ROLE_LABELS[invite.role] || invite.role}</strong>.
              </p>
            )}

            {!user ? (
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Você precisa entrar ou criar uma conta para solicitar entrada.
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
              <div>
                {invite?.isTemporary && (
                  <div style={{ marginBottom: "16px", textAlign: "left" }}>
                    <label className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>
                      Seu Nome Completo
                    </label>
                    <input
                      className="input"
                      placeholder="Ex: Carlos Silva"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                    />
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleAction}
                  disabled={submitting}
                  style={{ width: "100%", padding: "14px", fontSize: "14px", fontWeight: 700 }}
                >
                  {submitting
                    ? "Enviando solicitação..."
                    : invite?.isTemporary
                    ? "Solicitar Entrada na Equipe"
                    : "Aceitar Convite e Entrar"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
