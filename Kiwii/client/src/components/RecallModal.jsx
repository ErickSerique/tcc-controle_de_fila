import { useState, useEffect } from "react";
import { RotateCcw, Volume2, CornerUpLeft } from "lucide-react";
import Modal from "./Modal";

/**
 * RecallModal
 *
 * Permite ao host escolher como quer chamar o paciente de volta:
 *   - "counter"     → chama direto para um guichê (pula a fila)
 *   - "queue_front" → readmite no início da fila (respeitando prioridade)
 */
const RecallModal = ({ open, onClose, ticket, counters, onRecall, myCounterName }) => {
  const [mode, setMode] = useState("counter");
  const [counter, setCounter] = useState(counters?.[0]?.name || "");

  useEffect(() => {
    if (open) {
      setMode("counter");
      setCounter(myCounterName || counters?.[0]?.name || "");
    }
  }, [open, counters, myCounterName]);

  if (!ticket) return null;

  const handleConfirm = () => {
    onRecall(ticket.token, mode, mode === "counter" ? (myCounterName || counter) : undefined);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="420px">
      <h3
        style={{
          fontWeight: 700,
          marginBottom: "6px",
          fontSize: "17px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "var(--text)",
        }}
      >
        <RotateCcw size={17} color="var(--primary)" /> Chamar de Volta
      </h3>
      <p style={{ color: "var(--text-secondary, var(--text-muted))", fontSize: "13px", marginBottom: "20px" }}>
        Como deseja chamar <strong style={{ color: "var(--text)" }}>{ticket.name}</strong> (#{ticket.code}) de volta?
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
        <button
          type="button"
          className="btn"
          onClick={() => setMode("counter")}
          style={{
            padding: "14px",
            textAlign: "left",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            border: `1px solid ${mode === "counter" ? "var(--primary)" : "var(--border)"}`,
            background: mode === "counter" ? "var(--primary-muted)" : "var(--surface)",
          }}
        >
          <Volume2
            size={16}
            color={mode === "counter" ? "var(--primary)" : "var(--text-secondary)"}
            style={{ marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <div
              style={{
                fontWeight: 700,
                color: mode === "counter" ? "var(--primary)" : "var(--text)",
                fontSize: "14px",
              }}
            >
              Chamar direto para o guichê
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
              O cliente recebe o alerta imediatamente para se dirigir ao atendimento.
            </div>
          </div>
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => setMode("queue_front")}
          style={{
            padding: "14px",
            textAlign: "left",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            border: `1px solid ${mode === "queue_front" ? "var(--primary)" : "var(--border)"}`,
            background: mode === "queue_front" ? "var(--primary-muted)" : "var(--surface)",
          }}
        >
          <CornerUpLeft
            size={16}
            color={mode === "queue_front" ? "var(--primary)" : "var(--text-secondary)"}
            style={{ marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <div
              style={{
                fontWeight: 700,
                color: mode === "queue_front" ? "var(--primary)" : "var(--text)",
                fontSize: "14px",
              }}
            >
              Voltar para o início da fila
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
              Retorna à fila ativa como o próximo a ser chamado dentro da sua categoria.
            </div>
          </div>
        </button>
      </div>

      {mode === "counter" && myCounterName && (
        <div style={{ marginBottom: "20px", fontSize: "13px", color: "var(--text-secondary)" }}>
          Será chamado no seu guichê:{" "}
          <strong style={{ color: "var(--text)" }}>{myCounterName}</strong>
        </div>
      )}

      {mode === "counter" && !myCounterName && (
        <div style={{ marginBottom: "20px" }}>
          <label
            className="mono"
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: "6px",
              textTransform: "uppercase",
            }}
          >
            Guichê
          </label>
          <select className="input" value={counter} onChange={(e) => setCounter(e.target.value)}>
            {counters.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "flex", gap: "10px" }}>
        <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1, padding: "12px" }}>
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          onClick={handleConfirm}
          style={{ flex: 2, padding: "12px", fontWeight: 700 }}
        >
          Confirmar
        </button>
      </div>
    </Modal>
  );
};

export default RecallModal;
