import { useState, useRef, useEffect } from "react";

/**
 * ClientCheckinScreen
 *
 * Step 1: Scan QR Code (html5-qrcode) OR type the 6-char room code
 * Step 2: Enter name + select service category
 * Step 3: Join queue → receive ticket + signed JWT
 */
const ClientCheckinScreen = ({ onJoined }) => {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState("");
  const [room, setRoom] = useState(null);
  const [name, setName] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [joining, setJoining] = useState(false);
  const qrRef = useRef(null);
  const scannerRef = useRef(null);

  // ── QR Scanner (html5-qrcode) ──────────────────────────────
  const startScanner = async () => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      scannerRef.current = new Html5Qrcode("qr-reader");
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          // Expected format: https://fila.io/join/ROOMCODE or just ROOMCODE
          const match = decodedText.match(/([A-Z0-9]{6})$/i);
          if (match) {
            setCode(match[1].toUpperCase());
            stopScanner();
          }
        },
        () => {} // ignore decode errors
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

  // ── Validate room code ────────────────────────────────────
  const validateRoom = async () => {
    if (code.length < 6) return;
    setError("");
    setValidating(true);
    try {
      const res = await fetch(`/api/rooms/${code.toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sala não encontrada.");
      setRoom(data);
      setSelectedCat(data.categories[0]?.name || "");
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  };

  // ── Join queue ────────────────────────────────────────────
  const joinQueue = async () => {
    if (!name.trim()) { setError("Informe seu nome."); return; }
    setError("");
    setJoining(true);
    try {
      const res = await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: code.toUpperCase(), name: name.trim(), category: selectedCat }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao entrar na fila.");
      // Store JWT in sessionStorage (not localStorage) — cleared on tab close
      sessionStorage.setItem("session_token", data.sessionToken);
      onJoined(data.ticket, room);
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "24px",
        maxWidth: "480px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div className="animate-fade">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ fontSize: "26px", fontWeight: 800, marginBottom: "6px" }}>
            fila<span style={{ color: "var(--accent)" }}>.io</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            {step === 1 ? "Escaneie o QR ou digite o código da sala" : "Quase lá — preencha seus dados"}
          </p>
        </div>

        {/* ── STEP 1: Room code input ── */}
        {step === 1 && (
          <>
            {/* QR Scanner area */}
            {scanning ? (
              <div style={{ marginBottom: "20px" }}>
                <div
                  id="qr-reader"
                  ref={qrRef}
                  style={{ borderRadius: "12px", overflow: "hidden", border: "2px solid var(--accent)" }}
                />
                <button
                  className="btn"
                  onClick={stopScanner}
                  style={{
                    marginTop: "12px",
                    width: "100%",
                    padding: "12px",
                    background: "transparent",
                    color: "var(--danger)",
                    border: "1px solid rgba(248,113,113,0.3)",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                >
                  Cancelar Leitura
                </button>
              </div>
            ) : (
              <button
                className="btn card"
                onClick={startScanner}
                style={{
                  width: "100%",
                  padding: "22px",
                  marginBottom: "20px",
                  border: "1px dashed var(--border)",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s",
                  background: "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <div style={{ fontSize: "34px", marginBottom: "8px" }}>📷</div>
                <div style={{ fontWeight: 600 }}>Escanear QR Code</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Aponte a câmera para o QR Code da sala
                </div>
              </button>
            )}

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>OU</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            {/* Manual code input */}
            <div style={{ marginBottom: "16px" }}>
              <label
                className="mono"
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "8px",
                }}
              >
                Código da Sala (6 dígitos)
              </label>
              <input
                className="input mono"
                placeholder="ABC123"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && code.length === 6 && validateRoom()}
                style={{
                  fontSize: "28px",
                  letterSpacing: "0.25em",
                  textAlign: "center",
                  textTransform: "uppercase",
                }}
              />
            </div>

            {error && (
              <div style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                ⚠️ {error}
              </div>
            )}

            <button
              className="btn"
              onClick={validateRoom}
              disabled={code.length < 6 || validating}
              style={{
                width: "100%",
                padding: "16px",
                background:
                  code.length >= 6 && !validating
                    ? "linear-gradient(135deg, var(--accent), #34d399)"
                    : "#1e293b",
                color: code.length >= 6 && !validating ? "#022c22" : "var(--text-dim)",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: 700,
                transition: "all 0.3s",
              }}
            >
              {validating ? "Verificando..." : "Validar Sala →"}
            </button>
          </>
        )}

        {/* ── STEP 2: Name + Category ── */}
        {step === 2 && room && (
          <div className="animate-fade">
            {/* Room confirmed banner */}
            <div
              className="card"
              style={{
                padding: "18px",
                marginBottom: "22px",
                borderColor: "var(--accent-dim)",
                background: "var(--accent-glow)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: "var(--accent)",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: "15px" }}>
                    {room.name}
                  </div>
                  <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {room.code} · {room.queueLength} na fila agora
                  </div>
                </div>
              </div>
            </div>

            {/* Name field */}
            <div style={{ marginBottom: "18px" }}>
              <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Seu Nome
              </label>
              <input
                className="input"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                autoFocus
              />
            </div>

            {/* Category selector */}
            <div style={{ marginBottom: "24px" }}>
              <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Tipo de Atendimento
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {room.categories.map((cat) => {
                  const selected = selectedCat === cat.name;
                  const pColor =
                    cat.priority === 3 ? "var(--danger)" : cat.priority === 2 ? "var(--warn)" : "var(--accent)";
                  const pLabel =
                    cat.priority === 3 ? "Alta" : cat.priority === 2 ? "Média" : "Baixa";
                  return (
                    <button
                      key={cat.name}
                      className="btn card"
                      onClick={() => setSelectedCat(cat.name)}
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "var(--accent-glow)" : "var(--surface)",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: selected ? "var(--accent)" : "var(--border)",
                          flexShrink: 0,
                          transition: "background 0.2s",
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontWeight: 600,
                          color: selected ? "var(--accent)" : "var(--text)",
                          fontSize: "14px",
                        }}
                      >
                        {cat.name}
                      </span>
                      <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        ~{cat.tma}min
                      </span>
                      <span
                        className="tag"
                        style={{
                          background:
                            cat.priority === 3 ? "#7f1d1d44" : cat.priority === 2 ? "#78350f44" : "#14532d44",
                          color: pColor,
                        }}
                      >
                        {pLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn"
                onClick={() => { setStep(1); setError(""); }}
                style={{
                  padding: "16px",
                  background: "var(--surface)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                ←
              </button>
              <button
                className="btn"
                onClick={joinQueue}
                disabled={joining}
                style={{
                  flex: 1,
                  padding: "16px",
                  background: joining
                    ? "var(--accent-dim)"
                    : "linear-gradient(135deg, var(--accent), #34d399)",
                  color: "#022c22",
                  borderRadius: "12px",
                  fontSize: "15px",
                  fontWeight: 800,
                  boxShadow: joining ? "none" : "0 8px 24px var(--accent-glow)",
                }}
              >
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
