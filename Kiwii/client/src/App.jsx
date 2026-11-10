/**
 * client/src/App.jsx
 *
 * Roteador principal com suporte a tema, autenticação, deep links e todas as telas do sistema.
 */
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider, useTheme } from "./hooks/useTheme";
import { Sun, Moon } from "lucide-react";

import LandingScreen from "./screens/LandingScreen";
import HostSetupScreen from "./screens/HostSetupScreen";
import ClientCheckinScreen from "./screens/ClientCheckinScreen";
import LiveTicketScreen from "./screens/LiveTicketScreen";
import QueueManagementScreen from "./screens/QueueManagementScreen";
import MonitorScreen from "./screens/MonitorScreen";
import AuthScreen from "./screens/AuthScreen";
import MembersScreen from "./screens/MembersScreen";
import OrgSetupScreen from "./screens/OrgSetupScreen";
import InviteScreen from "./screens/InviteScreen";
import HostDashboardScreen from "./screens/HostDashboardScreen";
import OfflineBanner from "./components/OfflineBanner";

const getMonitorRoomCode = () => {
  const match = window.location.pathname.match(/^\/monitor\/([A-Z0-9]{6})$/i);
  return match ? match[1].toUpperCase() : null;
};

const getInviteToken = () => {
  const match = window.location.pathname.match(/^\/invite\/([a-zA-Z0-9_-]+)$/i);
  return match ? match[1] : null;
};

const getJoinCode = () => {
  const match = window.location.pathname.match(/^\/join\/([A-Z0-9]{6})\/?$/i);
  return match ? match[1].toUpperCase() : null;
};

// ── Botão Global para alternar tema ─────────────────────────────
const GlobalThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "50%",
        width: "44px",
        height: "44px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--text)",
        boxShadow: "var(--shadow-lg)",
        zIndex: 9999,
        transition: "transform 0.2s, border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.1)";
        e.currentTarget.style.borderColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
      title="Alternar Tema Claro/Escuro"
      aria-label="Alternar tema"
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
};

// ── Roteador interno ────────────────────────────────────────────
const Router = () => {
  const monitorRoomCode = getMonitorRoomCode();
  const directInviteToken = getInviteToken();
  const directJoinCode = getJoinCode();
  const { user, activeOrg, loading } = useAuth();

  const [screen, setScreen] = useState(() => {
    if (directInviteToken) return "invite";
    if (directJoinCode) return "client-checkin";
    try {
      return sessionStorage.getItem("kiwii_screen") || "landing";
    } catch {
      return "landing";
    }
  });

  const [ctx, setCtx] = useState(() => {
    if (directInviteToken) return { inviteToken: directInviteToken };
    if (directJoinCode) return { initialCode: directJoinCode };
    try {
      const saved = sessionStorage.getItem("kiwii_ctx");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Limpa rota da barra de endereços após captura do deep link (sem recarregar)
  useEffect(() => {
    if (directInviteToken || directJoinCode) {
      if (window.history.replaceState) {
        window.history.replaceState({}, "", "/");
      }
    }
  }, [directInviteToken, directJoinCode]);

  // Modo monitor em tela cheia (TV externa)
  if (monitorRoomCode) {
    return <MonitorScreen roomCode={monitorRoomCode} />;
  }

  const navigate = (target, data = {}) => {
    setCtx(data);
    setScreen(target);
    try {
      sessionStorage.setItem("kiwii_screen", target);
      sessionStorage.setItem("kiwii_ctx", JSON.stringify(data));
    } catch {}
  };

  if (loading) {
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
        <div className="display" style={{ fontSize: "28px", fontWeight: 800 }}>
          Kiwi<span style={{ color: "var(--accent)" }}>i</span>
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "3px solid var(--border)",
            borderTopColor: "var(--accent)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Rotas públicas que não requerem login:
  const publicScreens = ["landing", "auth", "client-checkin", "live-ticket", "invite"];
  if (!user && !publicScreens.includes(screen)) {
    return <AuthScreen onBack={() => navigate("landing")} />;
  }

  switch (screen) {
    case "landing":
      return <LandingScreen onNavigate={(target, data) => navigate(target, data)} />;

    case "auth":
      return <AuthScreen onBack={() => navigate("landing")} />;

    case "invite":
      return (
        <InviteScreen
          token={ctx.inviteToken || directInviteToken}
          onAccepted={() => {
            window.history.replaceState({}, "", "/");
            navigate("landing");
          }}
          onRequireLogin={() => navigate("auth")}
        />
      );

    case "org-setup":
      return (
        <OrgSetupScreen
          onReady={() => navigate("landing")}
          onBack={() => navigate("landing")}
        />
      );

    case "members":
      return <MembersScreen onBack={() => navigate("landing")} />;

    case "host-setup":
      return (
        <HostSetupScreen
          onRoomCreated={(code, room) => navigate("host-panel", { roomCode: code, room })}
          onBack={() => navigate("landing")}
        />
      );

    case "host-panel":
      return (
        <QueueManagementScreen
          roomCode={ctx.roomCode}
          room={ctx.room}
          onCloseDay={() => navigate("landing")}
          onBack={() => navigate("landing")}
        />
      );

    case "client-checkin":
      return (
        <ClientCheckinScreen
          initialCode={ctx.initialCode}
          onJoined={(ticket, room) => navigate("live-ticket", { ticket, room })}
          onBack={() => navigate("landing")}
        />
      );

    case "live-ticket":
      return (
        <LiveTicketScreen
          ticket={ctx.ticket}
          room={ctx.room}
          onBack={() => navigate("landing")}
        />
      );

    case "host-dashboard":
      return <HostDashboardScreen onBack={() => navigate("landing")} />;

    default:
      return <LandingScreen onNavigate={(target, data) => navigate(target, data)} />;
  }
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <OfflineBanner />
        <Router />
        <GlobalThemeToggle />
      </AuthProvider>
    </ThemeProvider>
  );
}
