import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, Document } from "../api";
import { useAuth } from "../AuthContext";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DocumentListPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.documents
      .list()
      .then(setDocs)
      .catch(() => setError("Failed to load documents"))
      .finally(() => setLoading(false));
  }, []);

  async function createDocument() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const doc = await api.documents.create(newTitle.trim());
      navigate(`/documents/${doc.id}`);
    } catch {
      setError("Failed to create document");
      setCreating(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    try {
      await api.documents.delete(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError("Failed to delete document");
    }
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <span style={s.brand}>Draftly</span>
        <div style={s.headerRight}>
          <span style={s.userName}>{user?.name}</span>
          <button style={s.logoutBtn} onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={s.main}>
        <div style={s.topRow}>
          <h2 style={s.heading}>My Documents</h2>
          <button style={s.primaryBtn} onClick={() => setShowForm(true)}>
            + New Document
          </button>
        </div>

        {error && <div style={s.errorBanner}>{error}</div>}

        {/* New document form */}
        {showForm && (
          <div style={s.newDocForm}>
            <input
              style={s.input}
              type="text"
              placeholder="Document title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createDocument()}
              autoFocus
            />
            <button style={s.primaryBtn} onClick={createDocument} disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              style={s.ghostBtn}
              onClick={() => {
                setShowForm(false);
                setNewTitle("");
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Document list */}
        {loading ? (
          <p style={s.muted}>Loading…</p>
        ) : docs.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyHeading}>No documents yet</p>
            <p style={s.muted}>Create your first document to get started.</p>
          </div>
        ) : (
          <div style={s.grid}>
            {docs.map((doc) => (
              <div key={doc.id} style={s.card}>
                <div style={s.cardBody}>
                  <h3 style={s.docTitle}>{doc.title}</h3>
                  <p style={s.docMeta}>Updated {formatDate(doc.updated_at)}</p>
                </div>
                <div style={s.cardActions}>
                  <button style={s.primaryBtn} onClick={() => navigate(`/documents/${doc.id}`)}>
                    Open
                  </button>
                  <button
                    style={s.outlineBtn}
                    onClick={() => navigate(`/documents/${doc.id}/report`)}
                  >
                    Report
                  </button>
                  <button style={s.dangerBtn} onClick={() => deleteDocument(doc.id)}>
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
  newDocForm: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1.5rem",
    alignItems: "center",
  },
  input: {
    flex: 1,
    padding: "0.6rem 0.75rem",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: "0.95rem",
    outline: "none",
  },
  grid: { display: "flex", flexDirection: "column", gap: "0.75rem" },
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
  docTitle: { margin: 0, fontSize: "1rem", fontWeight: 600, color: "#1e293b" },
  docMeta: { margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#94a3b8" },
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
