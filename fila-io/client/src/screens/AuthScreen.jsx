/**
 * screens/AuthScreen.jsx
 *
 * Tela de autenticação com três modos:
 *   login     → e-mail + senha
 *   signup    → cadastro com nome
 *   magic     → magic link (sem senha)
 */
import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const AuthScreen = ({ onBack }) => {
  const { signInWithEmail, signUpWithEmail, signInWithMagicLink, authError, setAuthError, user } = useAuth();

  const [mode,     setMode]     = useState("login");   // 'login' | 'signup' | 'magic'
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState("");

  // Sai automaticamente desta tela assim que a autenticação for concluída —
  // cobre login com senha, e também o retorno de um magic link processado
  // enquanto esta tela ainda está montada.
  useEffect(() => {
    if (user) onBack?.();
  }, [user, onBack]);

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

  const tabs = [
    { key: "login",  label: "Entrar" },
    { key: "signup", label: "Criar Conta" },
    { key: "magic",  label: "Magic Link" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", position: "relative", overflow: "hidden",
    }}>
      {/* Fundo: pontos sutis + glow único e comedido */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
        backgroundSize: "28px 28px", opacity: 0.5,
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 55% 45% at 50% 45%, var(--accent-glow) 0%, transparent 70%)",
      }} />

      <div className="animate-fade" style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}>
        {onBack && (
          <button
            onClick={onBack}
            className="btn"
            style={{
              position: "absolute", top: "-52px", left: "0",
              background: "transparent", border: "none", padding: "6px 0",
              fontSize: "13px", color: "var(--text-muted)",
            }}
          >
            <ArrowLeft size={15} /> Voltar
          </button>
        )}

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div className="display" style={{ fontSize: "30px", fontWeight: 800, marginBottom: "8px" }}>
            Kiwi<span style={{ color: "var(--accent)" }}>i</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Gestão de Filas em Tempo Real
          </p>
        </div>

        <div className="card" style={{ padding: "32px" }}>
          {/* Tabs */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            background: "var(--bg)", borderRadius: "10px",
            padding: "4px", marginBottom: "28px", gap: "2px",
            border: "1px solid var(--border)",
          }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setMode(t.key); setAuthError(null); setSuccess(""); }}
                style={{
                  padding: "8px", borderRadius: "8px", border: "none", cursor: "pointer",
                  fontSize: "13px", fontWeight: 600, fontFamily: "inherit",
                  transition: "background-color 0.18s ease, color 0.18s ease",
                  background: mode === t.key ? "var(--surface)" : "transparent",
                  color: mode === t.key ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Campos */}
          {mode === "signup" && (
            <input
              className="input"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ marginBottom: "12px" }}
            />
          )}

          <input
            className="input"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{ marginBottom: "12px" }}
          />

          {mode !== "magic" && (
            <input
              className="input"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{ marginBottom: "12px" }}
            />
          )}

          {/* Feedback */}
          {authError && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "var(--danger-glow)", border: "1px solid var(--danger-glow)",
              borderRadius: "8px", padding: "10px 14px",
              color: "var(--danger)", fontSize: "13px", marginBottom: "14px",
            }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {authError}
            </div>
          )}
          {success && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "var(--success-glow)", border: "1px solid var(--success-glow)",
              borderRadius: "8px", padding: "10px 14px",
              color: "var(--success)", fontSize: "13px", marginBottom: "14px",
            }}>
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} /> {success}
            </div>
          )}

          {/* Botão principal */}
          <button
            onClick={handleSubmit}
            disabled={loading || !email}
            className="btn btn-primary"
            style={{ width: "100%", padding: "13px", fontSize: "15px" }}
          >
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar Conta" : "Enviar Link"}
          </button>

          {mode === "magic" && (
            <p style={{ textAlign: "center", fontSize: "12px", color: "var(--text-dim)", marginTop: "12px" }}>
              Você receberá um link para entrar sem senha.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
