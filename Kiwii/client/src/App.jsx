import { useState, useEffect } from "react";
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
import OfflineBanner from "./components/OfflineBanner";
import { useAuth } from "./hooks/useAuth";
import { acceptInvite } from "./lib/api";

const getMonitorRoomCode = () => {
  const match = window.location.pathname.match(/^\/monitor\/([A-Z0-9]{6})$/i);
  return match ? match[1].toUpperCase() : null;
};

const getInviteToken = () => {
  const match = window.location.pathname.match(/^\/invite\/([a-zA-Z0-9]+)$/i);
  return match ? match[1] : null;
};

export default function App() {
  const monitorRoomCode = getMonitorRoomCode();
  const directInviteToken = getInviteToken();
  const { user, refreshOrgs } = useAuth();

  const [screen, setScreen] = useState(() => {
    if (directInviteToken) return "invite";
    try {
      return sessionStorage.getItem("kiwii_screen") || "landing";
    } catch {
      return "landing";
    }
  });

  const [ctx, setCtx] = useState(() => {
    if (directInviteToken) return { inviteToken: directInviteToken };
    try {
      const saved = sessionStorage.getItem("kiwii_ctx");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Se o usuário fez login e tinha um convite pendente guardado no sessionStorage, processa automaticamente
  useEffect(() => {
    const pendingToken = sessionStorage.getItem("pending_invite_token");
    if (user && pendingToken) {
      sessionStorage.removeItem("pending_invite_token");
      acceptInvite(pendingToken)
        .then(() => refreshOrgs())
        .catch(() => {})
        .finally(() => {
          navigate("landing");
        });
    }
  }, [user, refreshOrgs]);

  // Painel de monitor (TV externa)
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

  const renderScreen = () => {
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

      case "members":
        return <MembersScreen onBack={() => navigate("landing")} />;

      case "org-setup":
        return (
          <OrgSetupScreen
            onReady={() => navigate("landing")}
            onBack={() => navigate("landing")}
          />
        );

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
        return <LandingScreen onNavigate={(target, data) => navigate(target, data)} />;
    }
  };

  return (
    <>
      <OfflineBanner />
      {renderScreen()}
    </>
  );
}
