import { useState } from "react";
import LandingScreen from "./screens/LandingScreen";
import HostSetupScreen from "./screens/HostSetupScreen";
import ClientCheckinScreen from "./screens/ClientCheckinScreen";
import LiveTicketScreen from "./screens/LiveTicketScreen";
import QueueManagementScreen from "./screens/QueueManagementScreen";
import MonitorScreen from "./screens/MonitorScreen";
import AuthScreen from "./screens/AuthScreen";
import MembersScreen from "./screens/MembersScreen";
import OrgSetupScreen from "./screens/OrgSetupScreen";
import OfflineBanner from "./components/OfflineBanner";

/**
 * App — controlador de navegação principal.
 *
 * Rotas normais (state machine interna persistida no sessionStorage):
 *   landing → host-setup → host-panel
 *   landing → client-checkin → live-ticket
 *   landing → auth
 *   landing → members
 *   landing → org-setup
 *
 * Deep link especial:
 *   /monitor/:roomCode → bypassa a state machine e renderiza direto
 *   o painel de TV externa (somente leitura, sem login).
 */
const getMonitorRoomCode = () => {
  const match = window.location.pathname.match(/^\/monitor\/([A-Z0-9]{6})$/i);
  return match ? match[1].toUpperCase() : null;
};

export default function App() {
  const monitorRoomCode = getMonitorRoomCode();

  const [screen, setScreen] = useState(() => {
    try {
      return sessionStorage.getItem("fila_io_screen") || "landing";
    } catch {
      return "landing";
    }
  });

  const [ctx, setCtx] = useState(() => {
    try {
      const saved = sessionStorage.getItem("fila_io_ctx");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Painel de monitor (TV externa) — não passa pelo fluxo normal de navegação
  if (monitorRoomCode) {
    return <MonitorScreen roomCode={monitorRoomCode} />;
  }

  const navigate = (target, data = {}) => {
    setCtx(data);
    setScreen(target);
    try {
      sessionStorage.setItem("fila_io_screen", target);
      sessionStorage.setItem("fila_io_ctx", JSON.stringify(data));
    } catch {}
  };

  const renderScreen = () => {
    switch (screen) {
      case "landing":
        return <LandingScreen onNavigate={(target) => navigate(target)} />;

      case "auth":
        return <AuthScreen onBack={() => navigate("landing")} />;

      case "members":
        return <MembersScreen onBack={() => navigate("landing")} />;

      case "org-setup":
        return <OrgSetupScreen onReady={() => navigate("landing")} onBack={() => navigate("landing")} />;

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

      default:
        return <LandingScreen onNavigate={(target) => navigate(target)} />;
    }
  };

  return (
    <>
      <OfflineBanner />
      {renderScreen()}
    </>
  );
}
