/**
 * screens/AuthScreen.jsx
 *
 * Tela de autenticação exclusiva com e-mail e senha:
 *   login     → e-mail + senha
 *   signup    → cadastro com nome, e-mail e senha
 */
import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, ArrowLeft, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const AuthScreen = ({ onBack }) => {
  const { signInWithEmail, signUpWithEmail, authError, setAuthError, user } = useAuth();

  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user) onBack?.();
  }, [user, onBack]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setAuthError(null);
    setSuccess("");

    let ok = false;
    if (mode === "login") {
      ok = await signInWithEmail(email, password);
    } else if (mode === "signup") {
      ok = await signUpWithEmail(email, password, name);
      if (ok) setSuccess("Conta criada com sucesso! Faça login para continuar.");
    }

    setLoading(false);
  };

  const tabs = [
    { key: "login", label: "Entrar", Icon: LogIn },
    { key: "signup", label: "Criar Conta", Icon: UserPlus },
  ];

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
        overflow: "hidden",
      }}
    >
      {/* Padrão de fundo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 55% 45% at 50% 45%, var(--accent-glow) 0%, transparent 70%)",
        }}
      />

      <div
        className="animate-fade"
        style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="btn"
            style={{
              position: "absolute",
              top: "-52px",
              left: "0",
              background: "transparent",
              border: "none",
              padding: "6px 0",
              fontSize: "13px",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={15} /> Voltar ao início
          </button>
        )}

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            className="display"
            style={{ fontSize: "32px", fontWeight: 800, marginBottom: "8px" }}
          >
            Kiwi<span style={{ color: "var(--accent)" }}>i</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Controle Inteligente de Filas
          </p>
        </div>

        <div className="card" style={{ padding: "32px" }}>
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border)",
              marginBottom: "24px",
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setMode(tab.key);
                  setAuthError(null);
                  setSuccess("");
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${mode === tab.key ? "var(--accent)" : "transparent"}`,
                  color: mode === tab.key ? "var(--text)" : "var(--text-muted)",
                  fontWeight: mode === tab.key ? 700 : 500,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <tab.Icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Campo Nome (só no cadastro) */}
            {mode === "signup" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  className="mono"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Seu Nome
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Nome completo ou de exibição"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Campo E-mail */}
            <div style={{ marginBottom: "16px" }}>
              <label
                className="mono"
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                E-mail
              </label>
              <input
                className="input"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={mode !== "signup"}
              />
            </div>

            {/* Campo Senha */}
            <div style={{ marginBottom: "24px" }}>
              <label
                className="mono"
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Senha
              </label>
              <input
                className="input"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {/* Mensagens de Erro / Sucesso */}
            {authError && (
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
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{authError}</span>
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
                  marginBottom: "16px",
                  padding: "10px 14px",
                  background: "var(--success-glow)",
                  borderRadius: "8px",
                }}
              >
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !email || !password}
              style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 700 }}
            >
              {loading ? "Aguarde..." : mode === "login" ? "Entrar na Conta" : "Criar Minha Conta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
