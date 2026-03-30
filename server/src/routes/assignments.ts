import { Router, Response } from "express";
import { pool } from "../db.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function generateCode(): string {
  // 6 uppercase alphanumeric chars, excluding visually ambiguous ones (0/O, 1/I/L)
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// GET /api/assignments
// - instructor: their own assignments (with submission count)
// - student: only enrolled assignments
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const result =
      req.userRole === "instructor"
        ? await pool.query(
            `SELECT a.*,
                    COUNT(s.id) AS submission_count
             FROM assignments a
             LEFT JOIN submissions s ON s.assignment_id = a.id
             WHERE a.teacher_id = $1
             GROUP BY a.id
             ORDER BY a.created_at DESC`,
            [req.userId]
          )
        : await pool.query(
            `SELECT a.*
             FROM assignments a
             JOIN assignment_enrollments ae ON ae.assignment_id = a.id
             WHERE ae.student_id = $1
             ORDER BY a.created_at DESC`,
            [req.userId]
          );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

// POST /api/assignments/join  (student joins using a code)
// Must be before /:id route so it's not treated as an id param
router.post("/join", async (req: AuthRequest, res: Response) => {
  if (req.userRole === "instructor") {
    res.status(403).json({ error: "Instructors cannot join assignments" });
    return;
  }
  const { code } = req.body as { code: string };
  if (!code?.trim()) {
    res.status(400).json({ error: "code is required" });
    return;
  }
  try {
    const assignmentRes = await pool.query(
      "SELECT * FROM assignments WHERE code = $1",
      [code.trim().toUpperCase()]
    );
    if (!assignmentRes.rows[0]) {
      res.status(404).json({ error: "Invalid code — no assignment found" });
      return;
    }
    const assignment = assignmentRes.rows[0];

    // Enroll (ignore if already enrolled)
    await pool.query(
      `INSERT INTO assignment_enrollments (assignment_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [assignment.id, req.userId]
    );

    res.json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to join assignment" });
  }
});

// POST /api/assignments  (instructor only)
router.post("/", async (req: AuthRequest, res: Response) => {
  if (req.userRole !== "instructor") {
    res.status(403).json({ error: "Only instructors can create assignments" });
    return;
  }
  const { title, description, deadline } = req.body as {
    title: string;
    description?: string;
    deadline?: string;
  };
  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  // Generate a unique code (retry on collision, though extremely unlikely)
  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await pool.query("SELECT 1 FROM assignments WHERE code = $1", [code]);
    if (!exists.rows[0]) break;
    code = generateCode();
  }

  try {
    const result = await pool.query(
      `INSERT INTO assignments (teacher_id, title, description, deadline, code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.userId, title.trim(), description ?? null, deadline ?? null, code]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

// GET /api/assignments/:id
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM assignments WHERE id = $1", [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch assignment" });
  }
});

// PATCH /api/assignments/:id  (instructor only, must own)
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  if (req.userRole !== "instructor") {
    res.status(403).json({ error: "Only instructors can update assignments" });
    return;
  }
  const { title, description, deadline } = req.body as {
    title?: string;
    description?: string;
    deadline?: string;
  };
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
  if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
  if (deadline !== undefined) { fields.push(`deadline = $${idx++}`); values.push(deadline || null); }
  if (fields.length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  values.push(req.params.id, req.userId);
  try {
    const result = await pool.query(
      `UPDATE assignments SET ${fields.join(", ")}
       WHERE id = $${idx++} AND teacher_id = $${idx}
       RETURNING *`,
      values
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update assignment" });
  }
});

// DELETE /api/assignments/:id  (instructor only, must own)
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  if (req.userRole !== "instructor") {
    res.status(403).json({ error: "Only instructors can delete assignments" });
    return;
  }
  try {
    await pool.query(
      "DELETE FROM assignments WHERE id = $1 AND teacher_id = $2",
      [req.params.id, req.userId]
    );
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete assignment" });
  }
});

