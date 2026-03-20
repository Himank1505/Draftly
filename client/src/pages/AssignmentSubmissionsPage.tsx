import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, Assignment, SubmissionWithDetails } from "../api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const confidenceColor: Record<string, React.CSSProperties> = {
  HIGH:   { background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" },
  MEDIUM: { background: "#fef9c3", color: "#854d0e", border: "1px solid #fef08a" },
  LOW:    { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" },
};

export default function AssignmentSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([api.assignments.get(id), api.assignments.getSubmissions(id)])
      .then(([a, subs]) => {
        setAssignment(a);
        setSubmissions(subs);
      })
      .catch(() => setError("Failed to load submissions"))
      .finally(() => setLoading(false));
  }, [id]);

  function viewReport(sub: SubmissionWithDetails) {
    const params = new URLSearchParams({
      authorName:  sub.student_name,
      authorEmail: sub.student_email,
      back:        `/teacher/assignments/${id}`,
    });
    navigate(`/documents/${sub.document_id}/report?${params.toString()}`);
  }

  function viewAssignment(sub: SubmissionWithDetails) {
    navigate(`/documents/${sub.document_id}`);
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => navigate("/teacher")}>
          ← Dashboard
        </button>
        <span style={s.headerTitle}>
          {assignment ? assignment.title : "Loading…"}
        </span>
        <span style={s.submissionCount}>
          {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
        </span>
      </header>

      <main style={s.main}>
        {assignment?.description && (
          <p style={s.description}>{assignment.description}</p>
        )}
        {assignment?.deadline && (
          <p style={s.deadline}>Due: {formatDate(assignment.deadline)}</p>
        )}

        {error && <div style={s.errorBanner}>{error}</div>}

        {loading ? (
          <p style={s.muted}>Loading…</p>
        ) : submissions.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyHeading}>No submissions yet</p>
            <p style={s.muted}>Students haven't submitted this assignment.</p>
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Student</th>
                <th style={s.th}>Submitted</th>
                <th style={s.th}>Authorship</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
                <tr key={sub.id}>
                  <td style={s.td}>
                    <div style={s.studentName}>{sub.student_name}</div>
                    <div style={s.studentEmail}>{sub.student_email}</div>
                  </td>
                  <td style={s.td}>{formatDate(sub.submitted_at)}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...confidenceColor[sub.confidence] }}>
                      {sub.confidence}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={s.actionBtns}>
                      <button style={s.reportBtn} onClick={() => viewAssignment(sub)}>
                        View Assignment
                      </button>
                      <button style={s.reportBtn} onClick={() => viewReport(sub)}>
                        View Report
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    gap: "1rem",
    padding: "0 1.5rem",
    height: 56,
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#3b82f6",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 600,
    padding: "0.35rem 0",
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    fontWeight: 700,
    fontSize: "1rem",
    color: "#1e293b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  submissionCount: {
    fontSize: "0.8rem",
    color: "#94a3b8",
    flexShrink: 0,
  },
  main: { maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" },
  description: { color: "#475569", marginBottom: "0.5rem", fontSize: "0.95rem" },
  deadline: {
    color: "#64748b",
    fontSize: "0.85rem",
    marginBottom: "1.5rem",
    fontWeight: 500,
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
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
  },
  th: {
    textAlign: "left",
    padding: "0.75rem 1rem",
    background: "#f8fafc",
    color: "#64748b",
    fontWeight: 600,
    fontSize: "0.8rem",
    borderBottom: "1px solid #e2e8f0",
  },
  td: {
    padding: "0.85rem 1rem",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },
  studentName: { fontWeight: 600, color: "#1e293b", fontSize: "0.9rem" },
  studentEmail: { color: "#94a3b8", fontSize: "0.78rem", marginTop: "0.1rem" },
  badge: {
    display: "inline-block",
    padding: "0.25rem 0.6rem",
    borderRadius: 4,
    fontSize: "0.78rem",
    fontWeight: 700,
    letterSpacing: "0.03em",
  },
  actionBtns: { display: "flex", gap: "0.5rem" },
  reportBtn: {
    padding: "0.4rem 0.85rem",
    background: "#fff",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: "0.8rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  emptyState: { textAlign: "center", padding: "4rem 0" },
  emptyHeading: { fontSize: "1.1rem", fontWeight: 600, color: "#334155", margin: "0 0 0.5rem" },
  muted: { color: "#94a3b8", margin: 0 },
};
