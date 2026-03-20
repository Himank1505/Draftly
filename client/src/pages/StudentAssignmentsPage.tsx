import { useState, useEffect, FormEvent as ReactFormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, Assignment, Submission, Document } from "../api";
import { useAuth } from "../AuthContext";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPast(iso: string | null) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

export default function StudentAssignmentsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    Promise.all([
      api.assignments.list(),
      api.submissions.mySubmissions(),
      api.documents.list(),
    ])
      .then(([a, s, d]) => {
        setAssignments(a);
        setSubmissions(s);
        setDocs(d);
      })
      .catch(() => setError("Failed to load assignments"))
      .finally(() => setLoading(false));
  }, []);

  async function handleJoin(e: ReactFormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError("");
    try {
      const assignment = await api.assignments.join(joinCode.trim());
      setJoinCode("");
      // Add to list if not already there
      setAssignments((prev) =>
        prev.find((a) => a.id === assignment.id) ? prev : [assignment, ...prev]
      );
    } catch (err: any) {
      setJoinError(err.message ?? "Invalid code");
    } finally {
      setJoining(false);
    }
  }

  async function startWriting(assignment: Assignment) {
    setStarting(assignment.id);
    try {
      // Check if a document for this assignment already exists
      const existing = docs.find((d) => d.assignment_id === assignment.id);
      if (existing) {
        navigate(`/documents/${existing.id}`);
        return;
      }
      // Create a new document linked to this assignment
      const doc = await api.documents.create(assignment.title, assignment.id);
      navigate(`/documents/${doc.id}`);
    } catch {
      setError("Failed to open editor. Please try again.");
      setStarting(null);
    }
  }

  function getSubmission(assignmentId: string) {
    return submissions.find((s) => s.assignment_id === assignmentId) ?? null;
  }

  function getDoc(assignmentId: string) {
    return docs.find((d) => d.assignment_id === assignmentId) ?? null;
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.brand}>Draftly</span>
        <div style={s.headerRight}>
          <button style={s.linkBtn} onClick={() => navigate("/documents")}>
            My Documents
          </button>
          <span style={s.userName}>{user?.name}</span>
          <button style={s.logoutBtn} onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main style={s.main}>
        <h2 style={s.heading}>Assignments</h2>

        {/* Join with code */}
        <form onSubmit={handleJoin} style={s.joinForm}>
          <input
            style={s.joinInput}
            placeholder="Enter join code (e.g. ABC123)"
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(""); }}
            maxLength={6}
            spellCheck={false}
          />
          <button style={s.joinBtn} type="submit" disabled={joining || !joinCode.trim()}>
            {joining ? "Joining…" : "Join Assignment"}
          </button>
        </form>
        {joinError && <div style={s.joinError}>{joinError}</div>}

        {error && <div style={s.errorBanner}>{error}</div>}

        {loading ? (
          <p style={s.muted}>Loading…</p>
        ) : assignments.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyHeading}>No assignments yet</p>
            <p style={s.muted}>Your teacher hasn't posted any assignments.</p>
          </div>
        ) : (
          <div style={s.list}>
            {assignments.map((a) => {
              const submission = getSubmission(a.id);
              const doc = getDoc(a.id);
              const overdue = !submission && isPast(a.deadline);

              return (
                <div key={a.id} style={s.card}>
                  <div style={s.cardBody}>
                    <div style={s.titleRow}>
                      <h3 style={s.assignTitle}>{a.title}</h3>
                      {submission && (
                        <span style={s.submittedBadge}>Submitted</span>
                      )}
                      {overdue && (
                        <span style={s.overdueBadge}>Overdue</span>
                      )}
                    </div>
                    {a.description && <p style={s.assignDesc}>{a.description}</p>}
                    <p style={s.assignMeta}>
                      {a.deadline ? (
                        <>Due: <strong>{formatDate(a.deadline)}</strong></>
                      ) : (
                        <>Posted {formatDate(a.created_at)}</>
                      )}
                      {submission && (
                        <> &nbsp;·&nbsp; Submitted {formatDate(submission.submitted_at)}</>
                      )}
                    </p>
                  </div>

                  <div style={s.cardActions}>
                    {submission ? (
                      <button
                        style={s.outlineBtn}
                        onClick={() => navigate(`/documents/${submission.document_id}`)}
                      >
                        View
                      </button>
                    ) : doc ? (
                      <button
                        style={s.primaryBtn}
                        onClick={() => navigate(`/documents/${doc.id}`)}
                        disabled={starting === a.id}
                      >
                        Continue Writing
                      </button>
                    ) : (
                      <button
                        style={s.primaryBtn}
                        onClick={() => startWriting(a)}
                        disabled={starting === a.id}
                      >
                        {starting === a.id ? "Opening…" : "Start Writing"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

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
  linkBtn: {
    background: "none",
    border: "none",
    color: "#3b82f6",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
    padding: 0,
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
  heading: { margin: "0 0 1rem", fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" },
  joinForm: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.4rem",
  },
  joinInput: {
    padding: "0.6rem 0.75rem",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: "0.95rem",
    outline: "none",
    width: 180,
    letterSpacing: "0.08em",
    fontFamily: "monospace",
    textTransform: "uppercase" as const,
  },
  joinBtn: {
    padding: "0.6rem 1rem",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  joinError: {
    color: "#b91c1c",
    fontSize: "0.8rem",
    marginBottom: "0.75rem",
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "0.6rem 0.75rem",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
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
  titleRow: { display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" as const },
  assignTitle: { margin: 0, fontSize: "1rem", fontWeight: 600, color: "#1e293b" },
  assignDesc: { margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#64748b" },
  assignMeta: { margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#94a3b8" },
  submittedBadge: {
    fontSize: "0.72rem",
    fontWeight: 700,
    color: "#15803d",
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    borderRadius: 4,
    padding: "0.15rem 0.45rem",
  },
  overdueBadge: {
    fontSize: "0.72rem",
    fontWeight: 700,
    color: "#b91c1c",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: 4,
    padding: "0.15rem 0.45rem",
  },
  cardActions: { flexShrink: 0 },
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
  outlineBtn: {
    padding: "0.5rem 1rem",
    background: "#fff",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: "0.85rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  emptyState: { textAlign: "center", padding: "4rem 0" },
  emptyHeading: { fontSize: "1.1rem", fontWeight: 600, color: "#334155", margin: "0 0 0.5rem" },
  muted: { color: "#94a3b8", margin: 0 },
};
