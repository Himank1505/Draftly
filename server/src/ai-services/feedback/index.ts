import Anthropic from "@anthropic-ai/sdk";
import { pool } from "../../db.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface FeedbackInput {
  documentId: string;
  userId: string;
}

export interface FeedbackItem {
  type: "clarity" | "grammar" | "argument";
  location: string;
  note: string;
}

export interface FeedbackOutput {
  feedback: FeedbackItem[];
}

export async function generateFeedback(input: FeedbackInput): Promise<FeedbackOutput> {
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

  const text = doc.final_text?.trim();
  if (!text || text.length < 50) {
    throw Object.assign(
      new Error("Write at least a few sentences before requesting feedback."),
      { status: 400 }
    );
  }

  const assignmentContext = doc.assignment_title
    ? `Assignment: "${doc.assignment_title}"${doc.assignment_description ? `\nPrompt: ${doc.assignment_description}` : ""}\n\n`
    : "";

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a writing coach reviewing a student's draft. Your job is to identify issues only — do NOT suggest replacement text, do NOT rewrite anything, and do NOT complete their thoughts.

${assignmentContext}Student's draft:
"""
${text}
"""

Return a JSON array of feedback items. Each item must have:
- "type": one of "clarity", "grammar", or "argument"
- "location": a short quote (5-8 words) from the text that identifies where the issue is
- "note": one sentence describing what is wrong, without providing a fix

Rules:
- Maximum 2 items per type (6 total max)
- Only flag real issues, not stylistic preferences
- Never write what the student should say instead
- Return ONLY valid JSON, no explanation outside the array

Example format:
[
  { "type": "clarity", "location": "the thing happened because of", "note": "This phrase is vague — it's unclear what 'the thing' refers to." },
  { "type": "grammar", "location": "they was going to the", "note": "Subject-verb agreement error: 'they' requires 'were', not 'was'." }
]`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  let feedback: FeedbackItem[];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    feedback = match ? JSON.parse(match[0]) : [];
  } catch {
    feedback = [];
  }

  return { feedback };
}
