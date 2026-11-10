import { AlertTriangle, HelpCircle } from "lucide-react";
import Modal from "./Modal";

/**
 * ConfirmModal — modal de confirmação genérico para ações destrutivas
 * (sair da fila, remover ticket, excluir organização, encerrar dia, etc.).
 */
const ConfirmModal = ({
  open,
  onClose,
  onCancel,
  onConfirm,
  title = "Confirmar ação",
  message = "Tem certeza que deseja continuar?",
  confirmText = "Confirmar",
  danger = false,
}) => {
  const handleClose = () => {
    if (onCancel) onCancel();
    if (onClose) onClose();
  };

  const handleConfirm = () => {
    onConfirm?.();
    handleClose();
  };

  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <Modal open={open} onClose={handleClose} maxWidth="400px">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            flexShrink: 0,
            background: danger ? "var(--danger-muted, rgba(239, 68, 68, 0.15))" : "var(--primary-muted, rgba(45, 212, 168, 0.15))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={danger ? "var(--danger)" : "var(--primary)"} />
        </div>
        <h3 style={{ fontWeight: 700, fontSize: "17px", paddingTop: "6px", color: "var(--text)" }}>
          {title}
        </h3>
      </div>
      <p style={{ color: "var(--text-secondary, var(--text-muted))", fontSize: "13px", lineHeight: 1.6, marginBottom: "22px" }}>
        {message}
      </p>
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button
          className="btn btn-secondary"
          onClick={handleClose}
          style={{ flex: 1, padding: "10px 16px", fontSize: "13px" }}
        >
          Cancelar
        </button>
        <button
          className={danger ? "btn btn-danger" : "btn btn-primary"}
          onClick={handleConfirm}
          style={{ flex: 1, padding: "10px 16px", fontWeight: 700, fontSize: "13px" }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