// GET /api/assignments/:id/submissions  (instructor only, must own assignment)
router.get("/:id/submissions", async (req: AuthRequest, res: Response) => {
  if (req.userRole !== "instructor") {
    res.status(403).json({ error: "Only instructors can view submissions" });
    return;
  }
  try {
    const asgn = await pool.query(
      "SELECT id FROM assignments WHERE id = $1 AND teacher_id = $2",
      [req.params.id, req.userId]
    );
    if (!asgn.rows[0]) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    const submissionsResult = await pool.query(
      `SELECT s.id, s.submitted_at, s.document_id, s.student_id,
              u.name AS student_name, u.email AS student_email
       FROM submissions s
       JOIN users u ON u.id = s.student_id
       WHERE s.assignment_id = $1
       ORDER BY s.submitted_at DESC`,
      [req.params.id]
    );

    const submissions = await Promise.all(
      submissionsResult.rows.map(async (sub) => {
        const { level, score, breakdown } = await computeConfidence(sub.document_id);
        return { ...sub, confidence: level, confidence_score: score, confidence_breakdown: breakdown };
      })
    );
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

export interface ConfidenceBreakdownItem {
  label: string;
  score: number;
  max: number;
}

export interface ConfidenceResult {
  level: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  breakdown: ConfidenceBreakdownItem[];
}

async function computeConfidence(documentId: string): Promise<ConfidenceResult> {
  const [sessRes, sessionListRes, snapRes, eventRes] = await Promise.all([
    // Total active time
    pool.query(
      "SELECT COALESCE(SUM(active_time_seconds), 0) AS total FROM writing_sessions WHERE document_id = $1",
      [documentId]
    ),
    // All sessions (for count + day span)
    pool.query(
      "SELECT start_time, end_time FROM writing_sessions WHERE document_id = $1 ORDER BY start_time ASC",
      [documentId]
    ),
    // Revision count
    pool.query(
      `SELECT COUNT(*) AS cnt FROM text_snapshots ts
       JOIN writing_sessions ws ON ws.id = ts.session_id
       WHERE ws.document_id = $1`,
      [documentId]
    ),
    // Insert + delete event counts
    pool.query(
      `SELECT event_type, COUNT(*) AS cnt FROM keystroke_events ke
       JOIN writing_sessions ws ON ws.id = ke.session_id
       WHERE ws.document_id = $1 AND event_type IN ('insert', 'delete')
       GROUP BY event_type`,
      [documentId]
    ),
  ]);

  const totalActive  = parseInt(sessRes.rows[0].total, 10);
  const sessions     = sessionListRes.rows;
  const revisions    = parseInt(snapRes.rows[0].cnt, 10);

  const eventCounts: Record<string, number> = {};
  for (const row of eventRes.rows) {
    eventCounts[row.event_type] = parseInt(row.cnt, 10);
  }
  const inserts = eventCounts["insert"] ?? 0;
  const deletes = eventCounts["delete"] ?? 0;

  // --- Signal 1: Active time (0–25 pts) ---
  let timeScore = 0;
  if      (totalActive >= 600) timeScore = 25;
  else if (totalActive >= 300) timeScore = 20;
  else if (totalActive >= 120) timeScore = 12;
  else if (totalActive >= 60)  timeScore =  6;

  // --- Signal 2: Session count (0–20 pts) ---
  let sessionScore = 0;
  if      (sessions.length >= 3) sessionScore = 20;
  else if (sessions.length === 2) sessionScore = 14;
  else if (sessions.length === 1) sessionScore =  7;

  // --- Signal 3: Day span (0–15 pts) ---
  let dayScore = 0;
  if (sessions.length > 0) {
    const first = new Date(sessions[0].start_time).getTime();
    const lastRow = sessions[sessions.length - 1];
    const last = lastRow.end_time
      ? new Date(lastRow.end_time).getTime()
      : new Date(lastRow.start_time).getTime();
    const daySpan = Math.round((last - first) / (1000 * 60 * 60 * 24));
    if      (daySpan >= 2) dayScore = 15;
    else if (daySpan >= 1) dayScore =  8;
    else                   dayScore =  3;
  }

  // --- Signal 4: Revision depth (0–20 pts) ---
  let revScore = 0;
  if      (revisions >= 15) revScore = 20;
  else if (revisions >= 8)  revScore = 15;
  else if (revisions >= 3)  revScore = 10;
  else if (revisions >= 1)  revScore =  5;

  // --- Signal 5: Delete ratio (0–20 pts) ---
  // Healthy human writing has ~15–50% deletes relative to inserts
  let deleteScore = 0;
  if (inserts > 0) {
    const ratio = deletes / inserts;
    if      (ratio >= 0.10 && ratio <= 0.50) deleteScore = 20;
    else if (ratio >= 0.05 && ratio <= 0.60) deleteScore = 10;
    else if (ratio >  0)                     deleteScore =  5;
  }

  const total = timeScore + sessionScore + dayScore + revScore + deleteScore;
  const level: "HIGH" | "MEDIUM" | "LOW" =
    total >= 65 ? "HIGH" : total >= 35 ? "MEDIUM" : "LOW";

  return {
    level,
    score: total,
    breakdown: [
      { label: "Writing duration",    score: timeScore,    max: 25 },
      { label: "Session distribution", score: sessionScore, max: 20 },
      { label: "Day span",            score: dayScore,     max: 15 },
      { label: "Revision depth",      score: revScore,     max: 20 },
      { label: "Edit behaviour",      score: deleteScore,  max: 20 },
    ],
  };
}

export default router;
