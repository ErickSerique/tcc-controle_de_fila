/**
 * screens/LiveTicketScreen.jsx
 *
 * Kiwii Design System v3.0 — Acompanhamento ao vivo da senha
 * Suporta múltiplos guichês, notificações em tempo real, aviso de rechamada e saída voluntária.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  CheckCircle2,
  XCircle,
  DoorOpen,
  RotateCcw,
  Sparkles,
  Clock,
  Layers,
} from "lucide-react";
import socket from "../lib/socket";
import ConfirmModal from "../components/ConfirmModal";

// Toca som sintético de notificação usando Web Audio API
const playChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {}
};

const formatWait = (min) => {
  if (!min || min <= 0) return "< 1 min";
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  }
  return `~${min} min`;
};

const LiveTicketScreen = ({ ticket: initialTicket, room, onBack }) => {
  const [ticket, setTicket] = useState(initialTicket);
  const [isNext, setIsNext] = useState(initialTicket?.position === 1);
  const [isCalled, setIsCalled] = useState(initialTicket?.status === "called");
  const [isRecalled, setIsRecalled] = useState(Boolean(initialTicket?.isRecall));
  const [terminalStatus, setTerminalStatus] = useState(
    initialTicket?.status === "served"
      ? "served"
      : initialTicket?.status === "removed"
      ? "removed_by_host"
      : initialTicket?.status === "abandoned"
      ? "left_voluntarily"
      : null
  );
  const [shaking, setShaking] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [aheadInCategory, setAheadInCategory] = useState(0);
  const prevPositionRef = useRef(initialTicket?.position);

  // Sincroniza com localStorage para permitir acesso de qualquer tela / aba
  useEffect(() => {
    if (terminalStatus) {
      try {
        localStorage.removeItem("kiwii_active_ticket");
      } catch {}
    } else if (ticket && room) {
      try {
        localStorage.setItem(
          "kiwii_active_ticket",
          JSON.stringify({
            ticket: {
              ...ticket,
              status: isCalled ? "called" : "waiting",
              isRecall: isRecalled,
            },
            room,
          })
        );
      } catch {}
    }
  }, [ticket, room, isCalled, isRecalled, terminalStatus]);

  useEffect(() => {
    if (!initialTicket || !room) return;

    const joinRoom = () => {
      socket.emit("client:join", {
        roomCode: room.code,
        token: initialTicket.token,
      });
    };

    if (socket.connected) joinRoom();
    socket.on("connect", joinRoom);

    const handleQueueUpdate = ({ roomCode, queue }) => {
      if (roomCode?.toUpperCase() !== room.code?.toUpperCase()) return;
      const me = queue.find((t) => t.token === initialTicket.token);
      if (!me) return;

      if (prevPositionRef.current && me.position < prevPositionRef.current) {
        navigator.vibrate?.(50);
        prevPositionRef.current = me.position;
      }

      const ahead = queue.filter(
        (t) => t.category === me.category && t.position < me.position
      ).length;
      setAheadInCategory(ahead);
      setTicket(me);
      setIsNext(me.position === 1);
    };

    // Chamada normal (Alta 5)
    const handleTicketCalled = (calledTicket) => {
      if (calledTicket.token === initialTicket.token) {
        setIsCalled(true);
        setIsRecalled(false);
        setTicket((prev) => ({
          ...prev,
          counter: calledTicket.counter || prev.counter,
          status: "called",
        }));
        playChime();
        navigator.vibrate?.([200, 100, 200, 100, 300]);
        setShaking(true);
        setTimeout(() => setShaking(false), 800);
      }
    };

    // Rechamada de cliente (Média 1)
    const handleTicketRecalled = (data) => {
      const isMe =
        data.token === initialTicket.token ||
        data.ticketNumber === initialTicket.ticketNumber ||
        data.ticket?.token === initialTicket.token;

      if (isMe) {
        setIsCalled(true);
        setIsRecalled(true);
        setTicket((prev) => ({
          ...prev,
          counter: data.counterName || data.counter || prev.counter,
          status: "called",
          isRecall: true,
        }));
        playChime();
        navigator.vibrate?.([300, 100, 300, 100, 500]);
        setShaking(true);
        setTimeout(() => setShaking(false), 1200);
      }
    };

    // Atualização de status
    const handleTicketStatus = ({ token, status, counter }) => {
      if (token === initialTicket.token) {
        if (status === "called") {
          setIsCalled(true);
          if (counter) setTicket((prev) => ({ ...prev, counter }));
          playChime();
          navigator.vibrate?.([200, 100, 200]);
        } else if (status === "served") {
          setIsCalled(false);
          setTerminalStatus("served");
          localStorage.removeItem("kiwii_active_ticket");
        } else if (status === "removed") {
          setIsCalled(false);
          setTerminalStatus("removed_by_host");
          localStorage.removeItem("kiwii_active_ticket");
        }
      }
    };

    const handleTicketServed = (servedTicket) => {
      if (servedTicket.token === initialTicket.token) {
        setIsCalled(false);
        setTerminalStatus("served");
        localStorage.removeItem("kiwii_active_ticket");
      }
    };

    const handleTicketRemoved = (removedTicket) => {
      if (removedTicket.token === initialTicket.token) {
        setIsCalled(false);
        setTerminalStatus("removed_by_host");
        localStorage.removeItem("kiwii_active_ticket");
      }
    };

    socket.on("queue_update", handleQueueUpdate);
    socket.on("ticket_called", handleTicketCalled);
    socket.on("ticket_recalled", handleTicketRecalled);
    socket.on("ticket_status", handleTicketStatus);
    socket.on("ticket_served", handleTicketServed);
    socket.on("ticket_removed", handleTicketRemoved);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("queue_update", handleQueueUpdate);
      socket.off("ticket_called", handleTicketCalled);
      socket.off("ticket_recalled", handleTicketRecalled);
      socket.off("ticket_status", handleTicketStatus);
      socket.off("ticket_served", handleTicketServed);
      socket.off("ticket_removed", handleTicketRemoved);
    };
  }, [initialTicket, room]);

  const confirmLeaveQueue = () => {
    socket.emit("client:leave", {
      roomCode: room.code,
      token: initialTicket.token,
    });
    setTerminalStatus("left_voluntarily");
    localStorage.removeItem("kiwii_active_ticket");
  };

  // ── ESTADO TERMINAL: Atendido / Removido / Saiu ────────────────
  if (terminalStatus) {
    const isSuccess = terminalStatus === "served";
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          padding: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="card animate-fade" style={{ maxWidth: "420px", width: "100%", padding: "40px", textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: isSuccess ? "var(--success-light)" : "var(--danger-glow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            {isSuccess ? (
              <CheckCircle2 size={32} color="var(--success)" />
            ) : (
              <XCircle size={32} color="var(--danger)" />
            )}
          </div>

          <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>
            {terminalStatus === "served"
              ? "Atendimento Concluído"
              : terminalStatus === "removed_by_host"
              ? "Senha Cancelada"
              : "Você saiu da fila"}
          </h2>

          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "28px", lineHeight: 1.6 }}>
            {terminalStatus === "served"
              ? "Seu atendimento foi finalizado com sucesso. Obrigado pela preferência!"
              : terminalStatus === "removed_by_host"
              ? "Sua senha foi cancelada ou dispensada pelo atendente."
              : "Você deixou a fila voluntariamente e sua senha foi liberada."}
          </p>

          <button className="btn btn-primary" onClick={onBack} style={{ width: "100%", padding: "14px" }}>
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  // ── ESTADO: Chamado pelo Atendente (Alta 5 / Média 1) ──────────
  if (isCalled) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          padding: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className={`card animate-fade ${shaking ? "animate-shake" : ""}`}
          style={{
            maxWidth: "440px",
            width: "100%",
            padding: "36px 28px",
            textAlign: "center",
            borderColor: isRecalled ? "var(--warn)" : "var(--accent)",
            background: isRecalled ? "rgba(245, 158, 11, 0.08)" : "var(--accent-light)",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: isRecalled ? "var(--warn)" : "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: isRecalled ? "0 0 30px rgba(245, 158, 11, 0.4)" : "0 0 30px var(--accent-glow)",
            }}
          >
            {isRecalled ? (
              <RotateCcw size={36} color="#04141C" />
            ) : (
              <Bell size={36} color="#04141C" />
            )}
          </div>

          {isRecalled ? (
            <div
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: "999px",
                background: "rgba(245, 158, 11, 0.2)",
                color: "var(--warn)",
                fontWeight: 700,
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "12px",
              }}
            >
              Chamado de Volta!
            </div>
          ) : (
            <div
              className="mono"
              style={{
                fontSize: "12px",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "8px",
              }}
            >
              É a sua vez!
            </div>
          )}

          <div
            className="mono"
            style={{
              fontSize: "64px",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: isRecalled ? "var(--warn)" : "var(--accent)",
              marginBottom: "8px",
            }}
          >
            #{ticket.ticketNumber}
          </div>

          <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "20px" }}>
            {ticket.name}
          </div>

          <div
            className="card"
            style={{
              padding: "20px",
              marginBottom: "24px",
              background: "var(--surface)",
              border: `1px solid ${isRecalled ? "var(--warn)" : "var(--accent)"}`,
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "6px",
              }}
            >
              Dirija-se ao
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: isRecalled ? "var(--warn)" : "var(--accent)",
              }}
            >
              {ticket.counter || "Balcão de Atendimento"}
            </div>
          </div>

          <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
            {isRecalled
              ? "O atendente solicitou seu retorno imediato ao guichê."
              : "Por favor, dirija-se imediatamente ao balcão indicado com seu documento em mãos."}
          </p>
        </div>
      </div>
    );
  }

  // ── ESTADO: Aguardando na Fila ─────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="card animate-fade"
        style={{
          maxWidth: "420px",
          width: "100%",
          padding: "36px 28px",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <div className="display" style={{ fontSize: "18px", fontWeight: 800, marginBottom: "2px" }}>
            {room.name}
          </div>
          <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Sala {room.code}
          </div>
        </div>

        {isNext && (
          <div
            style={{
              background: "var(--warn-light)",
              border: "1px solid var(--warn)",
              borderRadius: "8px",
              padding: "10px 14px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              color: "var(--warn)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <Bell size={16} /> Você é o próximo! Fique atento.
          </div>
        )}

        <div style={{ marginBottom: "28px" }}>
          <div
            className="mono"
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "8px",
            }}
          >
            Sua Senha
          </div>
          <div
            className="mono"
            style={{
              fontSize: "64px",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: isNext ? "var(--warn)" : "var(--accent)",
              marginBottom: "8px",
            }}
          >
            #{ticket.ticketNumber}
          </div>
          <div style={{ fontSize: "16px", fontWeight: 600 }}>{ticket.name}</div>
        </div>

        {/* Estatísticas de posição e tempo */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "10px",
            marginBottom: "28px",
          }}
        >
          <div className="card" style={{ padding: "14px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>
              Posição Geral
            </div>
            <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)" }}>
              {ticket.position}º
            </div>
            {aheadInCategory > 0 && (
              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                ({aheadInCategory} no seu tipo)
              </div>
            )}
          </div>

          <div className="card" style={{ padding: "14px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>
              Espera Est.
            </div>
            <div className="mono" style={{ fontSize: "18px", fontWeight: 700, color: "var(--warn)" }}>
              {formatWait(ticket.estimatedWait)}
            </div>
          </div>

          <div className="card" style={{ padding: "14px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>
              Serviço
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--info)" }}>
              {ticket.category}
            </div>
          </div>
        </div>

        <p className="mono" style={{ color: "var(--text-dim)", fontSize: "11px", lineHeight: 1.6, marginBottom: "20px" }}>
          Mantenha esta tela aberta.<br />Você será alertado quando for chamado ao guichê.
        </p>

        <button
          className="btn"
          onClick={() => setShowLeaveConfirm(true)}
          style={{ color: "var(--text-dim)", padding: "10px 22px", fontSize: "12px" }}
        >
          <DoorOpen size={14} /> Sair da Fila
        </button>
      </div>

      <ConfirmModal
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={confirmLeaveQueue}
        title="Sair da fila?"
        message="Você perderá sua posição atual. Caso queira voltar, precisará gerar uma nova senha."
        confirmText="Sair da Fila"
        danger
      />
    </div>
  );
};

export default LiveTicketScreen;
