import { useState, useRef, useEffect } from "react";

/**
 * ClientCheckinScreen
 *
 * Step 1: Scan QR Code (html5-qrcode) OR type the 6-char room code
 * Step 2: Enter name + select service category
 * Step 3: Join queue → receive ticket + signed JWT
 */
const ClientCheckinScreen = ({ onJoined, onBack }) => {
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
          const match = decodedText.match(/([A-Z0-9]{6})$/i);
          if (match) {
            setCode(match[1].toUpperCase());
            stopScanner();
          }
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
    if (!name.trim()) { setError("Informe seu nome completo."); return; }
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
      
      sessionStorage.setItem("session_token", data.sessionToken);
      onJoined(data.ticket, room);
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  };

  return (
    <div className="screen-container screen-container-centered">
      <div className="container-sm flex-col gap-lg animate-fade">
        
        {/* Header */}
        <div className="text-center" style={{ position: "relative" }}>
          <button
            className="btn btn-ghost"
            onClick={onBack}
            style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", padding: "var(--space-xs) var(--space-sm)" }}
            aria-label="Voltar"
          >
            <span aria-hidden="true">←</span> Voltar
          </button>
          <div style={{ fontSize: "var(--text-3xl)", fontWeight: 800, marginBottom: "var(--space-xs)" }}>
            fila<span className="text-accent">.io</span>
          </div>
          <p className="text-muted" style={{ fontSize: "var(--text-sm)", margin: 0 }}>
            {step === 1 ? "Escaneie o QR ou digite o código da sala" : "Quase lá — preencha seus dados"}
          </p>
          <div className="text-dim mono" style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-sm)" }}>
            Passo {step} de 2
          </div>
        </div>

        {/* ── STEP 1: Room code input ── */}
        {step === 1 && (
          <div className="flex-col gap-md">
            {/* QR Scanner area */}
            {scanning ? (
              <div className="flex-col gap-sm">
                <div
                  id="qr-reader"
                  ref={qrRef}
                  style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", border: "2px solid var(--accent)" }}
                />
                <button className="btn btn-danger" onClick={stopScanner} style={{ width: "100%" }}>
                  Cancelar Leitura da Câmera
                </button>
              </div>
            ) : (
              <button
                className="card card-interactive text-center"
                onClick={startScanner}
                style={{ width: "100%", padding: "var(--space-2xl)", borderStyle: "dashed", background: "transparent" }}
              >
                <div style={{ fontSize: "var(--text-4xl)", marginBottom: "var(--space-sm)" }} aria-hidden="true">📷</div>
                <div style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Escanear QR Code da Sala</div>
                <div className="text-muted" style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-xs)" }}>
                  Aponte a câmera para ler automaticamente
                </div>
              </button>
            )}

            {/* Divider */}
            <div className="flex-row gap-md justify-center" style={{ margin: "var(--space-md) 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span className="mono text-muted" style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>OU DIGITE MANUALMENTE</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            {/* Manual code input */}
            <div>
              <label htmlFor="room-code" className="label text-center">
                Código da Sala (6 letras ou números)
              </label>
              <input
                id="room-code"
                className="input mono"
                placeholder="ABC123"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && code.length === 6 && validateRoom()}
                style={{
                  fontSize: "var(--text-3xl)",
                  letterSpacing: "0.25em",
                  textAlign: "center",
                  textTransform: "uppercase",
                  height: "80px"
                }}
              />
            </div>

            {error && (
              <div className="alert alert-danger justify-center" role="alert">
                <span aria-hidden="true">⚠️</span> {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={validateRoom}
              disabled={code.length < 6 || validating}
              style={{ width: "100%", minHeight: "60px", fontSize: "var(--text-xl)" }}
            >
              {validating ? "Verificando Sala..." : "Validar Código da Sala →"}
            </button>
          </div>
        )}

        {/* ── STEP 2: Name + Category ── */}
        {step === 2 && room && (
          <div className="animate-fade flex-col gap-lg">
            {/* Room confirmed banner */}
            <div className="card flex-row gap-md" style={{ background: "var(--accent-glow)", borderColor: "var(--accent-dim)" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  background: "var(--accent)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  color: "white",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                ✓
              </div>
              <div>
                <div className="text-accent" style={{ fontWeight: 700, fontSize: "var(--text-lg)" }}>
                  {room.name}
                </div>
                <div className="mono text-muted" style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-xs)" }}>
                  Código: {room.code} · {room.queueLength} pessoas na fila
                </div>
              </div>
            </div>

            {/* Name field */}
            <div>
              <label htmlFor="client-name" className="label">
                Seu Nome Completo
              </label>
              <input
                id="client-name"
                className="input"
                placeholder="Ex: João da Silva"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                autoFocus
              />
            </div>

            {/* Category selector */}
            <div>
              <label className="label">
                Por que você está aqui hoje? (Selecione o serviço)
              </label>
              <div className="flex-col gap-sm">
                {room.categories.map((cat) => {
                  const selected = selectedCat === cat.name;
                  const isHighPriority = cat.priority === 3;
                  const isMedPriority = cat.priority === 2;
                  
                  let badgeBg = "rgba(16, 185, 129, 0.1)";
                  let badgeColor = "var(--success)";
                  let pLabel = "Prioridade Comum";
                  
                  if (isHighPriority) {
                    badgeBg = "rgba(239, 68, 68, 0.1)";
                    badgeColor = "var(--danger)";
                    pLabel = "Prioridade Alta";
                  } else if (isMedPriority) {
                    badgeBg = "rgba(245, 158, 11, 0.1)";
                    badgeColor = "var(--warn)";
                    pLabel = "Prioridade Média";
                  }

                  return (
                    <button
                      key={cat.name}
                      className="card card-interactive flex-row gap-md"
                      onClick={() => setSelectedCat(cat.name)}
                      aria-pressed={selected}
                      style={{
                        textAlign: "left",
                        padding: "var(--space-md) var(--space-lg)",
                        border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "var(--accent-glow)" : "var(--surface)",
                      }}
                    >
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          border: `2px solid ${selected ? "var(--accent)" : "var(--text-dim)"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          background: selected ? "var(--accent)" : "transparent"
                        }}
                        aria-hidden="true"
                      >
                         {selected && <span style={{ color: "white", fontSize: "12px", lineHeight: 1 }}>✓</span>}
                      </div>
                      
                      <span
                        style={{
                          flex: 1,
                          fontWeight: 700,
                          color: selected ? "var(--accent)" : "var(--text)",
                          fontSize: "var(--text-lg)",
                        }}
                      >
                        {cat.name}
                      </span>
                      
                      <span className="mono text-muted" style={{ fontSize: "var(--text-sm)" }}>
                        Tempo Médio: ~{cat.tma} min
                      </span>
                      
                      {isHighPriority && (
                         <span className="tag" style={{ background: badgeBg, color: badgeColor }}>
                            {pLabel}
                         </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="alert alert-danger justify-center" role="alert">
                <span aria-hidden="true">⚠️</span> {error}
              </div>
            )}

            <div className="flex-row gap-md">
              <button
                className="btn btn-secondary"
                onClick={() => { setStep(1); setError(""); }}
                aria-label="Voltar para o passo anterior"
                style={{ padding: "0 var(--space-xl)" }}
              >
                <span aria-hidden="true">←</span> Voltar
              </button>
              <button
                className="btn btn-primary"
                onClick={joinQueue}
                disabled={joining}
                style={{ flex: 1, minHeight: "64px", fontSize: "var(--text-xl)" }}
              >
                {joining ? "Gerando Senha..." : "🎟️ Confirmar e Pegar Minha Senha"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientCheckinScreen;