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
        const confidence = await computeConfidence(sub.document_id);
        return { ...sub, confidence };
      })
    );
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

async function computeConfidence(documentId: string): Promise<"HIGH" | "MEDIUM" | "LOW"> {
  const [sessRes, pasteRes, snapRes] = await Promise.all([
    pool.query(
      "SELECT COALESCE(SUM(active_time_seconds), 0) AS total FROM writing_sessions WHERE document_id = $1",
      [documentId]
    ),
    pool.query(
      `SELECT COUNT(*) AS cnt FROM keystroke_events ke
       JOIN writing_sessions ws ON ws.id = ke.session_id
       WHERE ws.document_id = $1 AND ke.event_type = 'paste'`,
      [documentId]
    ),
    pool.query(
      `SELECT COUNT(*) AS cnt FROM text_snapshots ts
       JOIN writing_sessions ws ON ws.id = ts.session_id
       WHERE ws.document_id = $1`,
      [documentId]
    ),
  ]);
  const totalActive = parseInt(sessRes.rows[0].total, 10);
  const pasteCount  = parseInt(pasteRes.rows[0].cnt, 10);
  const revisions   = parseInt(snapRes.rows[0].cnt, 10);

  if (totalActive >= 300 && pasteCount <= 2 && revisions >= 3) return "HIGH";
  if (totalActive >= 60  && pasteCount <= 5)                   return "MEDIUM";
  return "LOW";
}

export default router;
