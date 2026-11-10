/**
 * screens/AuthScreen.jsx
 *
 * Tela de autenticação exclusiva com e-mail e senha:
 *   login     → e-mail + senha
 *   signup    → cadastro com nome, e-mail e senha
 */
import { useState, useEffect } from "react";
import { AlertCircle, Check, ArrowLeft, LogIn, UserPlus } from "lucide-react";
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.25,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, var(--primary-glow) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="animate-fade"
        style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="btn btn-secondary"
            style={{
              position: "absolute",
              top: "-46px",
              left: "0",
              fontSize: "12px",
              padding: "6px 12px",
              gap: "6px",
            }}
          >
            <ArrowLeft size={14} /> Voltar
          </button>
        )}

        <div className="card" style={{ padding: "32px" }}>
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
              {mode === "login"
                ? "Entre para gerenciar suas filas"
                : "Cadastre-se para começar"}
            </p>
          </div>

          {/* Abas */}
          <div
            style={{
              display: "flex",
              background: "var(--surface-alt, var(--bg))",
              borderRadius: "8px",
              padding: "4px",
              marginBottom: "24px",
              border: "1px solid var(--border)",
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
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: mode === tab.key ? "var(--surface)" : "transparent",
                  color: mode === tab.key ? "var(--text)" : "var(--text-secondary)",
                  fontWeight: mode === tab.key ? 600 : 400,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  boxShadow: mode === tab.key ? "var(--shadow-sm)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <tab.Icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div style={{ marginBottom: "18px" }}>
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
                  Seu Nome
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={mode === "signup"}
                  autoFocus
                />
              </div>
            )}

            <div style={{ marginBottom: "18px" }}>
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

            <div style={{ marginBottom: "24px" }}>
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

            {/* Erros e Sucesso */}
            {authError && (
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
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{authError}</span>
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
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Check size={15} style={{ flexShrink: 0 }} />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !email || !password}
              style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 700 }}
            >
              {loading ? "Aguarde..." : mode === "login" ? "Entrar no Sistema" : "Criar Minha Conta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
