import { useState } from "react";

const LandingScreen = ({ onNavigate }) => {
  const cards = [
    {
      role: "host",
      icon: "🏠",
      title: "Sou Host",
      sub: "Criar e gerenciar sala de atendimento",
      target: "host-setup",
    },
    {
      role: "client",
      icon: "🎟️",
      title: "Sou Cliente",
      sub: "Entrar em uma fila de espera",
      target: "client-checkin",
    },
  ];

  return (
    <div className="screen-container screen-container-centered" style={{ position: "relative", overflow: "hidden" }}>
      {/* Radial glow background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 80% 60% at 50% 50%, var(--accent-glow) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div
        className="animate-fade flex-col gap-lg container-sm"
        style={{ position: "relative", zIndex: 1, textAlign: "center" }}
      >
        {/* Logo */}
        <div style={{ marginBottom: "var(--space-2xl)" }}>
          <div className="animate-float flex-row justify-center gap-md" style={{ marginBottom: "var(--space-md)" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                background: "linear-gradient(135deg, var(--accent), var(--purple))",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
              }}
              aria-hidden="true"
            >
              ⚡
            </div>
            <span style={{ fontSize: "var(--text-4xl)", fontWeight: 800, letterSpacing: "-0.03em" }}>
              fila<span className="text-accent">.io</span>
            </span>
          </div>
          <p
            className="mono text-muted"
            style={{
              fontSize: "var(--text-sm)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Gestão de Filas em Tempo Real
          </p>
        </div>

        {/* Role cards */}
        <div className="flex-col gap-md">
          {cards.map((c) => (
            <button
              key={c.role}
              className="card card-interactive flex-row"
              onClick={() => onNavigate(c.target)}
              aria-label={`${c.title} - ${c.sub}`}
              style={{
                textAlign: "left",
                gap: "var(--space-xl)",
                width: "100%",
                padding: "var(--space-xl)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  background: "var(--accent-light)",
                  borderRadius: "var(--radius-lg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "32px",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {c.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text)" }}>
                  {c.title}
                </div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "var(--space-xs)" }}>
                  {c.sub}
                </div>
              </div>
              <div
                className="text-accent"
                style={{ fontSize: "var(--text-2xl)", opacity: 0.5 }}
                aria-hidden="true"
              >
                →
              </div>
            </button>
          ))}
        </div>

        <p
          className="mono text-dim"
          style={{
            marginTop: "var(--space-2xl)",
            fontSize: "var(--text-xs)",
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
