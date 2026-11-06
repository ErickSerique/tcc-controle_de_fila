import Modal from "./Modal";
import { AlertTriangle, HelpCircle } from "lucide-react";

/**
 * ConfirmModal — modal de confirmação para substituir window.confirm().
 * Exibe título, mensagem e botões com visual refinado e ícones SVG.
 */
const ConfirmModal = ({
  open,
  onClose,
  onConfirm,
  title = "Confirmar ação",
  message = "Tem certeza?",
  confirmText = "Confirmar",
  danger = false,
}) => {
  const handleConfirm = () => {
    onConfirm?.();
    onClose?.();
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="420px">
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "8px",
            background: danger ? "var(--danger-muted)" : "var(--primary-muted)",
            border: `1px solid ${danger ? "var(--danger-border)" : "var(--primary-border)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: danger ? "var(--danger)" : "var(--primary)",
            flexShrink: 0,
          }}
        >
          {danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
        </div>
        <h3 style={{ fontWeight: 700, fontSize: "17px", margin: 0, color: "var(--text)" }}>
          {title}
        </h3>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "24px" }}>
        {message}
      </p>
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ padding: "10px 18px", fontSize: "13px" }}
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          className={danger ? "btn btn-danger" : "btn btn-primary"}
          style={{ padding: "10px 18px", fontSize: "13px" }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
