/**
 * QRDisplay — renderiza um QR code visual determinístico a partir do código da sala.
 */
import { QRCodeSVG } from "qrcode.react";

const QRDisplay = ({ code, size = 120 }) => {
  // Constrói a URL dinamicamente baseada no ambiente atual (localhost ou produção)
  const origin = typeof window !== "undefined" ? window.location.origin : "https://fila.io";
  const url = `${origin}/join/${code}`;

  return (
    <div style={{ background: "#fff", padding: "10px", borderRadius: "12px", display: "inline-block", lineHeight: 0 }}>
      <QRCodeSVG value={url} size={size} level="M" />
    </div>
  );
};

export default QRDisplay;
