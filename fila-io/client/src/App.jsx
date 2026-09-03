import { useState } from "react";
import LandingScreen from "./screens/LandingScreen";
import HostSetupScreen from "./screens/HostSetupScreen";
import ClientCheckinScreen from "./screens/ClientCheckinScreen";
import LiveTicketScreen from "./screens/LiveTicketScreen";
import QueueManagementScreen from "./screens/QueueManagementScreen";
import MonitorScreen from "./screens/MonitorScreen";

/**
 * App — controlador de navegação principal.
 *
 * Rotas normais (state machine interna, sem react-router):
 *   landing → host-setup → host-panel
 *   landing → client-checkin → live-ticket
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
  const [screen, setScreen] = useState("landing");
  const [ctx, setCtx] = useState({});

  // Painel de monitor (TV externa) — não passa pelo fluxo normal de navegação
  if (monitorRoomCode) {
    return <MonitorScreen roomCode={monitorRoomCode} />;
  }

  const navigate = (target, data = {}) => {
    setCtx(data);
    setScreen(target);
  };

  switch (screen) {
    case "landing":
      return <LandingScreen onNavigate={(target) => navigate(target)} />;

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
}
