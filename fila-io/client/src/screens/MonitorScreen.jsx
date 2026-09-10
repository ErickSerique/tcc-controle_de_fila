import { useState, useEffect } from "react";
import socket from "../lib/socket";

/**
 * MonitorScreen — painel para TV/monitor externo do estabelecimento.
 * Somente leitura: mostra quem está sendo atendido em cada guichê
 * e os próximos da fila. Pensado para ficar em tela cheia 24/7.
 *
 * Acesso: http://localhost:5173/monitor/ABC123
 * (o roomCode é detectado via URL em App.jsx e passado como prop aqui)
 */
const MonitorScreen = ({ roomCode }) => {
  const [room, setRoom] = useState(null);
  const [queue, setQueue] = useState([]);
  const [archive, setArchive] = useState([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetch(`/api/rooms/${roomCode}`)
      .then((r) => r.json())
      .then((data) => !data.error && setRoom(data))
      .catch(() => {});

    // Reenvia o "join" sempre que o socket conectar — incluindo reconexões após
    // queda de rede, não só na primeira montagem. Sem isso, o monitor fica
    // "mudo" depois de qualquer instabilidade de conexão até um F5 manual.
    const joinRoom = () => socket.emit("monitor:join", { roomCode });
    if (socket.connected) joinRoom();
    socket.on("connect", joinRoom);

    const handleQueue = ({ roomCode: rc, queue: q }) => { if (rc === roomCode) setQueue(q); };
    const handleArchive = ({ roomCode: rc, archive: a }) => { if (rc === roomCode) setArchive(a); };

    socket.on("queue_update", handleQueue);
    socket.on("archive_update", handleArchive);
    const clock = setInterval(() => setNow(new Date()), 1000);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("queue_update", handleQueue);
      socket.off("archive_update", handleArchive);
      clearInterval(clock);
    };
  }, [roomCode]);

  const callingNow = archive.filter((t) => t.status === "called");
  const nextUp = queue.slice(0, 6);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "40px", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div style={{ fontSize: "32px", fontWeight: 800 }}>
          fila<span style={{ color: "var(--accent)" }}>.io</span>
          {room && <span style={{ color: "var(--text-muted)", fontSize: "22px", marginLeft: "16px", fontWeight: 500 }}>{room.name}</span>}
        </div>
        <div className="mono" style={{ fontSize: "28px", color: "var(--text-muted)" }}>
          {now.toLocaleTimeString("pt-BR")}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "32px", flex: 1 }}>
        {/* Chamando agora */}
        <div>
          <h2 className="mono" style={{ fontSize: "16px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
            🔔 Chamando Agora
          </h2>
          {callingNow.length === 0 ? (
            <div className="card" style={{ padding: "60px", textAlign: "center", color: "var(--text-dim)", fontSize: "20px" }}>
              Nenhum chamado no momento
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {callingNow.map((t) => (
                <div key={t.token} className="card animate-glow" style={{ padding: "28px 32px", border: "2px solid var(--accent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "34px", fontWeight: 800, color: "var(--accent)" }}>{t.name}</div>
                    <div style={{ fontSize: "16px", color: "var(--text-muted)", marginTop: "4px" }}>{t.category}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ fontSize: "13px", color: "var(--text-muted)" }}>DIRIJA-SE A</div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--purple)" }}>{t.counter}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Próximos */}
        <div>
          <h2 className="mono" style={{ fontSize: "16px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
            Próximos a Serem Chamados
          </h2>
          <div className="card" style={{ overflow: "hidden" }}>
            {nextUp.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>Fila vazia</div>
            ) : (
              nextUp.map((t, i) => (
                <div key={t.token} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "18px 24px", borderBottom: i < nextUp.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: i === 0 ? "var(--accent)" : "var(--text-muted)", minWidth: "36px" }}>
                    {t.position}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "18px" }}>{t.name}</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t.category}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="mono" style={{ textAlign: "center", marginTop: "32px", color: "var(--text-dim)", fontSize: "13px" }}>
        Painel de monitoramento · Atualização em tempo real
      </p>
    </div>
  );
};

export default MonitorScreen;
