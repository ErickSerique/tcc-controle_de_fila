import { AlertTriangle, HelpCircle } from "lucide-react";
import Modal from "./Modal";

/**
 * ConfirmModal — modal de confirmação genérico para ações destrutivas
 * (sair da fila, remover ticket, excluir organização, etc.).
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

  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <Modal open={open} onClose={onClose} maxWidth="380px">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "10px", flexShrink: 0,
          background: danger ? "var(--danger-glow)" : "var(--accent-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={18} color={danger ? "var(--danger)" : "var(--accent)"} />
        </div>
        <h3 style={{ fontWeight: 700, fontSize: "17px", paddingTop: "6px" }}>{title}</h3>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.6, marginBottom: "22px" }}>
        {message}
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button className="btn" onClick={onClose} style={{ flex: 1, padding: "12px" }}>
          Cancelar
        </button>
        <button
          className={danger ? "btn" : "btn btn-primary"}
          onClick={handleConfirm}
          style={{
            flex: 1, padding: "12px", fontWeight: 700,
            ...(danger && { background: "var(--danger-glow)", color: "var(--danger)", borderColor: "var(--danger-glow)" }),
          }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
