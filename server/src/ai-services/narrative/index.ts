import Anthropic from "@anthropic-ai/sdk";
import { pool } from "../../db.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface NarrativeInput {
  documentId: string;
}

export interface NarrativeOutput {
  narrative: string;
}

export async function generateNarrative(input: NarrativeInput): Promise<NarrativeOutput> {
  const { documentId } = input;

  const sessionsResult = await pool.query(
    `SELECT id, start_time, end_time, active_time_seconds
     FROM writing_sessions
     WHERE document_id = $1
     ORDER BY start_time ASC`,
    [documentId]
  );
  const sessions = sessionsResult.rows;

  if (sessions.length === 0) {
    throw Object.assign(
      new Error("No writing sessions found for this document."),
      { status: 400 }
    );
  }

  const revisionsResult = await pool.query(
    `SELECT COUNT(*) AS cnt FROM text_snapshots ts
     JOIN writing_sessions ws ON ws.id = ts.session_id
     WHERE ws.document_id = $1`,
    [documentId]
  );
  const revisionCount = parseInt(revisionsResult.rows[0].cnt, 10);

  const firstStart = new Date(sessions[0].start_time);
  const lastSession = sessions[sessions.length - 1];
  const lastTime = lastSession.end_time
    ? new Date(lastSession.end_time)
    : new Date(lastSession.start_time);
  const daySpan = Math.max(
    1,
    Math.round((lastTime.getTime() - firstStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  const totalActiveSeconds = sessions.reduce(
    (sum: number, s: any) => sum + (s.active_time_seconds ?? 0),
    0
  );
  const activeMinutes = Math.round(totalActiveSeconds / 60);

  const metricsDescription = `
- Writing sessions: ${sessions.length}
- Day span (first to last edit): ${daySpan} day${daySpan !== 1 ? "s" : ""}
- Total active writing time: ${activeMinutes} minute${activeMinutes !== 1 ? "s" : ""}
- Revision snapshots saved: ${revisionCount}
`.trim();

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `You are an academic writing analyst writing a brief narrative summary for an instructor reviewing a student submission. Based solely on the process metrics below, write 2-3 plain-English sentences that describe how the student worked on this document.

Metrics:
${metricsDescription}

Rules:
- Write in third person ("This student…")
- Be factual and neutral — do not speculate beyond what the data shows
- Mention session count and time span, active writing time, and revision behaviour
- Keep the total response to 2-3 sentences, no headers, no bullet points
- Return only the narrative text, nothing else`,
      },
    ],
  });

  const narrative =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";

  if (!narrative) throw new Error("Failed to generate narrative");

  return { narrative };
}
