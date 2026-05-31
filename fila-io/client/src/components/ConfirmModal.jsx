import Modal from "./Modal";

/**
 * ConfirmModal — modal de confirmação para substituir window.confirm().
 * Exibe título, mensagem e botões de confirmar/cancelar com estilo visual.
 *
 * @param {boolean} open       - Se o modal está visível
 * @param {function} onClose   - Callback ao cancelar
 * @param {function} onConfirm - Callback ao confirmar
 * @param {string} title       - Título do modal
 * @param {string} message     - Corpo da mensagem
 * @param {string} confirmText - Texto do botão de confirmar (default: "Confirmar")
 * @param {boolean} danger     - Se o botão de confirmar deve ser vermelho (ações destrutivas)
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
      <h3 style={{ fontWeight: 700, marginBottom: "12px", fontSize: "18px" }}>
        {danger ? "⚠️" : "❓"} {title}
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: 1.6, marginBottom: "24px" }}>
        {message}
      </p>
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          style={{
            padding: "10px 20px", borderRadius: "8px",
            background: "var(--surface-hover)", border: "1px solid var(--border)",
            color: "var(--text-muted)", cursor: "pointer",
            fontSize: "14px", fontWeight: 600, fontFamily: "inherit",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          style={{
            padding: "10px 20px", borderRadius: "8px",
            background: danger
              ? "linear-gradient(135deg, #ef4444, #f87171)"
              : "linear-gradient(135deg, var(--accent), #818cf8)",
            border: "none", color: "#fff", cursor: "pointer",
            fontSize: "14px", fontWeight: 700, fontFamily: "inherit",
            boxShadow: danger
              ? "0 4px 12px rgba(239,68,68,0.3)"
              : "0 4px 12px rgba(99,102,241,0.3)",
          }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
