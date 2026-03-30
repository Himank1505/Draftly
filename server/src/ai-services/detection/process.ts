import { pool } from "../../db.js";

export interface ProcessRiskInput {
  documentId: string;
}

export interface ProcessRiskFlag {
  signal: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

export interface ProcessRiskOutput {
  risk: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  flags: ProcessRiskFlag[];
}

export async function analyzeProcessRisk(input: ProcessRiskInput): Promise<ProcessRiskOutput> {
  const { documentId } = input;

  const [sessRes, bulkInsertRes, velocityRes, editRatioRes, wordCountRes] = await Promise.all([
    pool.query(
      `SELECT id, start_time, end_time, active_time_seconds
       FROM writing_sessions WHERE document_id = $1 ORDER BY start_time ASC`,
      [documentId]
    ),
    pool.query(
      `SELECT MAX(ke.char_count_delta) AS max_delta,
              COUNT(*) FILTER (WHERE ke.char_count_delta > 100) AS bulk_count
       FROM keystroke_events ke
       JOIN writing_sessions ws ON ws.id = ke.session_id
       WHERE ws.document_id = $1 AND ke.event_type = 'insert'`,
      [documentId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(ke.char_count_delta), 0) AS total_inserted
       FROM keystroke_events ke
       JOIN writing_sessions ws ON ws.id = ke.session_id
       WHERE ws.document_id = $1 AND ke.event_type = 'insert'`,
      [documentId]
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(ke.char_count_delta) FILTER (WHERE ke.event_type = 'insert'), 0) AS insert_chars,
         COALESCE(SUM(ke.char_count_delta) FILTER (WHERE ke.event_type = 'delete'), 0) AS delete_chars
       FROM keystroke_events ke
       JOIN writing_sessions ws ON ws.id = ke.session_id
       WHERE ws.document_id = $1`,
      [documentId]
    ),
    pool.query(
      `SELECT ts.word_count FROM text_snapshots ts
       JOIN writing_sessions ws ON ws.id = ts.session_id
       WHERE ws.document_id = $1
       ORDER BY ts.created_at DESC LIMIT 1`,
      [documentId]
    ),
  ]);

  const sessions      = sessRes.rows;
  const maxDelta      = parseInt(bulkInsertRes.rows[0].max_delta ?? "0", 10);
  const bulkCount     = parseInt(bulkInsertRes.rows[0].bulk_count ?? "0", 10);
  const totalInserted = parseInt(velocityRes.rows[0].total_inserted, 10);
  const insertChars   = parseInt(editRatioRes.rows[0].insert_chars, 10);
  const deleteChars   = parseInt(editRatioRes.rows[0].delete_chars, 10);
  const wordCount     = parseInt(wordCountRes.rows[0]?.word_count ?? "0", 10);
  const totalActive   = sessions.reduce((s: number, r: any) => s + (r.active_time_seconds ?? 0), 0);

  const flags: ProcessRiskFlag[] = [];
  let score = 0;

  // Signal 1: Bulk insert events (0–25 pts)
  if (maxDelta > 500) {
    score += 25;
    flags.push({
      signal: "Bulk content insertion",
      detail: `A single insert event added ${maxDelta} characters — consistent with a paste bypass (${bulkCount} such event${bulkCount !== 1 ? "s" : ""} detected).`,
      severity: "high",
    });
  } else if (maxDelta > 100) {
    score += 15;
    flags.push({
      signal: "Large insert event",
      detail: `A single insert event added ${maxDelta} characters. Normal keystrokes produce 1–2 characters per event.`,
      severity: "medium",
    });
  }

  // Signal 2: Typing velocity (0–25 pts)
  const charsPerSec = totalActive > 0 ? totalInserted / totalActive : 0;
  if (charsPerSec > 20) {
    score += 25;
    flags.push({
      signal: "Typing speed anomaly",
      detail: `Effective input rate was ${charsPerSec.toFixed(1)} chars/sec (≈${Math.round(charsPerSec * 12)} WPM) — far above the human range of 4–8 chars/sec.`,
      severity: "high",
    });
  } else if (charsPerSec > 10) {
    score += 12;
    flags.push({
      signal: "Elevated typing speed",
      detail: `Effective input rate was ${charsPerSec.toFixed(1)} chars/sec (≈${Math.round(charsPerSec * 12)} WPM) — above typical human range.`,
      severity: "medium",
    });
  }

  // Signal 3: Edit ratio (0–25 pts)
  if (insertChars > 500) {
    const editRatio = deleteChars / insertChars;
    if (editRatio < 0.01) {
      score += 25;
      flags.push({
        signal: "No editing behaviour",
        detail: `${insertChars} characters inserted with only ${deleteChars} deleted (${(editRatio * 100).toFixed(1)}% edit ratio). Human writers typically delete 15–30% of what they type.`,
        severity: "high",
      });
    } else if (editRatio < 0.05) {
      score += 12;
      flags.push({
        signal: "Very low editing activity",
        detail: `Edit ratio of ${(editRatio * 100).toFixed(1)}% — unusually low. Human writers naturally revise as they go.`,
        severity: "medium",
      });
    }
  }

  // Signal 4: Instant document (0–25 pts)
  if (sessions.length === 1 && wordCount > 200 && totalActive < 120) {
    const wordsPerMin = totalActive > 0 ? (wordCount / totalActive) * 60 : Infinity;
    score += 25;
    flags.push({
      signal: "Instant document creation",
      detail: `${wordCount} words appeared in a single session with only ${totalActive}s of active time (${wordsPerMin.toFixed(0)} words/min). Sustained human writing averages 20–40 words/min.`,
      severity: "high",
    });
  } else if (sessions.length === 1 && wordCount > 100 && totalActive < 60) {
    const wordsPerMin = totalActive > 0 ? (wordCount / totalActive) * 60 : Infinity;
    score += 15;
    flags.push({
      signal: "Very fast single-session creation",
      detail: `${wordCount} words created in one session with ${totalActive}s active time (${wordsPerMin.toFixed(0)} words/min).`,
      severity: "medium",
    });
  }

  const risk: "HIGH" | "MEDIUM" | "LOW" =
    score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";

  return { risk, score: Math.min(score, 100), flags };
}
