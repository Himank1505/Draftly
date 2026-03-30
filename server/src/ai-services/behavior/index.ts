import Anthropic from "@anthropic-ai/sdk";
import { pool } from "../../db.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface NudgeInput {
  documentId: string;
  userId: string;
}

export interface NudgeOutput {
  nudges: string[];
}

export async function generateNudges(input: NudgeInput): Promise<NudgeOutput> {
  const { documentId, userId } = input;

  const docResult = await pool.query(
    `SELECT d.final_text, a.title AS assignment_title, a.description AS assignment_description
     FROM documents d
     LEFT JOIN assignments a ON a.id = d.assignment_id
     WHERE d.id = $1 AND d.user_id = $2`,
    [documentId, userId]
  );

  const doc = docResult.rows[0];
  if (!doc) throw Object.assign(new Error("Document not found"), { status: 404 });

  const text = (doc.final_text ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const assignmentContext = doc.assignment_title
    ? `Assignment: "${doc.assignment_title}"${doc.assignment_description ? `\nPrompt: ${doc.assignment_description}` : ""}\n\n`
    : "";

  const draftContext = text.length >= 30
    ? `Student's current draft:\n"""\n${text.slice(0, 1200)}\n"""\n\n`
    : "The student hasn't written much yet.\n\n";

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `You are a writing coach helping a student who has paused. Generate 2-3 short Socratic questions to help them continue thinking. The questions must NOT give the student text to copy, suggest an answer, or complete their thoughts — only provoke reflection.

${assignmentContext}${draftContext}Return a JSON array of 2-3 question strings. Each question must be under 15 words, open-ended, and specific to the assignment or draft.

Example: ["What evidence best supports your main argument?", "How might a skeptic respond to your claim?"]

Return ONLY valid JSON, no text outside the array.`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  let nudges: string[];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    nudges = match ? JSON.parse(match[0]) : [];
  } catch {
    nudges = [];
  }

  return { nudges };
}
