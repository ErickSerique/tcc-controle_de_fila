/**
 * screens/LiveTicketScreen.jsx
 *
 * Assina eventos de fila via Socket.io em tempo real.
 * Exibe posição, espera estimada e dispara alertas visuais/vibração
 * quando o cliente é o próximo ou é chamado.
 *
 * Inclui botão de sair da fila voluntariamente.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import socket from "../lib/socket";

const LiveTicketScreen = ({ ticket: initialTicket, room, onBack }) => {
  const [ticket,    setTicket]    = useState(initialTicket);
  const [isNext,    setIsNext]    = useState(initialTicket?.position === 1);
  const [isCalled,  setIsCalled]  = useState(initialTicket?.status === "called" || initialTicket?.status === "served");
  const [hasLeft,   setHasLeft]   = useState(false);
  const [shaking,   setShaking]   = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const prevPositionRef = useRef(initialTicket?.position);

  // ── Socket subscriptions ──────────────────────────────────────
  const joinClient = useCallback(() => {
    if (initialTicket?.token && room?.code) {
      socket.emit("client:join", { roomCode: room.code, token: initialTicket.token });
    }
  }, [initialTicket?.token, room?.code]);

  useEffect(() => {
    if (!initialTicket || !room) return;

    joinClient();

    // Re-entra na sala quando o socket reconecta
    socket.on("connect", joinClient);

    const handleQueueUpdate = ({ roomCode, queue }) => {
      if (roomCode !== room.code) return;
      const me = queue.find((t) => t.token === initialTicket.token);
      if (!me) return;

      if (me.position !== prevPositionRef.current) {
        navigator.vibrate?.(50);
        prevPositionRef.current = me.position;
      }
      setTicket(me);
      setIsNext(me.position === 1);
    };

    const handleTicketCalled = ({ token }) => {
      if (token !== initialTicket.token) return;
      setIsCalled(true);
      setShaking(true);
      navigator.vibrate?.([200, 100, 200, 100, 400]);
      setTimeout(() => setShaking(false), 600);
    };

    const handleTicketRemoved = ({ token }) => {
      if (token !== initialTicket.token) return;
      setHasLeft(true);
    };

    socket.on("queue_update",   handleQueueUpdate);
    socket.on("ticket_called",  handleTicketCalled);
    socket.on("ticket_removed", handleTicketRemoved);
    return () => {
      socket.off("connect",        joinClient);
      socket.off("queue_update",   handleQueueUpdate);
      socket.off("ticket_called",  handleTicketCalled);
      socket.off("ticket_removed", handleTicketRemoved);
    };
  }, [initialTicket, room, joinClient]);

  const handleLeaveQueue = () => {
    socket.emit("client:leave", { roomCode: room.code, token: initialTicket.token });
    setHasLeft(true);
  };

  const formatWait = (mins) => {
    if (!mins || mins === 0) return "Agora!";
    if (mins < 60) return `~${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return `~${h}h${m > 0 ? ` ${m}min` : ""}`;
  };

  // ── Loading ───────────────────────────────────────────────────
  if (!ticket || !room) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <div style={{ fontSize: "28px", fontWeight: 800 }}>
          fila<span style={{ color: "var(--accent)" }}>.io</span>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Carregando ticket...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const ticketCode = ticket.token.split("-").slice(-1)[0].toUpperCase();

  // ── Saiu da fila ─────────────────────────────────────────────
  if (hasLeft) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "20px" }}>👋</div>
        <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>Você saiu da fila</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "32px" }}>
          Sua senha <strong className="mono" style={{ color: "var(--accent)" }}>#{ticketCode}</strong> foi cancelada.
        </p>
        <button
          onClick={onBack}
          style={{
            padding: "14px 32px",
            background: "linear-gradient(135deg, var(--accent), #818cf8)",
            color: "#fff", border: "none", borderRadius: "12px",
            fontSize: "15px", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 8px 24px var(--accent-glow)",
          }}
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  // ── Chamado ───────────────────────────────────────────────────
  if (isCalled) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 100% 100% at 50% 50%, rgba(99,102,241,0.25) 0%, transparent 65%)" }} />
        <div className={`animate-fade ${shaking ? "animate-shake" : ""}`} style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div className="animate-float" style={{ fontSize: "80px", marginBottom: "20px" }}>🔔</div>
          <h1 className="animate-glow" style={{ fontSize: "40px", fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.02em", marginBottom: "10px" }}>É SUA VEZ!</h1>
          <p style={{ fontSize: "18px", color: "var(--text)", marginBottom: "6px" }}>Dirija-se ao guichê agora</p>
          <p className="mono" style={{ fontSize: "13px", color: "var(--text-muted)" }}>{room.name}</p>
          <div className="card" style={{ marginTop: "32px", padding: "16px 32px", display: "inline-block", borderColor: "var(--accent-dim)", background: "var(--accent-glow)" }}>
            <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>SENHA</div>
            <div className="mono" style={{ fontSize: "36px", fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em" }}>#{ticketCode}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Aguardando ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", overflow: "hidden" }}>
      {isNext && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 50%, var(--accent-glow) 0%, transparent 60%)", transition: "opacity 1s" }} />}

      <div className={`animate-fade ${shaking ? "animate-shake" : ""}`} style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "360px", textAlign: "center" }}>
        <p className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "32px" }}>
          fila.io · {room.name}
        </p>

        {/* Número da senha */}
        <div style={{ marginBottom: "28px" }}>
          <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: "8px" }}>SENHA</div>
          <div className={`mono ${isNext ? "animate-glow" : ""}`} style={{ fontSize: "64px", fontWeight: 800, letterSpacing: "0.05em", color: isNext ? "var(--accent)" : "var(--text)", transition: "color 0.5s" }}>
            #{ticketCode}
          </div>
        </div>

        {/* Card de posição */}
        <div className="card" style={{ padding: "28px 24px", marginBottom: "16px", border: `1px solid ${isNext ? "var(--accent)" : "var(--border)"}`, transition: "border-color 0.5s" }}>
          <div className="mono" style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Posição na Fila</div>
          <div className={`mono ${isNext ? "animate-glow" : ""}`} style={{ fontSize: "80px", fontWeight: 800, lineHeight: 1, color: isNext ? "var(--accent)" : "var(--text)", transition: "color 0.5s" }}>
            {ticket.position}º
          </div>
          {isNext && (
            <div style={{ marginTop: "12px", color: "var(--accent)", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "ringPulse 1.5s ease-in-out infinite", display: "inline-block" }} />
              Você é o próximo!
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          <div className="card" style={{ padding: "16px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>Espera Est.</div>
            <div className="mono" style={{ fontSize: "20px", fontWeight: 700, color: "var(--warn)" }}>{formatWait(ticket.estimatedWait)}</div>
          </div>
          <div className="card" style={{ padding: "16px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>Serviço</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent)" }}>{ticket.category}</div>
          </div>
        </div>

        <p className="mono" style={{ color: "var(--text-dim)", fontSize: "11px", lineHeight: 1.6, marginBottom: "24px" }}>
          Não feche esta tela<br />Você será notificado aqui
        </p>

        {/* Botão sair da fila */}
        <button
          onClick={() => setShowLeave(true)}
          style={{
            width: "100%", padding: "12px",
            background: "transparent",
            color: "var(--danger)", border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: "10px", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          🚪 Sair da Fila
        </button>
      </div>

      {/* ── Modal confirmação de saída ── */}
      {showLeave && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
        }}>
          <div className="card animate-fade" style={{
            background: "var(--surface)", width: "100%", maxWidth: "360px",
            padding: "32px", textAlign: "center",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚪</div>
            <h3 style={{ fontWeight: 800, fontSize: "18px", marginBottom: "8px" }}>Sair da fila?</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
              Sua senha <strong className="mono" style={{ color: "var(--accent)" }}>#{ticketCode}</strong> será cancelada e você perderá sua posição.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowLeave(false)}
                style={{
                  flex: 1, padding: "13px",
                  background: "var(--surface-hover)", border: "1px solid var(--border)",
                  borderRadius: "10px", fontSize: "14px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", color: "var(--text)",
                }}
              >
                Ficar
              </button>
              <button
                onClick={handleLeaveQueue}
                style={{
                  flex: 1, padding: "13px",
                  background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "10px", fontSize: "14px", fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", color: "var(--danger)",
                }}
              >
                Sair da Fila
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTicketScreen;
