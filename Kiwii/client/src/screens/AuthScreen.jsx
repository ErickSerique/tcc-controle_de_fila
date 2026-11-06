/**
 * screens/AuthScreen.jsx
 *
 * Tela de autenticação — Design System v3.0
 * Suporte a login por email/senha, cadastro e magic link. Sem emojis.
 */
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { ArrowLeft, AlertCircle, Check, Radio } from "lucide-react";

const AuthScreen = ({ onBack }) => {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithMagicLink,
    authError,
    setAuthError,
  } = useAuth();

  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'magic'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true);
    setAuthError(null);
    setSuccess("");

    let ok = false;

    if (mode === "login") {
      ok = await signInWithEmail(email, password);
    } else if (mode === "signup") {
      ok = await signUpWithEmail(email, password, name);
      if (ok) setSuccess("Conta criada com sucesso! Verifique seu e-mail para confirmar.");
    } else if (mode === "magic") {
      ok = await signInWithMagicLink(email);
      if (ok) setSuccess("Link de acesso enviado! Verifique sua caixa de entrada.");
    }

    setLoading(false);
  };

  const tabs = [
    { key: "login", label: "Entrar" },
    { key: "signup", label: "Criar Conta" },
    { key: "magic", label: "Magic Link" },
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
      {/* Padrão de fundo suave */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.25,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, var(--primary-glow) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="animate-fade"
        style={{ width: "100%", maxWidth: "400px", position: "relative", zIndex: 1 }}
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
            <ArrowLeft size={13} /> Voltar
          </button>
        )}

        {/* Logo */}
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
            Plataforma de Gestão de Filas
          </p>
        </div>

        <div
          className="card"
          style={{ padding: "28px", background: "var(--surface)" }}
        >
          {/* Tabs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              background: "var(--surface-alt)",
              borderRadius: "8px",
              padding: "4px",
              marginBottom: "24px",
              gap: "2px",
            }}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setMode(t.key);
                  setAuthError(null);
                  setSuccess("");
                }}
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  transition: "all 0.15s ease",
                  background: mode === t.key ? "var(--surface)" : "transparent",
                  color: mode === t.key ? "var(--text)" : "var(--text-secondary)",
                  boxShadow:
                    mode === t.key ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Campos */}
          {mode === "signup" && (
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                Nome Completo
              </label>
              <input
                className="input"
                placeholder="Ex: Dra. Ana Paula"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div style={{ marginBottom: "14px" }}>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-secondary)",
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
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {mode !== "magic" && (
            <div style={{ marginBottom: "18px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                Senha
              </label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
          )}

          {/* Feedback */}
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
              <AlertCircle size={15} />
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
              <Check size={15} />
              <span>{success}</span>
            </div>
          )}

          {/* Botão principal */}
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || !email}
            style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 700 }}
          >
            {loading
              ? "Processando..."
              : mode === "login"
              ? "Entrar no Sistema"
              : mode === "signup"
              ? "Concluir Cadastro"
              : "Enviar Link de Acesso"}
          </button>

          {mode === "magic" && (
            <p
              style={{
                textAlign: "center",
                fontSize: "12px",
                color: "var(--text-dim)",
                marginTop: "14px",
                lineHeight: 1.4,
              }}
            >
              Um link direto de login será enviado para sua caixa de entrada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
