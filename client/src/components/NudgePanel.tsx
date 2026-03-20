import type React from "react";

interface Props {
  nudges: string[];
  onDismiss: () => void;
}

export default function NudgePanel({ nudges, onDismiss }: Props) {
  return (
    <div style={s.overlay}>
      <div style={s.panel}>
        <div style={s.header}>
          <span style={s.icon}>✏️</span>
          <span style={s.title}>Still thinking?</span>
          <button style={s.close} onClick={onDismiss} aria-label="Dismiss">✕</button>
        </div>
        <ul style={s.list}>
          {nudges.map((q, i) => (
            <li key={i} style={s.item}>{q}</li>
          ))}
        </ul>
        <button style={s.gotIt} onClick={onDismiss}>Got it</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    bottom: "1.5rem",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 50,
    animation: "nudge-slide-up 0.25s ease",
  },
  panel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    padding: "1rem 1.25rem",
    width: 360,
    maxWidth: "calc(100vw - 2rem)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.75rem",
  },
  icon: { fontSize: "1rem" },
  title: {
    flex: 1,
    fontWeight: 600,
    fontSize: "0.9rem",
    color: "#1e293b",
  },
  close: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: "0.85rem",
    padding: "0.1rem 0.25rem",
    lineHeight: 1,
  },
  list: {
    margin: 0,
    padding: "0 0 0 1.1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.45rem",
  },
  item: {
    fontSize: "0.85rem",
    color: "#475569",
    lineHeight: 1.4,
  },
  gotIt: {
    marginTop: "0.9rem",
    width: "100%",
    padding: "0.4rem",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "#475569",
    cursor: "pointer",
  },
};
