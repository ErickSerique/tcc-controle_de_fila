/**
 * components/OfflineBanner.jsx
 *
 * Banner discreto que indica ao host que está operando em modo offline.
 * Exibido apenas quando isOffline = true no contexto de auth.
 */
import { useAuth } from "../hooks/useAuth";

const OfflineBanner = () => {
  const { isOffline } = useAuth();

  if (!isOffline) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0,
      background: "linear-gradient(90deg, #f59e0b, #d97706)",
      color: "#1a1a1a",
      padding: "8px 16px",
      fontSize: "13px",
      fontWeight: 600,
      textAlign: "center",
      zIndex: 300,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    }}>
      <span style={{ fontSize: "16px" }}>📡</span>
      Modo Offline — operando com sessão local. Dados serão sincronizados quando a conexão retornar.
    </div>
  );
};

export default OfflineBanner;
