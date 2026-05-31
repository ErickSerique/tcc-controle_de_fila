/**
 * screens/AuthScreen.jsx
 *
 * Tela de autenticação com três modos:
 *   login     → e-mail + senha
 *   signup    → cadastro com nome
 *   magic     → magic link (sem senha)
 */
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

const AuthScreen = ({ onBack }) => {
  const { signInWithEmail, signUpWithEmail, signInWithMagicLink, authError, setAuthError } = useAuth();

  const [mode,     setMode]     = useState("login");   // 'login' | 'signup' | 'magic'
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState("");

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
      if (ok) setSuccess("Conta criada! Verifique seu e-mail para confirmar.");
    } else if (mode === "magic") {
      ok = await signInWithMagicLink(email);
      if (ok) setSuccess("Link enviado! Verifique seu e-mail.");
    }

    setLoading(false);
  };

  const inputStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: "8px",
    padding: "12px 16px",
    fontSize: "0.875rem",
    outline: "none",
    width: "100%",
    marginBottom: "12px",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  };

  const tabs = [
    { key: "login",  label: "Entrar" },
    { key: "signup", label: "Criar Conta" },
    { key: "magic",  label: "Magic Link" },
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
      {/* Grid de fundo */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        opacity: 0.3,
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 70% 60% at 50% 50%, var(--accent-glow) 0%, transparent 70%)",
      }} />

      <div className="animate-fade" style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              position: "absolute", top: "-40px", left: "0",
              background: "transparent", border: "none", color: "var(--text-muted)",
              cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px",
              fontFamily: "inherit", fontWeight: 500
            }}
          >
            ← Voltar
          </button>
        )}
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div className="animate-float" style={{ fontSize: "32px", fontWeight: 800, marginBottom: "8px" }}>
            fila<span style={{ color: "var(--accent)" }}>.io</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Gestão de Filas em Tempo Real
          </p>
        </div>

        <div className="card" style={{ padding: "32px" }}>
          {/* Tabs */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            background: "var(--surface-hover)", borderRadius: "10px",
            padding: "4px", marginBottom: "28px", gap: "2px",
          }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setMode(t.key); setAuthError(null); setSuccess(""); }}
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  background: mode === t.key ? "var(--bg)" : "transparent",
                  color: mode === t.key ? "var(--accent)" : "var(--text-muted)",
                  boxShadow: mode === t.key ? "var(--shadow-sm)" : "none",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Campos */}
          {mode === "signup" && (
            <input
              style={inputStyle}
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <input
            style={inputStyle}
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />

          {mode !== "magic" && (
            <input
              style={inputStyle}
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          )}

          {/* Feedback */}
          {authError && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px", padding: "10px 14px",
              color: "var(--danger)", fontSize: "13px", marginBottom: "14px",
            }}>
              ⚠️ {authError}
            </div>
          )}
          {success && (
            <div style={{
              background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: "8px", padding: "10px 14px",
              color: "var(--success)", fontSize: "13px", marginBottom: "14px",
            }}>
              ✓ {success}
            </div>
          )}

          {/* Botão principal */}
          <button
            onClick={handleSubmit}
            disabled={loading || !email}
            style={{
              width: "100%", padding: "14px",
              background: loading || !email
                ? "var(--surface-hover)"
                : "linear-gradient(135deg, var(--accent), #818cf8)",
              color: loading || !email ? "var(--text-dim)" : "#fff",
              border: "none", borderRadius: "10px",
              fontSize: "15px", fontWeight: 700,
              cursor: loading || !email ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar Conta" : "Enviar Link"}
          </button>

          {mode === "magic" && (
            <p style={{ textAlign: "center", fontSize: "12px", color: "var(--text-dim)", marginTop: "12px" }}>
              Você receberá um link para entrar sem senha.
            </p>
          )}
        </div>

        <p className="mono" style={{
          textAlign: "center", marginTop: "20px",
          color: "var(--text-dim)", fontSize: "11px",
        }}>
          v2.0.0 · Cloud-first · Socket.io
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;
