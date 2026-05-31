/**
 * screens/ClientCheckinScreen.jsx
 *
 * Passo 1: Escanear QR ou digitar código da sala
 * Passo 2: Informar nome + selecionar categoria
 * Passo 3: Entrar na fila → recebe ticket + JWT de sessão
 *
 * Não requer login — qualquer pessoa pode entrar na fila.
 */
import { useState, useRef, useEffect } from "react";
import { fetchRoomPublic, joinQueue } from "../lib/api";

const ClientCheckinScreen = ({ initialCode, onJoined, onBack }) => {
  const [step,       setStep]       = useState(1);
  const [code,       setCode]       = useState(initialCode || "");
  const [room,       setRoom]       = useState(null);
  const [name,       setName]       = useState("");
  const [selectedCat,setSelectedCat]= useState("");
  const [error,      setError]      = useState("");
  const [scanning,   setScanning]   = useState(false);
  const [validating, setValidating] = useState(false);
  const [joining,    setJoining]    = useState(false);
  const qrRef      = useRef(null);
  const scannerRef = useRef(null);

  // Auto-validar sala se initialCode foi providenciado
  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      validateRoom(initialCode);
    }
  }, []);

  // ── QR Scanner ────────────────────────────────────────────────
  const startScanner = async () => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      scannerRef.current = new Html5Qrcode("qr-reader");
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          const match = decodedText.match(/([A-Z0-9]{6})$/i);
          if (match) { setCode(match[1].toUpperCase()); stopScanner(); }
        },
        () => {}
      );
    } catch {
      setError("Câmera indisponível. Use o código manual.");
      setScanning(false);
    }
  };

  const stopScanner = () => {
    scannerRef.current?.stop().catch(() => {});
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopScanner(), []);

  // ── Validar sala ──────────────────────────────────────────────
  const validateRoom = async (overrideCode) => {
    const codeToUse = (typeof overrideCode === "string" ? overrideCode : null) || code;
    if (codeToUse.length < 6) return;
    setError(""); setValidating(true);
    try {
      const data = await fetchRoomPublic(codeToUse.toUpperCase());
      setRoom(data);
      setSelectedCat(data.categories[0]?.name || "");
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  };

  // ── Entrar na fila ────────────────────────────────────────────
  const handleJoin = async () => {
    if (!name.trim()) { setError("Informe seu nome."); return; }
    setError(""); setJoining(true);
    try {
      const data = await joinQueue(code.toUpperCase(), name.trim(), selectedCat);
      // Armazena JWT de ticket na sessionStorage (limpo ao fechar a aba)
      sessionStorage.setItem("session_token", data.sessionToken);
      onJoined(data.ticket, room);
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  };

  const accentBtn = {
    width: "100%", padding: "16px",
    background: "linear-gradient(135deg, var(--accent), #818cf8)",
    color: "#fff", border: "none", borderRadius: "12px",
    fontSize: "15px", fontWeight: 800, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.3s",
    boxShadow: "0 8px 24px var(--accent-glow)",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      padding: "24px", maxWidth: "480px", margin: "0 auto",
      display: "flex", flexDirection: "column", justifyContent: "center",
    }}>
      <div className="animate-fade">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px", position: "relative" }}>
          <button className="btn" onClick={onBack} style={{
            position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
            fontSize: "13px",
          }}>← Voltar</button>
          <div style={{ fontSize: "26px", fontWeight: 800, marginBottom: "4px" }}>
            fila<span style={{ color: "var(--accent)" }}>.io</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            {step === 1 ? "Escaneie o QR ou digite o código da sala" : "Preencha seus dados"}
          </p>
        </div>

        {/* ── STEP 1: Código da sala ── */}
        {step === 1 && (
          <>
            {scanning ? (
              <div style={{ marginBottom: "20px" }}>
                <div id="qr-reader" ref={qrRef} style={{ borderRadius: "12px", overflow: "hidden", border: "2px solid var(--accent)" }} />
                <button className="btn" onClick={stopScanner} style={{ marginTop: "12px", width: "100%", padding: "12px", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.3)", background: "transparent", borderRadius: "8px" }}>
                  Cancelar Leitura
                </button>
              </div>
            ) : (
              <button className="btn card" onClick={startScanner} style={{
                width: "100%", padding: "22px", marginBottom: "20px",
                border: "1px dashed var(--border)", textAlign: "center",
                cursor: "pointer", background: "transparent",
              }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <div style={{ fontSize: "34px", marginBottom: "8px" }}>📷</div>
                <div style={{ fontWeight: 600 }}>Escanear QR Code</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Aponte a câmera para o QR Code da sala
                </div>
              </button>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>OU</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <label className="mono" style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
              Código da Sala (6 caracteres)
            </label>
            <input
              className="input mono"
              placeholder="ABC123"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && validateRoom()}
              style={{ fontSize: "28px", letterSpacing: "0.25em", textAlign: "center", marginBottom: "16px" }}
            />

            {error && <div style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>⚠️ {error}</div>}

            <button
              onClick={validateRoom}
              disabled={code.length < 6 || validating}
              style={{
                ...accentBtn,
                background: code.length < 6 || validating ? "var(--surface-hover)" : accentBtn.background,
                color:      code.length < 6 || validating ? "var(--text-dim)"       : "#fff",
                cursor:     code.length < 6 || validating ? "not-allowed"            : "pointer",
                boxShadow:  code.length < 6 || validating ? "none"                   : accentBtn.boxShadow,
              }}
            >
              {validating ? "Verificando..." : "Validar Sala →"}
            </button>
          </>
        )}

        {/* ── STEP 2: Nome + Categoria ── */}
        {step === 2 && room && (
          <div className="animate-fade">
            {/* Sala confirmada */}
            <div className="card" style={{ padding: "16px 18px", marginBottom: "22px", borderColor: "var(--accent-dim)", background: "var(--accent-glow)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: 40, height: 40, background: "var(--accent)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>✓</div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: "15px" }}>{room.name}</div>
                  <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{room.code}</div>
                </div>
              </div>
            </div>

            {/* Nome */}
            <label className="mono" style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Seu Nome</label>
            <input className="input" placeholder="Nome completo" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} autoFocus style={{ marginBottom: "18px" }} />

            {/* Categorias */}
            <label className="mono" style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Tipo de Atendimento</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
              {room.categories.map((cat) => {
                const selected = selectedCat === cat.name;
                const pColor = cat.priority === 3 ? "var(--danger)" : cat.priority === 2 ? "var(--warn)" : "var(--accent)";
                const pLabel = cat.priority === 3 ? "Alta" : cat.priority === 2 ? "Média" : "Baixa";
                return (
                  <button key={cat.name} onClick={() => setSelectedCat(cat.name)} style={{
                    padding: "14px 16px", textAlign: "left",
                    display: "flex", alignItems: "center", gap: "12px",
                    border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                    background: selected ? "var(--accent-glow)" : "var(--surface)",
                    borderRadius: "10px", cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: selected ? "var(--accent)" : "var(--border)", flexShrink: 0, transition: "background 0.2s" }} />
                    <span style={{ flex: 1, fontWeight: 600, color: selected ? "var(--accent)" : "var(--text)", fontSize: "14px" }}>{cat.name}</span>
                    <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>~{cat.tma}min</span>
                    <span className="tag" style={{ background: cat.priority === 3 ? "#7f1d1d44" : cat.priority === 2 ? "#78350f44" : "#14532d44", color: pColor }}>{pLabel}</span>
                  </button>
                );
              })}
            </div>

            {error && <div style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>⚠️ {error}</div>}

            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn" onClick={() => { setStep(1); setError(""); }} style={{ padding: "16px 20px", fontSize: "14px" }}>←</button>
              <button onClick={handleJoin} disabled={joining} style={{
                ...accentBtn, flex: 1,
                background: joining ? "var(--surface-hover)" : accentBtn.background,
                color:      joining ? "var(--text-dim)"       : "#fff",
                cursor:     joining ? "not-allowed"            : "pointer",
                boxShadow:  joining ? "none"                   : accentBtn.boxShadow,
              }}>
                {joining ? "⚡ Entrando na fila..." : "🎟️ Pegar Minha Senha"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientCheckinScreen;
