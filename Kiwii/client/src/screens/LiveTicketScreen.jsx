/**
 * screens/LiveTicketScreen.jsx
 *
 * Design System v3.0 — Acompanhamento ao vivo da senha
 * Recebe eventos em tempo real via Socket.io com alertas visuais sem emojis.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import socket from "../lib/socket";
import {
  Bell,
  LogOut,
  Clock,
  Tag,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";

const LiveTicketScreen = ({ ticket: initialTicket, room, onBack }) => {
  const [ticket, setTicket] = useState(initialTicket);
  const [isNext, setIsNext] = useState(initialTicket?.position === 1);
  const [isCalled, setIsCalled] = useState(initialTicket?.status === "called");
  const [isServed, setIsServed] = useState(initialTicket?.status === "served");
  const [isRecalled, setIsRecalled] = useState(Boolean(initialTicket?.isRecall));
  const [hasLeft, setHasLeft] = useState(
    initialTicket?.status === "abandoned" || initialTicket?.status === "removed"
  );
  const [shaking, setShaking] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const prevPositionRef = useRef(initialTicket?.position);

  // Sincroniza estado ativo com localStorage para acesso a partir de qualquer tela
  useEffect(() => {
    if (hasLeft) {
      try {
        localStorage.removeItem("fila_io_active_ticket");
      } catch {}
    } else if (ticket && room) {
      try {
        localStorage.setItem(
          "fila_io_active_ticket",
          JSON.stringify({
            ticket: {
              ...ticket,
              status: isCalled ? "called" : isServed ? "served" : "waiting",
              isRecall: isRecalled,
            },
            room,
          })
        );
      } catch {}
    }
  }, [ticket, room, isCalled, isServed, isRecalled, hasLeft]);

  // ── Socket subscriptions ──────────────────────────────────────
  const joinClient = useCallback(() => {
    if (initialTicket?.token && room?.code) {
      socket.emit("client:join", {
        roomCode: room.code,
        token: initialTicket.token,
      });
    }
  }, [initialTicket?.token, room?.code]);

  useEffect(() => {
    if (!initialTicket || !room) return;

    joinClient();
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
      // Se estava atendido ou chamado e voltou para a fila (readmitido):
      setIsCalled(false);
      setIsServed(false);
      setIsRecalled(false);
      setHasLeft(false);
    };

    const handleTicketCalled = ({ token }) => {
      if (token !== initialTicket.token) return;
      setIsCalled(true);
      setIsServed(false);
      setIsRecalled(false);
      setHasLeft(false);
      setShaking(true);
      navigator.vibrate?.([200, 100, 200, 100, 400]);
      setTimeout(() => setShaking(false), 800);
    };

    const handleTicketServed = ({ token }) => {
      if (token !== initialTicket.token) return;
      setIsServed(true);
      setIsCalled(false);
      setIsRecalled(false);
      setHasLeft(false);
    };

    const handleTicketRecalled = ({ token }) => {
      if (token !== initialTicket.token) return;
      setIsCalled(true);
      setIsServed(false);
      setIsRecalled(true);
      setHasLeft(false);
      setShaking(true);
      navigator.vibrate?.([300, 150, 300, 150, 600]);
      setTimeout(() => setShaking(false), 800);
    };

    const handleTicketStatus = ({ ticket: statusTicket }) => {
      if (!statusTicket || statusTicket.token !== initialTicket.token) return;
      setTicket((prev) => ({ ...prev, ...statusTicket }));

      if (statusTicket.status === "waiting") {
        setIsCalled(false);
        setIsServed(false);
        setIsRecalled(false);
        setHasLeft(false);
        setIsNext(statusTicket.position === 1);
      } else if (statusTicket.status === "called") {
        setIsCalled(true);
        setIsServed(false);
        setHasLeft(false);
        if (statusTicket.isRecall) {
          setIsRecalled(true);
          navigator.vibrate?.([300, 150, 300, 150, 600]);
        } else {
          navigator.vibrate?.([200, 100, 200, 100, 400]);
        }
        setShaking(true);
        setTimeout(() => setShaking(false), 800);
      } else if (statusTicket.status === "served") {
        setIsServed(true);
        setIsCalled(false);
        setIsRecalled(false);
        setHasLeft(false);
      } else if (statusTicket.status === "abandoned" || statusTicket.status === "removed") {
        setHasLeft(true);
        setIsCalled(false);
        setIsServed(false);
        setIsRecalled(false);
      }
    };

    const handleTicketRemoved = ({ token }) => {
      if (token !== initialTicket.token) return;
      setHasLeft(true);
      setIsCalled(false);
      setIsServed(false);
      setIsRecalled(false);
      try {
        localStorage.removeItem("fila_io_active_ticket");
      } catch {}
    };

    socket.on("queue_update", handleQueueUpdate);
    socket.on("ticket_called", handleTicketCalled);
    socket.on("ticket_served", handleTicketServed);
    socket.on("ticket_recalled", handleTicketRecalled);
    socket.on("ticket_status", handleTicketStatus);
    socket.on("ticket_removed", handleTicketRemoved);

    return () => {
      socket.off("connect", joinClient);
      socket.off("queue_update", handleQueueUpdate);
      socket.off("ticket_called", handleTicketCalled);
      socket.off("ticket_served", handleTicketServed);
      socket.off("ticket_recalled", handleTicketRecalled);
      socket.off("ticket_status", handleTicketStatus);
      socket.off("ticket_removed", handleTicketRemoved);
    };
  }, [initialTicket, room, joinClient]);

  const handleLeaveQueue = () => {
    socket.emit("client:leave", {
      roomCode: room.code,
      token: initialTicket.token,
    });
    setHasLeft(true);
    try {
      localStorage.removeItem("fila_io_active_ticket");
    } catch {}
  };

  const formatWait = (mins) => {
    if (!mins || mins === 0) return "Agora!";
    if (mins < 60) return `~${mins} min`;
    const h = Math.floor(mins / 60),
      m = mins % 60;
    return `~${h}h${m > 0 ? ` ${m}min` : ""}`;
  };

  // ── Loading ───────────────────────────────────────────────────
  if (!ticket || !room) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "28px", fontWeight: 800 }}>
          fila<span style={{ color: "var(--primary)" }}>.io</span>
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "3px solid var(--border)",
            borderTopColor: "var(--primary)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
          Sincronizando ticket...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const ticketCode = ticket.token.split("-").slice(-1)[0].toUpperCase();

  // ── Saiu da fila ─────────────────────────────────────────────
  if (hasLeft) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            marginBottom: "20px",
          }}
        >
          <LogOut size={32} />
        </div>
        <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
          Você saiu da fila
        </h2>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "14px",
            marginBottom: "32px",
          }}
        >
          Sua senha{" "}
          <strong className="mono" style={{ color: "var(--primary)" }}>
            #{ticketCode}
          </strong>{" "}
          foi cancelada.
        </p>
        <button
          className="btn btn-primary"
          onClick={onBack}
          style={{ padding: "12px 28px", fontSize: "14px", gap: "8px" }}
        >
          <ArrowLeft size={16} /> Voltar ao Início
        </button>
      </div>
    );
  }

  // ── Chamado ───────────────────────────────────────────────────
  if (isCalled) {
    const isRecallMode = Boolean(isRecalled);
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: isRecallMode
              ? "radial-gradient(ellipse 90% 70% at 50% 50%, var(--accent-glow) 0%, transparent 70%)"
              : "radial-gradient(ellipse 90% 70% at 50% 50%, var(--primary-glow) 0%, transparent 70%)",
          }}
        />
        <div
          className={`animate-fade ${shaking ? "animate-shake" : ""}`}
          style={{
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            maxWidth: "400px",
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: isRecallMode ? "var(--accent-muted)" : "var(--primary-muted)",
              border: `2px solid ${isRecallMode ? "var(--accent-border)" : "var(--primary-border)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isRecallMode ? "var(--accent)" : "var(--primary)",
              margin: "0 auto 20px",
              boxShadow: `0 0 40px ${isRecallMode ? "var(--accent-glow)" : "var(--primary-glow)"}`,
              animation: "pulse 2s infinite ease-in-out",
            }}
          >
            {isRecallMode ? <RotateCcw size={44} /> : <Bell size={44} />}
          </div>

          <div style={{ marginBottom: "12px" }}>
            <span
              className="tag"
              style={{
                background: isRecallMode ? "var(--accent-muted)" : "var(--primary-muted)",
                color: isRecallMode ? "var(--accent)" : "var(--primary)",
                border: `1px solid ${isRecallMode ? "var(--accent-border)" : "var(--primary-border)"}`,
                padding: "6px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              {isRecallMode ? <RotateCcw size={13} /> : <Bell size={13} />}
              {isRecallMode ? "CHAMADO DE VOLTA" : "ATENDIMENTO IMEDIATO"}
            </span>
          </div>

          <h1
            style={{
              fontSize: "34px",
              fontWeight: 800,
              color: isRecallMode ? "var(--accent)" : "var(--primary)",
              letterSpacing: "-0.02em",
              marginBottom: "8px",
              fontFamily: "var(--font-display)",
            }}
          >
            {isRecallMode ? "CHAMADO DE VOLTA!" : "É SUA VEZ!"}
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "var(--text)",
              marginBottom: "6px",
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {isRecallMode
              ? "Você foi chamado novamente para retorno ao guichê de atendimento."
              : "Por favor, dirija-se ao guichê de atendimento agora."}
          </p>
          <p
            className="mono"
            style={{ fontSize: "12px", color: "var(--text-secondary)" }}
          >
            {room.name}
          </p>
          <div
            className="card"
            style={{
              marginTop: "24px",
              padding: "18px 36px",
              display: "inline-block",
              borderColor: isRecallMode ? "var(--accent-border)" : "var(--primary-border)",
              background: isRecallMode ? "var(--accent-muted)" : "var(--primary-muted)",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                letterSpacing: "0.1em",
                marginBottom: "4px",
              }}
            >
              SUA SENHA
            </div>
            <div
              className="mono"
              style={{
                fontSize: "38px",
                fontWeight: 800,
                color: isRecallMode ? "var(--accent)" : "var(--primary)",
                letterSpacing: "0.08em",
              }}
            >
              #{ticketCode}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Atendido ──────────────────────────────────────────────────
  if (isServed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(52, 211, 153, 0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div className="animate-fade" style={{ maxWidth: "420px", position: "relative", zIndex: 1 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(52, 211, 153, 0.12)",
              border: "1px solid rgba(52, 211, 153, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--priority-low)",
              margin: "0 auto 20px",
              boxShadow: "0 0 32px rgba(52, 211, 153, 0.2)",
            }}
          >
            <CheckCircle size={40} />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <span
              className="tag"
              style={{
                background: "rgba(52, 211, 153, 0.12)",
                color: "var(--priority-low)",
                border: "1px solid rgba(52, 211, 153, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 700,
              }}
            >
              <Sparkles size={12} /> ATENDIMENTO CONCLUÍDO
            </span>
          </div>
          <h2 style={{ fontSize: "26px", fontWeight: 800, marginBottom: "8px", fontFamily: "var(--font-display)" }}>
            Atendimento Finalizado
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "14px",
              marginBottom: "24px",
              lineHeight: 1.5,
            }}
          >
            Sua senha{" "}
            <strong className="mono" style={{ color: "var(--primary)" }}>
              #{ticketCode}
            </strong>{" "}
            foi atendida com sucesso. Caso a equipe precise chamá-lo de volta, esta tela atualizará automaticamente em tempo real.
          </p>
          <div
            className="card"
            style={{
              padding: "16px 24px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--surface)",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Unidade
              </div>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>{room.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Categoria
              </div>
              <div className="mono" style={{ fontWeight: 700, fontSize: "14px", color: "var(--primary)" }}>
                {ticket.category}
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={onBack}
            style={{ padding: "12px 28px", fontSize: "14px", gap: "8px" }}
          >
            <ArrowLeft size={16} /> Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  // ── Aguardando ────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isNext && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 60% at 50% 50%, var(--primary-glow) 0%, transparent 60%)",
            transition: "opacity 1s",
          }}
        />
      )}

      <div
        className={`animate-fade ${shaking ? "animate-shake" : ""}`}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "380px",
          textAlign: "center",
        }}
      >
        <p
          className="mono"
          style={{
            fontSize: "11px",
            color: "var(--text-secondary)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "28px",
          }}
        >
          fila.io · {room.name}
        </p>

        {/* Número da senha */}
        <div style={{ marginBottom: "24px" }}>
          <div
            className="mono"
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              letterSpacing: "0.1em",
              marginBottom: "6px",
            }}
          >
            SENHA
          </div>
          <div
            className="mono"
            style={{
              fontSize: "56px",
              fontWeight: 800,
              letterSpacing: "0.05em",
              color: isNext ? "var(--primary)" : "var(--text)",
              transition: "color 0.4s",
            }}
          >
            #{ticketCode}
          </div>
        </div>

        {/* Card de posição */}
        <div
          className="card"
          style={{
            padding: "24px 20px",
            marginBottom: "16px",
            border: `1px solid ${isNext ? "var(--primary)" : "var(--border)"}`,
            transition: "border-color 0.4s",
            background: isNext ? "var(--primary-muted)" : "var(--surface)",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "8px",
            }}
          >
            Posição na Fila
          </div>
          <div
            className="mono"
            style={{
              fontSize: "72px",
              fontWeight: 800,
              lineHeight: 1,
              color: isNext ? "var(--primary)" : "var(--text)",
              transition: "color 0.4s",
            }}
          >
            {ticket.position}º
          </div>
          {isNext && (
            <div
              style={{
                marginTop: "12px",
                color: "var(--primary)",
                fontSize: "13px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--primary)",
                }}
              />
              Você é o próximo! Fique atento
            </div>
          )}
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div
            className="card"
            style={{ padding: "14px", textAlign: "center" }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                marginBottom: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <Clock size={12} /> Espera estimada
            </div>
            <div
              className="mono"
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--accent)",
              }}
            >
              {formatWait(ticket.estimatedWait)}
            </div>
          </div>
          <div
            className="card"
            style={{ padding: "14px", textAlign: "center" }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                marginBottom: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <Tag size={12} /> Categoria
            </div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {ticket.category}
            </div>
          </div>
        </div>

        <p
          style={{
            color: "var(--text-dim)",
            fontSize: "12px",
            lineHeight: 1.5,
            marginBottom: "24px",
          }}
        >
          Mantenha esta tela aberta. Seu aparelho notificará quando chegar a sua vez.
        </p>

        {/* Botão sair da fila */}
        <button
          onClick={() => setShowLeave(true)}
          className="btn btn-secondary"
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "13px",
            color: "var(--danger)",
            borderColor: "var(--danger-border)",
            gap: "6px",
          }}
        >
          <LogOut size={14} /> Sair da Fila
        </button>
      </div>

      {/* ── Modal confirmação de saída ── */}
      {showLeave && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            className="card animate-fade"
            style={{
              background: "var(--surface)",
              width: "100%",
              maxWidth: "360px",
              padding: "28px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--danger-muted)",
                border: "1px solid var(--danger-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--danger)",
                margin: "0 auto 16px",
              }}
            >
              <LogOut size={24} />
            </div>
            <h3
              style={{
                fontWeight: 700,
                fontSize: "18px",
                marginBottom: "8px",
                color: "var(--text)",
              }}
            >
              Sair da fila?
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "13px",
                marginBottom: "24px",
                lineHeight: 1.5,
              }}
            >
              Sua senha{" "}
              <strong className="mono" style={{ color: "var(--primary)" }}>
                #{ticketCode}
              </strong>{" "}
              será cancelada e você perderá a sua posição atual.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowLeave(false)}
                style={{ flex: 1, padding: "12px", fontSize: "13px" }}
              >
                Permanecer
              </button>
              <button
                className="btn btn-danger"
                onClick={handleLeaveQueue}
                style={{ flex: 1, padding: "12px", fontSize: "13px" }}
              >
                Confirmar Saída
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTicketScreen;
