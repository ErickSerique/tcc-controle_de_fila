/**
 * screens/LiveTicketScreen.jsx
 *
 * Assina eventos de fila via Socket.io em tempo real.
 * Exibe posição, espera estimada e dispara alertas visuais/vibração
 * quando o cliente é o próximo ou é chamado.
 */
import { useState, useEffect, useRef } from "react";
import socket from "../lib/socket";

const LiveTicketScreen = ({ ticket: initialTicket, room }) => {
  const [ticket,  setTicket]  = useState(initialTicket);
  const [isNext,  setIsNext]  = useState(initialTicket.position === 1);
  const [isCalled,setIsCalled]= useState(false);
  const [shaking, setShaking] = useState(false);
  const prevPositionRef = useRef(initialTicket.position);

  // ── Socket subscriptions ──────────────────────────────────────
  useEffect(() => {
    socket.emit("client:join", { roomCode: room.code, token: initialTicket.token });

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

    socket.on("queue_update",  handleQueueUpdate);
    socket.on("ticket_called", handleTicketCalled);
    return () => {
      socket.off("queue_update",  handleQueueUpdate);
      socket.off("ticket_called", handleTicketCalled);
    };
  }, [initialTicket.token, room.code]);

  const formatWait = (mins) => {
    if (!mins || mins === 0) return "Agora!";
    if (mins < 60) return `~${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return `~${h}h${m > 0 ? ` ${m}min` : ""}`;
  };

  const ticketCode = initialTicket.token.split("-").slice(-1)[0].toUpperCase();

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "28px" }}>
          <div className="card" style={{ padding: "16px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>Espera Est.</div>
            <div className="mono" style={{ fontSize: "20px", fontWeight: 700, color: "var(--warn)" }}>{formatWait(ticket.estimatedWait)}</div>
          </div>
          <div className="card" style={{ padding: "16px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>Serviço</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent)" }}>{ticket.category}</div>
          </div>
        </div>

        <p className="mono" style={{ color: "var(--text-dim)", fontSize: "11px", lineHeight: 1.6 }}>
          Não feche esta tela<br />Você será notificado aqui
        </p>
      </div>
    </div>
  );
};

export default LiveTicketScreen;
