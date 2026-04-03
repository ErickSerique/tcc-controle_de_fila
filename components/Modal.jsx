import { useEffect } from "react";

/**
 * Modal — accessible overlay with keyboard support.
 * Closes on Escape key or backdrop click.
 */
const Modal = ({ open, onClose, children, maxWidth = "480px" }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "24px",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="card animate-fade"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          padding: "32px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
