import { useState, useEffect, useRef } from "react";
import socket from "../lib/socket";
import ConfirmModal from "../components/ConfirmModal";

/**
 * LiveTicketScreen
 *
 * Assina eventos de fila via Socket.io em tempo real.
 * Mostra posição, espera estimada, guichê designado ao ser chamado,
 * e permite ao cliente sair voluntariamente da fila.
 */
const LiveTicketScreen = ({ ticket: initialTicket, room, onBack }) => {
  const [ticket, setTicket] = useState(initialTicket);
  const [isNext, setIsNext] = useState(initialTicket.position === 1);
  const [isCalled, setIsCalled] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState(null); // null | "served" | "removed_by_host" | "left_voluntarily"
  const [shaking, setShaking] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [aheadInCategory, setAheadInCategory] = useState(0);
  const prevPositionRef = useRef(initialTicket.position);

  useEffect(() => {
    const joinRoom = () => {
      socket.emit("client:join", { roomCode: room.code, token: initialTicket.token });
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on("connect", joinRoom);

    const handleQueueUpdate = ({ roomCode, queue }) => {
      if (roomCode?.toUpperCase() !== room.code?.toUpperCase()) return;
      const me = queue.find((t) => t.token === initialTicket.token);
      if (!me) return;

      if (me.position !== prevPositionRef.current) {
        navigator.vibrate?.(50);
        prevPositionRef.current = me.position;
      }

      const ahead = queue.filter((t) => t.category === me.category && t.position < me.position).length;
      setAheadInCategory(ahead);
      setTicket(me);
      setIsNext(me.position === 1);
    };

    const handleTicketCalled = ({ token, ticket: calledTicket }) => {
      if (token !== initialTicket.token) return;
      setTicket((prev) => ({ ...prev, counter: calledTicket?.counter }));
      setIsCalled(true);
      setShaking(true);
      navigator.vibrate?.([200, 100, 200, 100, 400]);
      setTimeout(() => setShaking(false), 600);
    };

    // Resposta ao "client:join": o servidor manda o status REAL do ticket,
    // buscando tanto na fila ativa quanto no arquivo do dia. É o que permite
    // restaurar a tela corretamente após uma reconexão/F5 — inclusive quando
    // o ticket já foi chamado, atendido, removido ou saiu voluntariamente,
    // casos em que ele não está mais em `queue` e por isso não apareceria
    // em nenhum `queue_update` normal.
    const handleTicketStatus = ({ ticket: statusTicket }) => {
      if (!statusTicket) return;

      if (statusTicket.status === "called") {
        setTicket((prev) => ({ ...prev, ...statusTicket }));
        setIsCalled(true);
        return;
      }

      if (["served", "removed_by_host", "left_voluntarily"].includes(statusTicket.status)) {
        setTerminalStatus(statusTicket.status);
        return;
      }

      // status === "waiting" — restaura a posição real (não a congelada no sessionStorage)
      prevPositionRef.current = statusTicket.position;
      const ahead = statusTicket.position ? statusTicket.position - 1 : 0;
      setAheadInCategory(ahead);
      setTicket(statusTicket);
      setIsNext(statusTicket.position === 1);
    };

    socket.on("queue_update", handleQueueUpdate);
    socket.on("ticket_called", handleTicketCalled);
    socket.on("ticket_status", handleTicketStatus);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("queue_update", handleQueueUpdate);
      socket.off("ticket_called", handleTicketCalled);
      socket.off("ticket_status", handleTicketStatus);
    };
  }, [initialTicket.token, room.code]);

  const confirmLeaveQueue = () => {
    socket.emit("client:leave", { roomCode: room.code, token: initialTicket.token });
    setTerminalStatus("left_voluntarily");
  };

  const formatWait = (mins) => {
    if (!mins || mins === 0) return "Agora!";
    if (mins < 60) return `~${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `~${h}h${m > 0 ? ` ${m}min` : ""}`;
  };

  const ticketCode = initialTicket.token.split("-").slice(-1)[0].toUpperCase();

  const TERMINAL_INFO = {
    served: {
      icon: "✅",
      title: "Atendimento concluído",
      message: `Sua senha #${ticketCode} já foi atendida. Obrigado!`,
    },
    removed_by_host: {
      icon: "❌",
      title: "Você foi removido da fila",
      message: `Sua senha #${ticketCode} foi removida pelo atendente.`,
    },
    left_voluntarily: {
      icon: "👋",
      title: "Você saiu da fila",
      message: `Sua senha #${ticketCode} foi cancelada.`,
    },
  };

  // ── Estado terminal (atendido / removido / saiu voluntariamente) ─
  if (terminalStatus) {
    const info = TERMINAL_INFO[terminalStatus];
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "20px" }}>{info.icon}</div>
        <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>{info.title}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "32px" }}>{info.message}</p>
        <button className="btn" onClick={onBack} style={{ padding: "14px 32px", background: "linear-gradient(135deg, var(--accent), #34d399)", color: "#022c22", borderRadius: "12px", fontSize: "15px", fontWeight: 700 }}>
          Voltar ao Início
        </button>
      </div>
    );
  }

  // ── Chamado ────────────────────────────────────────────────────────
  if (isCalled) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 100% 100% at 50% 50%, rgba(110,231,183,0.25) 0%, transparent 65%)" }} />
        <div className={`animate-fade ${shaking ? "animate-shake" : ""}`} style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div className="animate-float" style={{ fontSize: "80px", marginBottom: "20px" }}>🔔</div>
          <h1 className="animate-glow" style={{ fontSize: "40px", fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.02em", marginBottom: "10px" }}>É SUA VEZ!</h1>
          <p style={{ fontSize: "18px", color: "var(--text)", marginBottom: "6px" }}>Dirija-se agora a:</p>
          <p style={{ fontSize: "26px", fontWeight: 800, color: "var(--purple)", marginBottom: "6px" }}>{ticket.counter || "Guichê"}</p>
          <p className="mono" style={{ fontSize: "13px", color: "var(--text-muted)" }}>{room.name}</p>
          <div className="card" style={{ marginTop: "32px", padding: "16px 32px", display: "inline-block", borderColor: "var(--accent-dim)", background: "var(--accent-glow)" }}>
            <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>SENHA</div>
            <div className="mono" style={{ fontSize: "36px", fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em" }}>#{ticketCode}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Aguardando ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", overflow: "hidden" }}>
      {isNext && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 50%, var(--accent-glow) 0%, transparent 60%)", transition: "opacity 1s" }} />}

      <div className={`animate-fade ${shaking ? "animate-shake" : ""}`} style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "360px", textAlign: "center" }}>
        <p className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "28px" }}>
          fila.io · {room.name}
        </p>

        <div style={{ marginBottom: "24px" }}>
          <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: "8px" }}>SENHA</div>
          <div className={`mono ${isNext ? "animate-glow" : ""}`} style={{ fontSize: "58px", fontWeight: 800, letterSpacing: "0.05em", color: isNext ? "var(--accent)" : "var(--text)", transition: "color 0.5s" }}>
            #{ticketCode}
          </div>
        </div>

        <div className={`card ${isNext ? "animate-next" : ""}`} style={{ padding: "26px 24px", marginBottom: "14px", border: `1px solid ${isNext ? "var(--accent)" : "var(--border)"}`, transition: "border-color 0.5s" }}>
          <div className="mono" style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Posição na Fila</div>
          <div className={`mono ${isNext ? "animate-glow" : ""}`} style={{ fontSize: "72px", fontWeight: 800, lineHeight: 1, color: isNext ? "var(--accent)" : "var(--text)", transition: "color 0.5s" }}>
            {ticket.position}º
          </div>

          {/* Barra de progresso visual */}
          <div style={{ marginTop: "16px", height: "6px", background: "var(--border)", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.max(8, 100 - Math.min(90, (ticket.position - 1) * 12))}%`,
              background: isNext ? "var(--accent)" : "var(--purple)",
              transition: "width 0.6s ease",
            }} />
          </div>

          {isNext ? (
            <div style={{ marginTop: "12px", color: "var(--accent)", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "ringPulse 1.5s ease-in-out infinite", display: "inline-block" }} />
              Você é o próximo!
            </div>
          ) : (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--text-muted)" }}>
              Faltam <strong style={{ color: "var(--text)" }}>{aheadInCategory}</strong> pessoa{aheadInCategory !== 1 ? "s" : ""} da sua categoria
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "22px" }}>
          <div className="card" style={{ padding: "14px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>Espera Est.</div>
            <div className="mono" style={{ fontSize: "18px", fontWeight: 700, color: "var(--warn)" }}>{formatWait(ticket.estimatedWait)}</div>
          </div>
          <div className="card" style={{ padding: "14px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>Serviço</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--purple)" }}>{ticket.category}</div>
          </div>
        </div>

        <p className="mono" style={{ color: "var(--text-dim)", fontSize: "11px", lineHeight: 1.6, marginBottom: "20px" }}>
          Não feche esta tela<br />Você será notificado aqui
        </p>

        <button
          className="btn"
          onClick={() => setShowLeaveConfirm(true)}
          style={{ background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border)", padding: "10px 22px", borderRadius: "8px", fontSize: "12px" }}
        >
          🚪 Sair da Fila
        </button>
      </div>

      <ConfirmModal
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={confirmLeaveQueue}
        title="Sair da fila?"
        message="Você perderá sua posição atual. Caso queira voltar, precisará entrar na fila novamente ou pedir para o atendente te readmitir."
        confirmText="Sair da Fila"
        danger
      />
    </div>
  );
};

export default LiveTicketScreen;
