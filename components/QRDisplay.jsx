/**
 * QRDisplay — renders a deterministic visual QR code from a room code string.
 *
 * In production, replace with:
 *   npm install qrcode.react
 *   import { QRCodeSVG } from "qrcode.react";
 *   <QRCodeSVG value={`https://fila.io/join/${code}`} size={120} />
 */
const QRDisplay = ({ code, size = 120 }) => {
  const CELLS = 21;
  const cell = size / CELLS;

  // Deterministic pattern seeded from room code
  const seed = code
    .split("")
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);

  const isFinder = (x, y) =>
    (x < 7 && y < 7) ||
    (x > CELLS - 8 && y < 7) ||
    (x < 7 && y > CELLS - 8);

  const isFinderBorder = (x, y) =>
    (x === 7 && y <= 7) ||
    (y === 7 && x <= 7) ||
    (x === CELLS - 8 && y <= 7) ||
    (y === 7 && x >= CELLS - 8) ||
    (x === 7 && y >= CELLS - 8) ||
    (y === CELLS - 8 && x <= 7);

  const pattern = Array.from({ length: CELLS * CELLS }, (_, i) => {
    const x = i % CELLS;
    const y = Math.floor(i / CELLS);
    if (isFinderBorder(x, y)) return false;
    if (isFinder(x, y)) return true;
    return (((seed * (i + 1) * 1_234_567) >> 3) & 3) === 0;
  });

  return (
    <div
      style={{
        background: "#fff",
        padding: "10px",
        borderRadius: "12px",
        display: "inline-block",
        lineHeight: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {pattern.map(
          (filled, i) =>
            filled && (
              <rect
                key={i}
                x={(i % CELLS) * cell}
                y={Math.floor(i / CELLS) * cell}
                width={cell}
                height={cell}
                fill="#000"
              />
            )
        )}
      </svg>
    </div>
  );
};

export default QRDisplay;
