import Modal from "./Modal";

/**
 * ConfirmModal — modal de confirmação genérico para ações destrutivas
 * (sair da fila, remover ticket, etc.), substitui window.confirm().
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
    <Modal open={open} onClose={onClose} maxWidth="380px">
      <h3 style={{ fontWeight: 700, marginBottom: "12px", fontSize: "17px" }}>
        {danger ? "⚠️" : "❓"} {title}
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.6, marginBottom: "22px" }}>
        {message}
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          className="btn"
          onClick={onClose}
          style={{
            flex: 1, padding: "12px",
            background: "var(--surface)", color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          Cancelar
        </button>
        <button
          className="btn"
          onClick={handleConfirm}
          style={{
            flex: 1, padding: "12px",
            background: danger ? "#7f1d1d44" : "linear-gradient(135deg, var(--accent), #34d399)",
            color: danger ? "var(--danger)" : "#022c22",
            border: danger ? "1px solid rgba(248,113,113,0.35)" : "none",
            fontWeight: 700,
          }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
