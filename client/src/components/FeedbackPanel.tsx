import { FeedbackItem } from "../api";

interface FeedbackPanelProps {
  feedback: FeedbackItem[];
  loading: boolean;
  error: string;
  onClose: () => void;
}

const typeLabel: Record<FeedbackItem["type"], string> = {
  clarity:  "Clarity",
  grammar:  "Grammar",
  argument: "Argument",
};

const typeStyle: Record<FeedbackItem["type"], React.CSSProperties> = {
  clarity:  { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
  grammar:  { background: "#fef9c3", color: "#854d0e", border: "1px solid #fef08a" },
  argument: { background: "#fdf4ff", color: "#7e22ce", border: "1px solid #e9d5ff" },
};

export default function FeedbackPanel({ feedback, loading, error, onClose }: FeedbackPanelProps) {
  const grouped = (["clarity", "grammar", "argument"] as FeedbackItem["type"][]).map((type) => ({
    type,
    items: feedback.filter((f) => f.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>Writing Feedback</span>
        <button style={s.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={s.body}>
        {loading && (
          <div style={s.state}>
            <div style={s.spinner} />
            <p style={s.stateText}>Analyzing your writing…</p>
          </div>
        )}

        {!loading && error && (
          <div style={s.errorBox}>{error}</div>
        )}

        {!loading && !error && feedback.length === 0 && (
          <div style={s.state}>
            <p style={s.stateText}>No issues found — your writing looks good!</p>
          </div>
        )}

        {!loading && !error && grouped.map(({ type, items }) => (
          <div key={type} style={s.group}>
            <div style={s.groupLabel}>
              <span style={{ ...s.badge, ...typeStyle[type] }}>{typeLabel[type]}</span>
            </div>
            {items.map((item, i) => (
              <div key={i} style={s.item}>
                <p style={s.location}>"{item.location}"</p>
                <p style={s.note}>{item.note}</p>
              </div>
            ))}
          </div>
        ))}

        {!loading && feedback.length > 0 && (
          <p style={s.disclaimer}>
            Feedback identifies issues only. Fix them in your own words.
          </p>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    width: 320,
    flexShrink: 0,
    background: "#fff",
    borderLeft: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    position: "sticky",
    top: 56,
    maxHeight: "calc(100vh - 56px)",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 1,
  },
  title: { fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#94a3b8",
    fontSize: "1rem",
    padding: "0.2rem",
    lineHeight: 1,
  },
  body: { padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" },
  state: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "2rem 0" },
  stateText: { color: "#64748b", fontSize: "0.875rem", textAlign: "center", margin: 0 },
  spinner: {
    width: 24,
    height: 24,
    border: "2px solid #e2e8f0",
    borderTop: "2px solid #3b82f6",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "0.75rem",
    fontSize: "0.875rem",
  },
  group: { display: "flex", flexDirection: "column", gap: "0.6rem" },
  groupLabel: { display: "flex", alignItems: "center" },
  badge: {
    display: "inline-block",
    padding: "0.2rem 0.6rem",
    borderRadius: 4,
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.03em",
  },
  item: {
    background: "#f8fafc",
    borderRadius: 6,
    padding: "0.65rem 0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
  },
  location: {
    margin: 0,
    fontSize: "0.8rem",
    color: "#475569",
    fontStyle: "italic",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  note: { margin: 0, fontSize: "0.85rem", color: "#1e293b", lineHeight: 1.5 },
  disclaimer: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#94a3b8",
    textAlign: "center",
    borderTop: "1px solid #f1f5f9",
    paddingTop: "1rem",
  },
};
