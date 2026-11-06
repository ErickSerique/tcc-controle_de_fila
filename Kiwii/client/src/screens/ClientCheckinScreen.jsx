/**
 * screens/ClientCheckinScreen.jsx
 *
 * Design System v3.0 — Check-in de Paciente/Cliente
 * Entrada na fila com validação de sala e geração de senha.
 */
import { useState, useRef, useEffect } from "react";
import { fetchRoomPublic, joinQueue } from "../lib/api";
import {
  ArrowLeft,
  ArrowRight,
  QrCode,
  Camera,
  Check,
  Ticket,
  AlertCircle,
  Clock,
  Radio,
} from "lucide-react";

const ClientCheckinScreen = ({ initialCode, onJoined, onBack }) => {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState(initialCode || "");
  const [room, setRoom] = useState(null);
  const [name, setName] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [joining, setJoining] = useState(false);
  const qrRef = useRef(null);
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

  // ── Validar sala ──────────────────────────────────────────────
  const validateRoom = async (overrideCode) => {
    const codeToUse =
      (typeof overrideCode === "string" ? overrideCode : null) || code;
    if (codeToUse.length < 6) return;
    setError("");
    setValidating(true);
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
    if (!name.trim()) {
      setError("Informe seu nome completo.");
      return;
    }
    setError("");
    setJoining(true);
    try {
      const data = await joinQueue(code.toUpperCase(), name.trim(), selectedCat);
      sessionStorage.setItem("session_token", data.sessionToken);
      try {
        localStorage.setItem(
          "fila_io_active_ticket",
          JSON.stringify({ ticket: data.ticket, room })
        );
      } catch {}
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
        <div
          style={{
            textAlign: "center",
            marginBottom: "32px",
            position: "relative",
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={onBack}
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "12px",
              padding: "6px 10px",
              gap: "5px",
            }}
          >
            <ArrowLeft size={13} /> Voltar
          </button>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 800,
              marginBottom: "4px",
              fontFamily: "var(--font-display)",
            }}
          >
            fila<span style={{ color: "var(--primary)" }}>.io</span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            {step === 1
              ? "Escaneie o QR Code ou digite o código da sala"
              : "Informe seus dados para retirar a senha"}
          </p>
        </div>

        {/* ── STEP 1: Código da sala ── */}
        {step === 1 && (
          <>
            {scanning ? (
              <div style={{ marginBottom: "20px" }}>
                <div
                  id="qr-reader"
                  ref={qrRef}
                  style={{
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "2px solid var(--primary)",
                  }}
                />
                <button
                  className="btn btn-danger"
                  onClick={stopScanner}
                  style={{ marginTop: "12px", width: "100%", padding: "12px" }}
                >
                  Cancelar Leitura
                </button>
              </div>
            ) : (
              <button
                className="card"
                onClick={startScanner}
                style={{
                  width: "100%",
                  padding: "24px",
                  marginBottom: "20px",
                  border: "1px dashed var(--border)",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "var(--surface-alt)",
                  transition: "all 0.2s var(--ease-out)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.background = "var(--primary-muted)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "var(--surface-alt)";
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "12px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--primary)",
                    marginBottom: "10px",
                  }}
                >
                  <Camera size={24} />
                </div>
                <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text)" }}>
                  Escanear QR Code
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginTop: "4px",
                  }}
                >
                  Aponte a câmera para a tela do host
                </div>
              </button>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span
                className="mono"
                style={{ color: "var(--text-dim)", fontSize: "11px" }}
              >
                OU
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              Código da Sala (6 caracteres)
            </label>
            <input
              className="input mono"
              placeholder="ABC123"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && code.length === 6 && validateRoom()
              }
              style={{
                fontSize: "26px",
                fontWeight: 700,
                letterSpacing: "0.25em",
                textAlign: "center",
                marginBottom: "16px",
              }}
            />

            {error && (
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
                  justifyContent: "center",
                }}
              >
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={() => validateRoom()}
              disabled={code.length < 6 || validating}
              style={{ width: "100%", padding: "14px", fontSize: "14px", gap: "8px" }}
            >
              {validating ? (
                "Validando sala..."
              ) : (
                <>
                  Validar Código <ArrowRight size={16} />
                </>
              )}
            </button>
          </>
        )}

        {/* ── STEP 2: Nome + Categoria ── */}
        {step === 2 && room && (
          <div className="animate-fade">
            {/* Sala confirmada */}
            <div
              className="card"
              style={{
                padding: "14px 18px",
                marginBottom: "20px",
                borderColor: "var(--primary-border)",
                background: "var(--primary-muted)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: "var(--primary)",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0c0f14",
                    flexShrink: 0,
                  }}
                >
                  <Check size={18} strokeWidth={3} />
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--text)",
                      fontSize: "15px",
                    }}
                  >
                    {room.name}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: "12px",
                      color: "var(--primary)",
                      fontWeight: 600,
                    }}
                  >
                    Código: {room.code}
                  </div>
                </div>
              </div>
            </div>

            {/* Nome */}
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              Seu Nome Completo
            </label>
            <input
              className="input"
              placeholder="Ex: Carlos Alberto da Silva"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              autoFocus
              style={{ marginBottom: "20px" }}
            />

            {/* Categorias */}
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "10px",
              }}
            >
              Tipo de Atendimento
            </label>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "24px",
              }}
            >
              {room.categories.map((cat) => {
                const selected = selectedCat === cat.name;
                const pColor =
                  cat.priority === 3
                    ? "var(--priority-high)"
                    : cat.priority === 2
                    ? "var(--priority-med)"
                    : "var(--priority-low)";
                const pBg =
                  cat.priority === 3
                    ? "var(--priority-high-bg)"
                    : cat.priority === 2
                    ? "var(--priority-med-bg)"
                    : "var(--priority-low-bg)";
                const pLabel =
                  cat.priority === 3 ? "Alta" : cat.priority === 2 ? "Média" : "Baixa";

                return (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCat(cat.name)}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      border: `1px solid ${
                        selected ? "var(--primary)" : "var(--border)"
                      }`,
                      background: selected
                        ? "var(--primary-muted)"
                        : "var(--surface)",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: `2px solid ${
                          selected ? "var(--primary)" : "var(--border-active)"
                        }`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {selected && (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--primary)",
                          }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        flex: 1,
                        fontWeight: 600,
                        color: selected ? "var(--text)" : "var(--text-secondary)",
                        fontSize: "14px",
                      }}
                    >
                      {cat.name}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-dim)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Clock size={12} /> ~{cat.tma} min
                    </span>
                    <span
                      style={{
                        background: pBg,
                        color: pColor,
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      {pLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {error && (
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
                  justifyContent: "center",
                }}
              >
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
                style={{ padding: "14px 18px", fontSize: "14px" }}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                className="btn btn-primary"
                onClick={handleJoin}
                disabled={joining}
                style={{
                  flex: 1,
                  padding: "14px",
                  fontSize: "14px",
                  fontWeight: 700,
                  gap: "8px",
                }}
              >
                {joining ? (
                  "Entrando na fila..."
                ) : (
                  <>
                    <Ticket size={17} /> Pegar Minha Senha
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientCheckinScreen;
