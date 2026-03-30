import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api, Document, Session, Snapshot, AiDetectionResult, ProcessRiskResult } from "../api";
import { useAuth } from "../AuthContext";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ReportData {
  doc: Document;
  sessions: Session[];
  snapshotCounts: number[];
  totalActiveSeconds: number;
  totalRevisions: number;
  firstSession: Session;
  lastSession: Session;
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Allow teacher viewing: pass ?authorName=...&authorEmail=...&back=/teacher/assignments/xxx
  const authorName  = searchParams.get("authorName")  ?? user?.name  ?? "";
  const authorEmail = searchParams.get("authorEmail") ?? user?.email ?? "";
  const backPath    = searchParams.get("back") ?? `/documents/${id}`;
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const isInstructor = user?.role === "instructor";

  const [detection, setDetection] = useState<AiDetectionResult | null>(null);
  const [detectLoading, setDetectLoading] = useState(false);
  const [detectError, setDetectError] = useState("");

  const [narrative, setNarrative] = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState("");

  const [processRisk, setProcessRisk] = useState<ProcessRiskResult | null>(null);
  const [processRiskLoading, setProcessRiskLoading] = useState(false);
  const [processRiskError, setProcessRiskError] = useState("");

  useEffect(() => {
    // Inject print styles
    const style = document.createElement("style");
    style.textContent = `@media print { .no-print { display: none !important; } body { background: white; } }`;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const doc = await api.documents.get(id!);
        const sessions = await api.sessions.list(id!);

        if (sessions.length === 0) {
          setData({
            doc,
            sessions: [],
            snapshotCounts: [],
            totalActiveSeconds: 0,
            totalRevisions: 0,
            firstSession: null as any,
            lastSession: null as any,
          });
          return;
        }

        const snapshotCounts = await Promise.all(
          sessions.map((s) =>
            api.snapshots.list(s.id).then((snaps: Snapshot[]) => snaps.length)
          )
        );

        const totalActiveSeconds = sessions.reduce((sum, s) => sum + s.active_time_seconds, 0);
        const totalRevisions = snapshotCounts.reduce((sum, c) => sum + c, 0);
        const sorted = [...sessions].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        setData({
          doc,
          sessions,
          snapshotCounts,
          totalActiveSeconds,
          totalRevisions,
          firstSession: sorted[0],
          lastSession: sorted[sorted.length - 1],
        });
      } catch {
        setError("Failed to load report data.");
      }
    }
    load();
  }, [id]);

  function handlePrint() {
    window.print();
  }

  async function handleProcessRisk() {
    if (!id) return;
    setProcessRiskLoading(true);
    setProcessRiskError("");
    setProcessRisk(null);
    try {
      const result = await api.ai.processRisk(id);
      setProcessRisk(result);
    } catch (err: any) {
      setProcessRiskError(err.message ?? "Analysis failed.");
    } finally {
      setProcessRiskLoading(false);
    }
  }

  async function handleNarrative() {
    if (!id) return;
    setNarrativeLoading(true);
    setNarrativeError("");
    setNarrative("");
    try {
      const result = await api.ai.narrative(id);
      setNarrative(result.narrative);
    } catch (err: any) {
      setNarrativeError(err.message ?? "Failed to generate narrative.");
    } finally {
      setNarrativeLoading(false);
    }
  }

  async function handleDetect() {
    if (!id) return;
    setDetectLoading(true);
    setDetectError("");
    setDetection(null);
    try {
      const result = await api.ai.detect(id);
      setDetection(result);
    } catch (err: any) {
      setDetectError(err.message ?? "Detection failed.");
    } finally {
      setDetectLoading(false);
    }
  }

  if (error) {
    return (
      <div style={s.center}>
        <p style={{ color: "#ef4444" }}>{error}</p>
        <button style={s.backBtn} onClick={() => navigate(backPath)}>
          ← Back
        </button>
      </div>
    );
  }

  if (!data) {
    return <div style={s.center}>Loading report…</div>;
  }

  const { doc, sessions, totalActiveSeconds, totalRevisions, firstSession, lastSession } = data;
  const wordCount = doc.final_text
    ? doc.final_text.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div style={s.page}>
      {/* Nav — hidden on print */}
      <header style={s.header} className="no-print">
        <button style={s.backBtn} onClick={() => navigate(backPath)}>
          ← Back
        </button>
        <button style={s.printBtn} onClick={handlePrint}>
          Export PDF
        </button>
      </header>

      {/* Report content */}
      <div ref={printRef} style={s.reportWrapper}>
        <div style={s.report}>
          {/* Report header */}
          <div style={s.reportHeader}>
            <div style={s.reportBrand}>Draftly — Authorship Report</div>
            <h1 style={s.reportTitle}>{doc.title}</h1>
            <p style={s.reportMeta}>
              Author: <strong>{authorName}</strong> &nbsp;·&nbsp; {authorEmail}
            </p>
            <p style={s.reportMeta}>
              Generated: {formatDate(new Date().toISOString())}
            </p>
          </div>

          <hr style={s.divider} />

          {/* Stats */}
          <div style={s.statsGrid}>
            <StatCard label="Active Writing Time" value={formatDuration(totalActiveSeconds)} />
            <StatCard label="Writing Sessions" value={String(sessions.length)} />
            <StatCard label="Revisions Saved" value={String(totalRevisions)} />
            <StatCard label="Final Word Count" value={String(wordCount)} />
          </div>

          <hr style={s.divider} />

          {/* Timeline */}
          {sessions.length > 0 && (
            <>
              <h2 style={s.sectionHeading}>Session Timeline</h2>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>#</th>
                    <th style={s.th}>Started</th>
                    <th style={s.th}>Active time</th>
                    <th style={s.th}>Revisions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, i) => (
                    <tr key={session.id}>
                      <td style={s.td}>{i + 1}</td>
                      <td style={s.td}>{formatDate(session.start_time)}</td>
                      <td style={s.td}>{formatDuration(session.active_time_seconds)}</td>
                      <td style={s.td}>{data.snapshotCounts[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <hr style={s.divider} />

              <div style={s.datesRow}>
                <div>
                  <span style={s.dateLabel}>First draft started</span>
                  <p style={s.dateValue}>{formatDate(firstSession.start_time)}</p>
                </div>
                <div>
                  <span style={s.dateLabel}>Last edit</span>
                  <p style={s.dateValue}>
                    {lastSession.end_time
                      ? formatDate(lastSession.end_time)
                      : "In progress"}
                  </p>
                </div>
              </div>
            </>
          )}

          {sessions.length === 0 && (
            <p style={s.muted}>No writing sessions recorded yet.</p>
          )}

          {/* Process Risk — instructors only */}
          {isInstructor && (
            <>
              <hr style={s.divider} />
              <div style={s.aiDetectHeader}>
                <h2 style={s.sectionHeading}>Process Risk Analysis</h2>
                {!processRisk && (
                  <button
                    style={processRiskLoading ? s.detectBtnDisabled : s.detectBtn}
                    onClick={handleProcessRisk}
                    disabled={processRiskLoading}
                    className="no-print"
                  >
                    {processRiskLoading ? "Analysing…" : "Run Analysis"}
                  </button>
                )}
                {processRisk && (
                  <button style={s.detectBtnOutline} onClick={handleProcessRisk} className="no-print">
                    Re-run
                  </button>
                )}
              </div>

              {processRiskError && <div style={s.detectError}>{processRiskError}</div>}

              {processRiskLoading && (
                <div style={s.detectLoading}>
                  <div style={s.spinner} />
                  <span>Analysing writing process…</span>
                </div>
              )}

              {processRisk && !processRiskLoading && (
                <div style={s.detectResult}>
                  <div style={s.scoreBadgeRow}>
                    <div style={{ ...s.scoreBadge, ...riskStyle(processRisk.risk) }}>
                      <span style={s.scoreNumber}>{processRisk.score}</span>
                      <span style={s.scoreLabel}>Risk Score</span>
                    </div>
                    <div style={{ ...s.riskBadgeBase, ...riskBadgeColors[processRisk.risk] }}>
                      {processRisk.risk} RISK
                    </div>
                  </div>

                  {processRisk.flags.length === 0 && (
                    <p style={s.detectSummary}>No suspicious process signals detected.</p>
                  )}

                  {processRisk.flags.length > 0 && (
                    <div style={s.flagList}>
                      <p style={s.flagsHeading}>Process signals</p>
                      {processRisk.flags.map((flag, i) => (
                        <div key={i} style={{
                          ...s.flagItem,
                          background: flag.severity === "high" ? "#fef2f2" : "#fefce8",
                          borderColor: flag.severity === "high" ? "#fecaca" : "#fef08a",
                        }}>
                          <p style={{ ...s.flagExcerpt, color: flag.severity === "high" ? "#b91c1c" : "#713f12" }}>
                            {flag.signal}
                          </p>
                          <p style={{ ...s.flagReason, color: flag.severity === "high" ? "#b91c1c" : "#854d0e" }}>
                            {flag.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={s.detectDisclaimer}>
                    Process risk is based on keystroke event data, not text content. Flags indicate
                    anomalies worth reviewing — they are not proof of misconduct.
                  </p>
                </div>
              )}

              {!processRisk && !processRiskLoading && !processRiskError && (
                <p style={s.muted}>Click "Run Analysis" to check for anomalies in the student's writing process.</p>
              )}
            </>
          )}

          {/* Authorship Narrative — instructors only */}
          {isInstructor && (
            <>
              <hr style={s.divider} />
              <div style={s.aiDetectHeader}>
                <h2 style={s.sectionHeading}>Authorship Narrative</h2>
                {!narrative && (
                  <button
                    style={narrativeLoading ? s.detectBtnDisabled : s.detectBtn}
                    onClick={handleNarrative}
                    disabled={narrativeLoading}
                    className="no-print"
                  >
                    {narrativeLoading ? "Generating…" : "Generate Narrative"}
                  </button>
                )}
                {narrative && (
                  <button style={s.detectBtnOutline} onClick={handleNarrative} className="no-print">
                    Regenerate
                  </button>
                )}
              </div>

              {narrativeError && <div style={s.detectError}>{narrativeError}</div>}

              {narrativeLoading && (
                <div style={s.detectLoading}>
                  <div style={s.spinner} />
                  <span>Summarising writing process…</span>
                </div>
              )}

              {narrative && !narrativeLoading && (
                <div style={s.narrativeCard}>
                  <p style={s.narrativeText}>{narrative}</p>
                </div>
              )}

              {!narrative && !narrativeLoading && !narrativeError && (
                <p style={s.muted}>Click "Generate Narrative" to get a plain-English summary of how this student wrote their submission.</p>
              )}
            </>
          )}

          {/* AI Detection — instructors only */}
          {isInstructor && (
            <>
              <hr style={s.divider} />
              <div style={s.aiDetectHeader}>
                <h2 style={s.sectionHeading}>AI Content Detection</h2>
                {!detection && (
                  <button
                    style={detectLoading ? s.detectBtnDisabled : s.detectBtn}
                    onClick={handleDetect}
                    disabled={detectLoading}
                    className="no-print"
                  >
                    {detectLoading ? "Analyzing…" : "Run Detection"}
                  </button>
                )}
                {detection && (
                  <button style={s.detectBtnOutline} onClick={handleDetect} className="no-print">
                    Re-run
                  </button>
                )}
              </div>

              {detectError && <div style={s.detectError}>{detectError}</div>}

              {detectLoading && (
                <div style={s.detectLoading}>
                  <div style={s.spinner} />
                  <span>Analyzing text for AI patterns…</span>
                </div>
              )}

              {detection && !detectLoading && (
                <div style={s.detectResult}>
                  {/* Score badge */}
                  <div style={s.scoreBadgeRow}>
                    <div style={{ ...s.scoreBadge, ...riskStyle(detection.risk) }}>
                      <span style={s.scoreNumber}>{detection.score}%</span>
                      <span style={s.scoreLabel}>AI Probability</span>
                    </div>
                    <div style={{ ...s.riskBadgeBase, ...riskBadgeColors[detection.risk] }}>
                      {detection.risk} RISK
                    </div>
                  </div>

                  <p style={s.detectSummary}>{detection.summary}</p>

                  {detection.flags.length > 0 && (
                    <div style={s.flagList}>
                      <p style={s.flagsHeading}>Suspicious passages</p>
                      {detection.flags.map((flag, i) => (
                        <div key={i} style={s.flagItem}>
                          <p style={s.flagExcerpt}>"{flag.excerpt}"</p>
                          <p style={s.flagReason}>{flag.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={s.detectDisclaimer}>
                    AI detection is probabilistic and not conclusive. Use alongside writing
                    process data above to form a complete picture.
                  </p>
                </div>
              )}

              {!detection && !detectLoading && !detectError && (
                <p style={s.muted}>Click "Run Detection" to analyze this submission for AI-generated content.</p>
              )}
            </>
          )}

          {/* Footer */}
          <div style={s.reportFooter}>
            This report was generated by Draftly. It reflects process data collected
            during writing, not analysis of the final text.
          </div>
        </div>
      </div>
    </div>
  );
}

function riskStyle(risk: "LOW" | "MEDIUM" | "HIGH"): React.CSSProperties {
  if (risk === "HIGH")   return { background: "#fef2f2", color: "#b91c1c", borderColor: "#fca5a5" };
  if (risk === "MEDIUM") return { background: "#fefce8", color: "#854d0e", borderColor: "#fde047" };
  return { background: "#f0fdf4", color: "#15803d", borderColor: "#86efac" };
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={sc.statCard}>
      <div style={sc.statValue}>{value}</div>
      <div style={sc.statLabel}>{label}</div>
    </div>
  );
}

const riskBadgeColors = {
  HIGH:   { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5" },
  MEDIUM: { background: "#fefce8", color: "#854d0e", border: "1px solid #fde047" },
  LOW:    { background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" },
};

const s: Record<string, any> = {
  page: { minHeight: "100vh", background: "#f1f5f9" },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    gap: "1rem",
  },
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
  backBtn: {
    background: "none",
    border: "none",
    color: "#3b82f6",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  printBtn: {
    padding: "0.5rem 1.25rem",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  reportWrapper: {
    display: "flex",
    justifyContent: "center",
    padding: "2.5rem 1.5rem",
  },
  report: {
    background: "#fff",
    borderRadius: 12,
    padding: "3rem",
    width: "100%",
    maxWidth: 720,
    boxShadow: "0 4px 24px rgba(15,23,42,0.08)",
  },
  reportBrand: { fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" },
  reportHeader: { marginBottom: "1.5rem" },
  reportTitle: { margin: "0.5rem 0 0.25rem", fontSize: "1.75rem", fontWeight: 700, color: "#1e293b" },
  reportMeta: { margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#64748b" },
  divider: { border: "none", borderTop: "1px solid #e2e8f0", margin: "1.75rem 0" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" },
  sectionHeading: { margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600, color: "#334155" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" },
  th: {
    textAlign: "left",
    padding: "0.5rem 0.75rem",
    background: "#f8fafc",
    color: "#64748b",
    fontWeight: 600,
    fontSize: "0.8rem",
    borderBottom: "1px solid #e2e8f0",
  },
  td: { padding: "0.6rem 0.75rem", borderBottom: "1px solid #f1f5f9", color: "#334155" },
  datesRow: { display: "flex", gap: "3rem" },
  dateLabel: { fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" },
  dateValue: { margin: "0.25rem 0 0", fontSize: "0.95rem", color: "#1e293b", fontWeight: 500 },
  reportFooter: {
    marginTop: "2rem",
    fontSize: "0.8rem",
    color: "#94a3b8",
    borderTop: "1px solid #f1f5f9",
    paddingTop: "1rem",
    lineHeight: 1.6,
  },
  muted: { color: "#94a3b8" },
  aiDetectHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" },
  detectBtn: {
    padding: "0.4rem 1rem",
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  detectBtnDisabled: {
    padding: "0.4rem 1rem",
    background: "#c7d2fe",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "not-allowed",
  },
  detectBtnOutline: {
    padding: "0.4rem 1rem",
    background: "#fff",
    color: "#6366f1",
    border: "1px solid #c7d2fe",
    borderRadius: 6,
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  detectError: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "0.65rem 0.75rem",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
  detectLoading: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    color: "#64748b",
    fontSize: "0.875rem",
    padding: "1rem 0",
  },
  spinner: {
    width: 20,
    height: 20,
    border: "2px solid #e2e8f0",
    borderTop: "2px solid #6366f1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    flexShrink: 0,
  },
  detectResult: { display: "flex", flexDirection: "column", gap: "1rem" },
  scoreBadgeRow: { display: "flex", alignItems: "center", gap: "1rem" },
  riskBadgeBase: {
    padding: "0.35rem 0.85rem",
    borderRadius: 20,
    fontSize: "0.78rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
  },
  scoreBadge: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
    borderRadius: "50%",
    border: "3px solid",
  },
  scoreNumber: { fontSize: "1.3rem", fontWeight: 700, lineHeight: 1 },
  scoreLabel: { fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 },
  detectSummary: { margin: 0, fontSize: "0.9rem", color: "#334155", lineHeight: 1.6 },
  flagList: { display: "flex", flexDirection: "column", gap: "0.6rem" },
  flagsHeading: { margin: "0 0 0.4rem", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" },
  flagItem: {
    background: "#fefce8",
    border: "1px solid #fef08a",
    borderRadius: 6,
    padding: "0.65rem 0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  flagExcerpt: { margin: 0, fontSize: "0.85rem", color: "#713f12", fontStyle: "italic" },
  flagReason: { margin: 0, fontSize: "0.82rem", color: "#854d0e" },
  detectDisclaimer: {
    margin: 0,
    fontSize: "0.75rem",
    color: "#94a3b8",
    borderTop: "1px solid #f1f5f9",
    paddingTop: "0.75rem",
    lineHeight: 1.6,
  },
  narrativeCard: {
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    borderRadius: 8,
    padding: "1rem 1.25rem",
  },
  narrativeText: {
    margin: 0,
    fontSize: "0.95rem",
    color: "#0c4a6e",
    lineHeight: 1.7,
  },
};

const sc: Record<string, React.CSSProperties> = {
  statCard: {
    background: "#f8fafc",
    borderRadius: 8,
    padding: "1.25rem",
    border: "1px solid #e2e8f0",
  },
  statValue: { fontSize: "1.75rem", fontWeight: 700, color: "#1e293b", lineHeight: 1 },
  statLabel: { marginTop: "0.4rem", fontSize: "0.8rem", color: "#64748b", fontWeight: 500 },
};
