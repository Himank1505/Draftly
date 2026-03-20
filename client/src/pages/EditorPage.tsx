import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, KeystrokeEvent, Document, FeedbackItem } from "../api";
import { useAuth } from "../AuthContext";
import Editor from "../Editor";
import FeedbackPanel from "../components/FeedbackPanel";
import NudgePanel from "../components/NudgePanel";

type SubmitStatus = "idle" | "submitting" | "submitted";

const AUTOSAVE_INTERVAL = 10_000;
const ACTIVITY_TIMEOUT = 3_000;
const NUDGE_IDLE_SECONDS = 60; // 1 minute

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

type SaveStatus = "saved" | "unsaved" | "saving";

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isInstructor = user?.role === "instructor";

  const [doc, setDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [loadError, setLoadError] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [nudges, setNudges] = useState<string[]>([]);
  const [showNudge, setShowNudge] = useState(false);

  // Refs for session management — don't trigger re-renders
  const sessionIdRef = useRef<string | null>(null);
  const contentRef = useRef<string>("");
  const prevTextRef = useRef<string>("");
  const lastSavedTextRef = useRef<string>("");
  const titleRef = useRef<string>("");
  const activeSecsRef = useRef<number>(0);
  const idleSecsRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(0);
  const pendingEventsRef = useRef<KeystrokeEvent[]>([]);
  const docIdRef = useRef<string | undefined>(id);
  const isMountedRef = useRef<boolean>(true);
  const consecutiveIdleSecsRef = useRef<number>(0);
  const nudgeShownRef = useRef<boolean>(false);
  const showNudgeRef = useRef<boolean>(false);

  // Load document + start session
  useEffect(() => {
    if (!id) return;
    isMountedRef.current = true;
    async function init() {
      try {
        const d = await api.documents.get(id!);
        if (!isMountedRef.current) return;
        setDoc(d);
        setTitle(d.title);
        titleRef.current = d.title;
        const html = d.final_text ?? "";
        const text = stripHtml(html);
        prevTextRef.current = text;
        lastSavedTextRef.current = text;
        contentRef.current = html;

        if (!isInstructor) {
          const session = await api.sessions.start(d.id);
          if (isMountedRef.current) sessionIdRef.current = session.id;
        }
      } catch {
        if (isMountedRef.current) setLoadError("Failed to load document.");
      }
    }
    init();
  }, [id]);

  async function fetchNudge() {
    if (!id || nudgeShownRef.current) return;
    nudgeShownRef.current = true;
    try {
      const result = await api.ai.nudge(id);
      if (result.nudges.length > 0 && isMountedRef.current) {
        setNudges(result.nudges);
        setShowNudge(true);
        showNudgeRef.current = true;
      }
    } catch {
      // nudges are non-critical — fail silently
    }
  }

  // Activity tracker: every second, classify as active or idle
  useEffect(() => {
    const interval = setInterval(() => {
      if (!sessionIdRef.current) return;
      const now = Date.now();
      if (lastActivityRef.current && now - lastActivityRef.current < ACTIVITY_TIMEOUT) {
        activeSecsRef.current += 1;
        consecutiveIdleSecsRef.current = 0;
      } else {
        if (lastActivityRef.current) idleSecsRef.current += 1;
        consecutiveIdleSecsRef.current += 1;
        if (consecutiveIdleSecsRef.current === NUDGE_IDLE_SECONDS && !nudgeShownRef.current) {
          fetchNudge();
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save: every 10 seconds flush everything
  useEffect(() => {
    const interval = setInterval(flushAll, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount: end session + final save
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function flushAll() {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    const text = stripHtml(contentRef.current);

    // Save snapshot + update document if content changed
    if (text !== lastSavedTextRef.current) {
      try {
        if (isMountedRef.current) setSaveStatus("saving");
        await Promise.all([
          api.snapshots.save({ session_id: sessionId, content: text, word_count: countWords(text) }),
          api.documents.update(docIdRef.current!, { title: titleRef.current, final_text: text }),
        ]);
        lastSavedTextRef.current = text;
        if (isMountedRef.current) setSaveStatus("saved");
      } catch {
        // silently ignore auto-save failures
      }
    }

    // Flush pending events
    if (pendingEventsRef.current.length > 0) {
      const events = [...pendingEventsRef.current];
      pendingEventsRef.current = [];
      api.events.ingest(sessionId, events).catch(() => {
        // put them back on failure
        pendingEventsRef.current = [...events, ...pendingEventsRef.current];
      });
    }
  }

  function endSession() {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    const text = stripHtml(contentRef.current);

    if (text !== lastSavedTextRef.current && text.trim()) {
      api.snapshots
        .save({ session_id: sessionId, content: text, word_count: countWords(text) })
        .catch(() => {});
      api.documents
        .update(docIdRef.current!, { title: titleRef.current, final_text: text })
        .catch(() => {});
    }

    if (pendingEventsRef.current.length > 0) {
      api.events.ingest(sessionId, pendingEventsRef.current).catch(() => {});
      pendingEventsRef.current = [];
    }

    api.sessions
      .update(sessionId, {
        active_time_seconds: activeSecsRef.current,
        idle_time_seconds: idleSecsRef.current,
        end: true,
      })
      .catch(() => {});
  }

  function handleChange(html: string) {
    const newText = stripHtml(html);
    const prevText = prevTextRef.current;

    if (newText !== prevText) {
      const delta = newText.length - prevText.length;
      lastActivityRef.current = Date.now();
      consecutiveIdleSecsRef.current = 0;
      nudgeShownRef.current = false;
      if (showNudgeRef.current) {
        setShowNudge(false);
        showNudgeRef.current = false;
      }

      pendingEventsRef.current.push({
        timestamp: new Date().toISOString(),
        event_type: delta >= 0 ? "insert" : "delete",
        char_count_delta: Math.abs(delta),
        cursor_position: 0,
      });

      prevTextRef.current = newText;
      setSaveStatus("unsaved");
    }

    contentRef.current = html;
  }

  async function handleTitleBlur() {
    if (!id || titleRef.current === title) return;
    titleRef.current = title;
    try {
      await api.documents.update(id, { title });
    } catch {
      // ignore
    }
  }

  async function handleManualSave() {
    await flushAll();
  }

  async function handleSubmitAssignment() {
    if (!doc?.assignment_id || !id) return;
    setSubmitStatus("submitting");
    try {
      await flushAll();
      await api.submissions.submit({ assignment_id: doc.assignment_id, document_id: id });
      setSubmitStatus("submitted");
    } catch {
      setSubmitStatus("idle");
      alert("Failed to submit. Please try again.");
    }
  }

  async function handleGetFeedback() {
    if (!id) return;
    setShowFeedback(true);
    setFeedbackLoading(true);
    setFeedbackError("");
    setFeedback([]);
    try {
      const result = await api.ai.feedback(id);
      setFeedback(result.feedback);
    } catch (err: any) {
      setFeedbackError(err.message ?? "Failed to get feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  const backPath = doc?.assignment_id ? "/assignments" : "/documents";

  if (loadError) {
    return (
      <div style={s.errorPage}>
        <p>{loadError}</p>
        <button style={s.backBtn} onClick={() => navigate("/documents")}>
          ← Back to documents
        </button>
      </div>
    );
  }

  if (!doc) {
    return <div style={s.loadingPage}>Loading…</div>;
  }

  return (
    <div style={s.page}>
      {/* Toolbar */}
      <header style={s.toolbar}>
        <button style={s.backBtn} onClick={() => isInstructor ? navigate(-1) : navigate(backPath)}>
          ← {isInstructor ? "Back" : doc?.assignment_id ? "Assignments" : "Docs"}
        </button>

        <input
          style={s.titleInput}
          value={title}
          onChange={(e) => { if (!isInstructor) setTitle(e.target.value); }}
          onBlur={handleTitleBlur}
          readOnly={isInstructor}
        />

        <div style={s.toolbarRight}>
          {!isInstructor && (
            <>
              <span style={s.saveStatus}>
                {saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved" : "Saved"}
              </span>
              <button style={s.outlineBtn} onClick={handleManualSave}>
                Save
              </button>
            </>
          )}
          {!isInstructor && (
            <button style={s.outlineBtn} onClick={handleGetFeedback}>
              Get Feedback
            </button>
          )}
          <button
            style={s.outlineBtn}
            onClick={() => navigate(`/documents/${id}/report`)}
          >
            Report
          </button>
          {!isInstructor && doc?.assignment_id && (
            <button
              style={submitStatus === "submitted" ? s.submittedBtn : s.submitBtn}
              onClick={handleSubmitAssignment}
              disabled={submitStatus === "submitting" || submitStatus === "submitted"}
            >
              {submitStatus === "submitted"
                ? "Submitted"
                : submitStatus === "submitting"
                ? "Submitting…"
                : "Submit Assignment"}
            </button>
          )}
        </div>
      </header>

      {/* Editor + Feedback Panel */}
      <div style={s.editorRow}>
        <div style={s.editorArea}>
          <Editor
            key={doc.id}
            initialValue={doc.final_text ?? ""}
            onChange={handleChange}
            readOnly={isInstructor}
          />
        </div>
        {showFeedback && (
          <FeedbackPanel
            feedback={feedback}
            loading={feedbackLoading}
            error={feedbackError}
            onClose={() => setShowFeedback(false)}
          />
        )}
      </div>
      {showNudge && (
        <NudgePanel
          nudges={nudges}
          onDismiss={() => { setShowNudge(false); showNudgeRef.current = false; }}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f1f5f9" },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
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
    padding: "0.35rem 0.5rem",
    flexShrink: 0,
  },
  titleInput: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#1e293b",
    background: "transparent",
    minWidth: 0,
  },
  toolbarRight: { display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 },
  saveStatus: { fontSize: "0.8rem", color: "#94a3b8" },
  outlineBtn: {
    padding: "0.4rem 0.85rem",
    background: "#fff",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: "0.8rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  submitBtn: {
    padding: "0.4rem 0.85rem",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  submittedBtn: {
    padding: "0.4rem 0.85rem",
    background: "#dcfce7",
    color: "#15803d",
    border: "1px solid #bbf7d0",
    borderRadius: 6,
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "default",
  },
  editorRow: {
    flex: 1,
    display: "flex",
    alignItems: "flex-start",
  },
  editorArea: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    padding: "3rem 1.5rem",
  },
  loadingPage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    color: "#94a3b8",
  },
  errorPage: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    gap: "1rem",
    color: "#ef4444",
  },
};
