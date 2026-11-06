/**
 * components/OfflineBanner.jsx
 *
 * Banner discreto que indica ao host que está operando em modo offline.
 * Exibido apenas quando isOffline = true no contexto de auth.
 */
import { useAuth } from "../hooks/useAuth";
import { WifiOff } from "lucide-react";

const OfflineBanner = () => {
  const { isOffline } = useAuth();

  if (!isOffline) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        background: "var(--warning)",
        color: "#0c0f14",
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 600,
        textAlign: "center",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <WifiOff size={16} />
      <span>
        Modo Offline ativo — operando com sessão local. Os dados serão sincronizados quando a conexão for restaurada.
      </span>
    </div>
  );
};

export default OfflineBanner;
