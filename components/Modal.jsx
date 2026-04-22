import { useEffect, useRef } from "react";

/**
 * Modal — accessible overlay with keyboard support.
 * Closes on Escape key or backdrop click.
 */
const Modal = ({ open, onClose, children, maxWidth = "480px", titleId = "modal-title" }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    
    // Focus the modal when opened for accessibility
    if (modalRef.current) {
      modalRef.current.focus();
    }

    const handler = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "var(--space-xl)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        ref={modalRef}
        tabIndex="-1"
        className="card animate-fade"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          padding: "var(--space-2xl)",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <button 
          onClick={onClose}
          className="btn btn-ghost btn-icon"
          aria-label="Fechar modal"
          style={{
            position: "absolute",
            top: "var(--space-md)",
            right: "var(--space-md)",
            padding: "var(--space-xs)",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
};

export default Modal;
