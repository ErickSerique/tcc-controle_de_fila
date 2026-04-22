import { useState, useEffect, useRef } from "react";
import socket from "../lib/socket";

/**
 * LiveTicketScreen
 *
 * Subscribes to real-time queue events via Socket.io.
 * Displays position, estimated wait, and triggers visual/vibration
 * alerts when the client is next or called.
 */
const LiveTicketScreen = ({ ticket: initialTicket, room }) => {
  const [ticket, setTicket] = useState(initialTicket);
  const [isNext, setIsNext] = useState(initialTicket.position === 1);
  const [isCalled, setIsCalled] = useState(false);
  const [shaking, setShaking] = useState(false);
  const prevPositionRef = useRef(initialTicket.position);

  // ── Socket subscriptions ────────────────────────────────────
  useEffect(() => {
    // Join the room channel with our token
    socket.emit("client:join", { roomCode: room.code, token: initialTicket.token });

    const handleQueueUpdate = ({ roomCode, queue }) => {
      if (roomCode !== room.code) return;
      const me = queue.find((t) => t.token === initialTicket.token);
      if (!me) return;

      // Vibrate on position change (mobile)
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
      // Long vibration pattern for mobile
      navigator.vibrate?.([200, 100, 200, 100, 400]);
      setTimeout(() => setShaking(false), 600);
    };

    socket.on("queue_update", handleQueueUpdate);
    socket.on("ticket_called", handleTicketCalled);

    return () => {
      socket.off("queue_update", handleQueueUpdate);
      socket.off("ticket_called", handleTicketCalled);
    };
  }, [initialTicket.token, room.code]);

  // ── Helpers ─────────────────────────────────────────────────
  const formatWait = (mins) => {
    if (!mins || mins === 0) return "Agora mesmo!";
    if (mins < 60) return `~${mins} minutos`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `~${h}h${m > 0 ? ` ${m}min` : ""}`;
  };

  const ticketCode = initialTicket.token.split("-").slice(-1)[0].toUpperCase();

  // ── Called state ─────────────────────────────────────────────
  if (isCalled) {
    return (
      <div
        className="screen-container screen-container-centered"
        role="alert"
        aria-live="assertive"
        style={{ position: "relative", overflow: "hidden" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 100% 100% at 50% 50%, rgba(16, 185, 129, 0.25) 0%, transparent 65%)",
          }}
          aria-hidden="true"
        />
        <div className={`animate-fade ${shaking ? "animate-shake" : ""} container-sm text-center`} style={{ position: "relative", zIndex: 1 }}>
          <div className="animate-float" style={{ fontSize: "80px", marginBottom: "var(--space-md)" }} aria-hidden="true">🔔</div>
          <h1
            className="animate-glow text-success"
            style={{
              fontSize: "var(--text-4xl)",
              marginBottom: "var(--space-sm)",
            }}
          >
            É A SUA VEZ!
          </h1>
          <p style={{ fontSize: "var(--text-xl)", color: "var(--text)", marginBottom: "var(--space-xs)" }}>
            Por favor, dirija-se ao guichê de atendimento agora.
          </p>
          <p className="text-muted" style={{ fontSize: "var(--text-lg)" }}>
            Sala: {room.name}
          </p>
          
          <div
            className="card"
            style={{
              marginTop: "var(--space-2xl)",
              padding: "var(--space-xl) var(--space-2xl)",
              display: "inline-block",
              borderColor: "var(--success)",
              background: "rgba(16, 185, 129, 0.1)",
            }}
          >
            <div className="text-muted label" style={{ marginBottom: "var(--space-xs)" }}>SUA SENHA</div>
            <div
              className="mono text-success"
              style={{ fontSize: "var(--text-5xl)", fontWeight: 800, letterSpacing: "0.1em" }}
            >
              #{ticketCode}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting state ────────────────────────────────────────────
  return (
    <div
      className="screen-container screen-container-centered"
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* Glow when next */}
      {isNext && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 80% 60% at 50% 50%, var(--accent-glow) 0%, transparent 60%)",
            transition: "opacity 1s",
          }}
          aria-hidden="true"
        />
      )}

      <div
        className={`animate-fade ${shaking ? "animate-shake" : ""} container-sm text-center`}
        style={{ position: "relative", zIndex: 1 }}
        aria-live="polite"
      >
        {/* Room info */}
        <p
          className="text-muted"
          style={{
            fontSize: "var(--text-sm)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "var(--space-2xl)",
            fontWeight: 600
          }}
        >
          fila.io — Sala: {room.name}
        </p>

        {/* Ticket number */}
        <div style={{ marginBottom: "var(--space-2xl)" }}>
          <div className="label text-center" style={{ letterSpacing: "0.1em", marginBottom: "var(--space-sm)" }}>
            SUA SENHA
          </div>
          <div
            className={`mono ${isNext ? "animate-glow text-accent" : "text-text"}`}
            style={{
              fontSize: "var(--text-5xl)",
              fontWeight: 800,
              letterSpacing: "0.05em",
              transition: "color 0.5s, text-shadow 0.5s",
            }}
          >
            #{ticketCode}
          </div>
        </div>

        {/* Position card */}
        <div
          className="card"
          style={{
            padding: "var(--space-xl)",
            marginBottom: "var(--space-lg)",
            border: `2px solid ${isNext ? "var(--accent)" : "var(--border)"}`,
            background: isNext ? "var(--accent-glow)" : "var(--surface)",
            transition: "border-color 0.5s, background-color 0.5s",
          }}
        >
          <div className="label text-center" style={{ textTransform: "uppercase", marginBottom: "var(--space-md)" }}>
            Sua Posição na Fila
          </div>
          <div
            className={`mono ${isNext ? "animate-glow text-accent" : "text-text"}`}
            style={{
              fontSize: "80px",
              fontWeight: 800,
              lineHeight: 1,
              transition: "color 0.5s",
            }}
            aria-label={`Você é o número ${ticket.position} da fila`}
          >
            {ticket.position}º
          </div>
          
          {isNext && (
            <div
              className="text-accent"
              role="status"
              style={{
                marginTop: "var(--space-md)",
                fontSize: "var(--text-lg)",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-sm)",
              }}
            >
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "var(--accent)",
                  animation: "ringPulse 1.5s ease-in-out infinite",
                  display: "inline-block",
                }}
                aria-hidden="true"
              />
              Você é o próximo! Fique atento.
            </div>
          )}
        </div>

        {/* Wait + Category stats */}
        <div className="grid responsive-grid-4 gap-md" style={{ marginBottom: "var(--space-2xl)" }}>
          <div className="card stat-card" style={{ gridColumn: "span 1" }}>
            <div className="stat-card-label">Tempo Estimado de Espera</div>
            <div className="stat-card-value text-warn" style={{ fontSize: "var(--text-xl)" }}>
              {formatWait(ticket.estimatedWait)}
            </div>
          </div>
          <div className="card stat-card" style={{ gridColumn: "span 1" }}>
            <div className="stat-card-label">Serviço Selecionado</div>
            <div className="stat-card-value text-purple" style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
              {ticket.category}
            </div>
          </div>
        </div>

        <div className="alert alert-info justify-center">
          <span aria-hidden="true">ℹ️</span> 
          <span>
            <strong>Por favor, não feche esta tela.</strong>
            <br />
            Você será notificado aqui quando for a sua vez.
          </span>
        </div>
      </div>
    </div>
  );
};

export default LiveTicketScreen;
