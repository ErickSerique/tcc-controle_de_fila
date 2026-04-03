import { useState } from "react";

const LandingScreen = ({ onNavigate }) => {
  const [hovered, setHovered] = useState(null);

  const cards = [
    {
      role: "host",
      icon: "🏠",
      title: "Sou Host",
      sub: "Criar e gerenciar sala de atendimento",
      color: "#6EE7B7",
      shadow: "rgba(110,231,183,0.18)",
      target: "host-setup",
    },
    {
      role: "client",
      icon: "🎟️",
      title: "Sou Cliente",
      sub: "Entrar em uma fila de espera",
      color: "#A78BFA",
      shadow: "rgba(167,139,250,0.18)",
      target: "client-checkin",
    },
  ];

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
      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.3,
        }}
      />
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, var(--accent-glow) 0%, transparent 70%)",
        }}
      />

      <div
        className="animate-fade"
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          width: "100%",
          maxWidth: "460px",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: "52px" }}>
          <div
            className="animate-float"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                background: "linear-gradient(135deg, var(--accent), var(--purple))",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
              }}
            >
              ⚡
            </div>
            <span style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.03em" }}>
              fila<span style={{ color: "var(--accent)" }}>.io</span>
            </span>
          </div>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontFamily: "JetBrains Mono",
            }}
          >
            Gestão de Filas em Tempo Real
          </p>
        </div>

        {/* Role cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {cards.map((c) => (
            <button
              key={c.role}
              className="btn card"
              onMouseEnter={() => setHovered(c.role)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onNavigate(c.target)}
              style={{
                padding: "26px 22px",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "20px",
                border: `1px solid ${hovered === c.role ? c.color + "55" : "var(--border)"}`,
                transition: "all 0.3s ease",
                transform: hovered === c.role ? "translateY(-3px)" : "none",
                boxShadow: hovered === c.role ? `0 20px 60px ${c.shadow}` : "none",
                cursor: "pointer",
                width: "100%",
                background: hovered === c.role ? `${c.color}08` : "var(--surface)",
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  background: `${c.color}15`,
                  borderRadius: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  flexShrink: 0,
                  transition: "transform 0.3s",
                  transform: hovered === c.role ? "scale(1.08)" : "scale(1)",
                }}
              >
                {c.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: hovered === c.role ? c.color : "var(--text)",
                    transition: "color 0.2s",
                  }}
                >
                  {c.title}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    marginTop: "3px",
                  }}
                >
                  {c.sub}
                </div>
              </div>
              <div
                style={{
                  color: c.color,
                  fontSize: "22px",
                  opacity: hovered === c.role ? 1 : 0.25,
                  transition: "all 0.2s",
                  transform: hovered === c.role ? "translateX(4px)" : "none",
                }}
              >
                →
              </div>
            </button>
          ))}
        </div>

        <p
          className="mono"
          style={{
            marginTop: "36px",
            color: "var(--text-dim)",
            fontSize: "11px",
            letterSpacing: "0.08em",
          }}
        >
          v1.0.0 MVP · Latência &lt;200ms · Socket.io
        </p>
      </div>
    </div>
  );
};

export default LandingScreen;
