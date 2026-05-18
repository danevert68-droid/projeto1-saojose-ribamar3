import { useEffect } from "react";

/**
 * ConfirmModal — substitui o window.confirm feio do browser.
 * Uso: <ConfirmModal open title="..." message="..." onConfirm={fn} onCancel={fn} />
 */
export default function ConfirmModal({
  open,
  title = "Confirmar ação",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "primary", // 'primary' | 'danger'
  onConfirm,
  onCancel,
}) {
  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = variant === "danger";
  const accent = isDanger ? "#ef4444" : "#4338ca";
  const accentBg = isDanger ? "rgba(239,68,68,0.12)" : "rgba(67,56,202,0.12)";

  return (
    <div
      data-testid="confirm-modal"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: '"Poppins", system-ui, sans-serif',
        animation: "cmFade 0.18s ease-out",
      }}
    >
      <style>{`
        @keyframes cmFade { from{opacity:0} to{opacity:1} }
        @keyframes cmPop { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 16,
          padding: "32px 28px 24px",
          boxShadow: "0 30px 80px rgba(15, 23, 42, 0.35)",
          textAlign: "center",
          animation: "cmPop 0.22s cubic-bezier(.16,1,.32,1)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 18px",
            borderRadius: "50%",
            background: accentBg,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
          }}
        >
          {isDanger ? "↪" : "?"}
        </div>
        <h3 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 700, color: "#1e1e2f" }}>
          {title}
        </h3>
        <p style={{ margin: "0 0 26px", fontSize: 14.5, lineHeight: 1.55, color: "#6b7280" }}>
          {message}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            data-testid="confirm-cancel-btn"
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              background: "#fff",
              color: "#475569",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            data-testid="confirm-ok-btn"
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "none",
              background: isDanger
                ? "linear-gradient(135deg, #dc2626, #ef4444)"
                : "linear-gradient(135deg, #4338ca, #6366f1)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: isDanger
                ? "0 8px 20px rgba(239,68,68,0.35)"
                : "0 8px 20px rgba(99,102,241,0.32)",
              transition: "transform 0.12s, filter 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.filter = ""; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
