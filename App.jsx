import { useState } from "react";
import LandingScreen from "./screens/LandingScreen";
import HostSetupScreen from "./screens/HostSetupScreen";
import ClientCheckinScreen from "./screens/ClientCheckinScreen";
import LiveTicketScreen from "./screens/LiveTicketScreen";
import QueueManagementScreen from "./screens/QueueManagementScreen";

/**
 * App — top-level navigation controller.
 *
 * Screen flow:
 *
 *   landing
 *     ├── host-setup  →  host-panel
 *     └── client-checkin  →  live-ticket
 *
 * ctx holds screen-specific data (roomCode, room, ticket, etc.)
 */
export default function App() {
  const [screen, setScreen] = useState("landing");
  const [ctx, setCtx] = useState({});

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