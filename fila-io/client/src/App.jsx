/**
 * client/src/App.jsx
 *
 * Roteador principal com suporte a autenticação.
 *
 * Fluxo:
 *   loading       → spinner
 *   sem sessão    → AuthScreen
 *   sem org       → OrgSetupScreen
 *   com sessão+org → navegação normal
 *
 * Rotas:
 *   landing         → LandingScreen
 *   host-setup      → HostSetupScreen
 *   host-panel      → QueueManagementScreen
 *   client-checkin  → ClientCheckinScreen
 *   live-ticket     → LiveTicketScreen
 *   members         → MembersScreen
 */
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";

import AuthScreen            from "./screens/AuthScreen";
import OrgSetupScreen        from "./screens/OrgSetupScreen";
import LandingScreen         from "./screens/LandingScreen";
import HostSetupScreen       from "./screens/HostSetupScreen";
import QueueManagementScreen from "./screens/QueueManagementScreen";
import ClientCheckinScreen   from "./screens/ClientCheckinScreen";
import LiveTicketScreen      from "./screens/LiveTicketScreen";
import MembersScreen         from "./screens/MembersScreen";

// ── Spinner de carregamento ───────────────────────────────────────
const LoadingScreen = () => (
  <div style={{
    minHeight: "100vh", background: "var(--bg)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: "16px",
  }}>
    <div style={{ fontSize: "28px", fontWeight: 800 }}>
      fila<span style={{ color: "var(--accent)" }}>.io</span>
    </div>
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      border: "3px solid var(--border)",
      borderTopColor: "var(--accent)",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── Router interno (requer AuthProvider) ─────────────────────────
const SESSION_KEY = "fila_io_nav_state";

const Router = () => {
  const { session, activeOrg, loading } = useAuth();

  // Restaura estado da sessão (sobrevive ao reload)
  const [screen, setScreen] = useState(() => {
    // Deep link via URL (QR Code)
    if (window.location.pathname.match(/^\/join\/([A-Z0-9]{6})\/?$/i)) return "client-checkin";
    // Restaura do sessionStorage
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (saved?.screen) return saved.screen;
    } catch {}
    return "landing";
  });
  
  const [ctx, setCtx] = useState(() => {
    // Deep link via URL (QR Code)
    const match = window.location.pathname.match(/^\/join\/([A-Z0-9]{6})\/?$/i);
    if (match) return { initialCode: match[1].toUpperCase() };
    // Restaura do sessionStorage
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (saved?.ctx) return saved.ctx;
    } catch {}
    return {};
  });

  // Persiste estado no sessionStorage a cada mudança
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ screen, ctx }));
    } catch {}
  }, [screen, ctx]);

  const navigate = (target, data = {}) => {
    // Não limpar a URL se contém parâmetros de autenticação (magic link PKCE)
    const url = new URL(window.location.href);
    const hasAuthParams = url.searchParams.has("code") || 
                          url.hash.includes("access_token") ||
                          url.hash.includes("type=magiclink");
    if (window.history.pushState && !hasAuthParams) {
      window.history.pushState({}, "", "/");
    }
    setCtx(data);
    setScreen(target);
  };

  if (loading) return <LoadingScreen />;

  // Rotas públicas: landing, client-checkin e live-ticket não precisam de login
  const publicScreens = ["landing", "client-checkin", "live-ticket"];
  if (!session && !publicScreens.includes(screen)) {
    return <AuthScreen onBack={() => setScreen("landing")} />;
  }

  // Usuário autenticado mas sem organização → precisa criar ou aceitar convite
  if (session && !activeOrg && !publicScreens.includes(screen)) {
    return <OrgSetupScreen onReady={() => setScreen("landing")} />;
  }

  switch (screen) {
    case "landing":
      return <LandingScreen onNavigate={(t) => navigate(t)} />;

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

    case "members":
      return <MembersScreen onBack={() => navigate("landing")} />;

    default:
      return <LandingScreen onNavigate={(t) => navigate(t)} />;
  }
};

import { useTheme } from "./hooks/useTheme";
import OfflineBanner from "./components/OfflineBanner";

// ── Theme Toggle Global ───────────────────────────────────────────
const GlobalThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      style={{
        position: "fixed", bottom: "24px", right: "24px",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "50%", width: "44px", height: "44px",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: "20px", boxShadow: "var(--shadow-lg)",
        zIndex: 9999, transition: "transform 0.2s"
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      title="Alternar Tema"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
};

// ── Root com Provider ─────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router />
        <OfflineBanner />
        <GlobalThemeToggle />
      </AuthProvider>
    </ThemeProvider>
  );
}
