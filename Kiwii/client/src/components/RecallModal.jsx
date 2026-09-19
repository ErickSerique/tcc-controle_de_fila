import { useState, useEffect } from "react";
import { RotateCcw, Volume2, CornerUpLeft } from "lucide-react";
import Modal from "./Modal";

/**
 * RecallModal — permite ao host chamar de volta um ticket que já saiu
 * da fila (atendido, removido pelo host ou que saiu voluntariamente).
 *
 * Duas opções:
 *   - "counter"     → chama direto para um guichê (pula a fila)
 *   - "queue_front" → readmite no início da fila (respeitando prioridade)
 */
const RecallModal = ({ open, onClose, ticket, counters, onRecall }) => {
  const [mode, setMode] = useState("counter");
  const [counter, setCounter] = useState(counters?.[0]?.name || "");

  useEffect(() => {
    if (open) {
      setMode("counter");
      setCounter(counters?.[0]?.name || "");
    }
  }, [open, counters]);

  if (!ticket) return null;

  const handleConfirm = () => {
    onRecall(ticket.token, mode, mode === "counter" ? counter : undefined);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="420px">
      <h3 style={{ fontWeight: 700, marginBottom: "6px", fontSize: "17px", display: "flex", alignItems: "center", gap: "8px" }}>
        <RotateCcw size={17} color="var(--accent)" /> Chamar de Volta
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
        {ticket.name} · {ticket.category}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
        <button
          className="btn"
          onClick={() => setMode("counter")}
          style={{
            padding: "14px", textAlign: "left", display: "flex", alignItems: "flex-start", gap: "10px",
            border: `1px solid ${mode === "counter" ? "var(--accent)" : "var(--border)"}`,
            background: mode === "counter" ? "var(--accent-light)" : "var(--surface)",
          }}
        >
          <Volume2 size={16} color={mode === "counter" ? "var(--accent)" : "var(--text-muted)"} style={{ marginTop: "2px", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: mode === "counter" ? "var(--accent)" : "var(--text)", fontSize: "14px" }}>
              Chamar direto para o guichê
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Pula a fila — vai direto para "Em Atendimento"
            </div>
          </div>
        </button>

        <button
          className="btn"
          onClick={() => setMode("queue_front")}
          style={{
            padding: "14px", textAlign: "left", display: "flex", alignItems: "flex-start", gap: "10px",
            border: `1px solid ${mode === "queue_front" ? "var(--accent)" : "var(--border)"}`,
            background: mode === "queue_front" ? "var(--accent-light)" : "var(--surface)",
          }}
        >
          <CornerUpLeft size={16} color={mode === "queue_front" ? "var(--accent)" : "var(--text-muted)"} style={{ marginTop: "2px", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: mode === "queue_front" ? "var(--accent)" : "var(--text)", fontSize: "14px" }}>
              Voltar para o início da fila
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Respeita a prioridade original de "{ticket.category}"
            </div>
          </div>
        </button>
      </div>

      {mode === "counter" && (
        <div style={{ marginBottom: "20px" }}>
          <label className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>
            Guichê
          </label>
          <select className="input" value={counter} onChange={(e) => setCounter(e.target.value)}>
            {counters.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: "flex", gap: "10px" }}>
        <button className="btn" onClick={onClose} style={{ flex: 1, padding: "12px" }}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={handleConfirm} style={{ flex: 2, padding: "12px", fontWeight: 700 }}>
          Confirmar
        </button>
      </div>
    </Modal>
  );
};

export default RecallModal;
