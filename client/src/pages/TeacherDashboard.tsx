import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, Assignment } from "../api";
import { useAuth } from "../AuthContext";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    api.assignments
      .list()
      .then(setAssignments)
      .catch(() => setError("Failed to load assignments"))
      .finally(() => setLoading(false));
  }, []);

  async function createAssignment(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setFormError("");
    setCreating(true);
    try {
      const deadlineISO = deadlineDate
        ? new Date(`${deadlineDate}T${deadlineTime || "23:59"}`).toISOString()
        : undefined;
      const a = await api.assignments.create({
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadlineISO,
      });
      setAssignments((prev) => [a, ...prev]);
      setTitle("");
      setDescription("");
      setDeadlineDate("");
      setDeadlineTime("23:59");
      setShowForm(false);
    } catch (err: any) {
      setFormError(err.message ?? "Failed to create assignment");
    } finally {
      setCreating(false);
    }
  }

  async function deleteAssignment(id: string) {
    if (!confirm("Delete this assignment? This cannot be undone.")) return;
    try {
      await api.assignments.delete(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError("Failed to delete assignment");
    }
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.brand}>Draftly</span>
        <div style={s.headerRight}>
          <span style={s.role}>Teacher Dashboard</span>
          <span style={s.userName}>{user?.name}</span>
          <button style={s.logoutBtn} onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.topRow}>
          <h2 style={s.heading}>My Assignments</h2>
          <button style={s.primaryBtn} onClick={() => { setShowForm(true); setFormError(""); }}>
            + New Assignment
          </button>
        </div>

        {error && <div style={s.errorBanner}>{error}</div>}

        {/* Create form */}
        {showForm && (
          <form onSubmit={createAssignment} style={s.form}>
            {formError && <div style={s.formErrorBanner}>{formError}</div>}
            <input
              style={s.input}
              placeholder="Assignment title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
            <textarea
              style={s.textarea}
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <div style={s.formRow}>
              <div style={s.fieldGroup}>
                <label style={s.label}>Deadline date (optional)</label>
                <input
                  style={s.input}
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Time</label>
                <input
                  style={s.input}
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  disabled={!deadlineDate}
                />
              </div>
            </div>
            <div style={s.formActions}>
              <button style={s.primaryBtn} type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create Assignment"}
              </button>
              <button
                style={s.ghostBtn}
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setTitle("");
                  setDescription("");
                  setDeadlineDate("");
                  setDeadlineTime("23:59");
                  setFormError("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Assignment list */}
        {loading ? (
          <p style={s.muted}>Loading…</p>
        ) : assignments.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyHeading}>No assignments yet</p>
            <p style={s.muted}>Create your first assignment to get started.</p>
          </div>
        ) : (
          <div style={s.list}>
            {assignments.map((a) => (
              <div key={a.id} style={s.card}>
                <div style={s.cardBody}>
                  <div style={s.titleRow}>
                    <h3 style={s.assignTitle}>{a.title}</h3>
                    <CodeBadge code={a.code} />
                  </div>
                  {a.description && <p style={s.assignDesc}>{a.description}</p>}
                  <p style={s.assignMeta}>
                    Created {formatDate(a.created_at)}
                    {a.deadline && (
                      <> &nbsp;·&nbsp; Due <strong>{formatDate(a.deadline)}</strong></>
                    )}
                    {a.submission_count !== undefined && (
                      <> &nbsp;·&nbsp; {a.submission_count} submission{Number(a.submission_count) !== 1 ? "s" : ""}</>
                    )}
                  </p>
                </div>
                <div style={s.cardActions}>
                  <button
                    style={s.primaryBtn}
                    onClick={() => navigate(`/teacher/assignments/${a.id}`)}
                  >
                    View Submissions
                  </button>
                  <button style={s.dangerBtn} onClick={() => deleteAssignment(a.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy} style={cb.badge} title="Click to copy join code">
      <span style={cb.label}>Code:</span>
      <span style={cb.code}>{code}</span>
      <span style={cb.action}>{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}

const cb: Record<string, React.CSSProperties> = {
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.3rem",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 6,
    padding: "0.2rem 0.6rem",
    cursor: "pointer",
    fontSize: "0.78rem",
    fontFamily: "monospace",
  },
  label: { color: "#64748b", fontFamily: "inherit" },
  code: { fontWeight: 700, color: "#1d4ed8", letterSpacing: "0.08em" },
  action: { color: "#3b82f6", marginLeft: "0.25rem", fontFamily: "sans-serif", fontWeight: 600 },
};

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f1f5f9" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 1.5rem",
    height: 56,
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  brand: { fontWeight: 700, fontSize: "1rem", color: "#3b82f6" },
  headerRight: { display: "flex", alignItems: "center", gap: "1rem" },
  role: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#7c3aed",
    background: "#ede9fe",
    borderRadius: 4,
    padding: "0.2rem 0.5rem",
  },
  userName: { fontSize: "0.875rem", color: "#475569" },
  logoutBtn: {
    background: "none",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    padding: "0.35rem 0.75rem",
    fontSize: "0.85rem",
    color: "#475569",
    cursor: "pointer",
  },
  main: { maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" },
  heading: { margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "0.6rem 0.75rem",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
  form: {
    background: "#fff",
    borderRadius: 10,
    padding: "1.5rem",
    boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
    marginBottom: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  formErrorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "0.6rem 0.75rem",
    fontSize: "0.875rem",
  },
  input: {
    padding: "0.6rem 0.75rem",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: "0.95rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  textarea: {
    padding: "0.6rem 0.75rem",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: "0.95rem",
    outline: "none",
    width: "100%",
    resize: "vertical" as const,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  formRow: { display: "flex", gap: "1rem" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 },
  label: { fontSize: "0.8rem", fontWeight: 600, color: "#374151" },
  formActions: { display: "flex", gap: "0.5rem" },
  list: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  card: {
    background: "#fff",
    borderRadius: 10,
    padding: "1.25rem 1.5rem",
    boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  cardBody: { flex: 1 },
  titleRow: { display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" as const, marginBottom: "0.1rem" },
  assignTitle: { margin: 0, fontSize: "1rem", fontWeight: 600, color: "#1e293b" },
  assignDesc: { margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#64748b" },
  assignMeta: { margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#94a3b8" },
  cardActions: { display: "flex", gap: "0.5rem", flexShrink: 0 },
  primaryBtn: {
    padding: "0.5rem 1rem",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  ghostBtn: {
    padding: "0.5rem 1rem",
    background: "none",
    color: "#64748b",
    border: "none",
    borderRadius: 6,
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "0.5rem 1rem",
    background: "#fff",
    color: "#ef4444",
    border: "1px solid #fecaca",
    borderRadius: 6,
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  emptyState: { textAlign: "center", padding: "4rem 0" },
  emptyHeading: { fontSize: "1.1rem", fontWeight: 600, color: "#334155", margin: "0 0 0.5rem" },
  muted: { color: "#94a3b8", margin: 0 },
};
