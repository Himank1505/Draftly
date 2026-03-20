import { Router, Response } from "express";
import { pool } from "../db.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// POST /api/submissions — student submits an assignment
router.post("/", async (req: AuthRequest, res: Response) => {
  const { assignment_id, document_id } = req.body as {
    assignment_id: string;
    document_id: string;
  };
  if (!assignment_id || !document_id) {
    res.status(400).json({ error: "assignment_id and document_id are required" });
    return;
  }
  try {
    // Verify the document belongs to this student
    const docCheck = await pool.query(
      "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
      [document_id, req.userId]
    );
    if (!docCheck.rows[0]) {
      res.status(403).json({ error: "Document not found" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO submissions (assignment_id, student_id, document_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (assignment_id, student_id) DO UPDATE
         SET document_id = EXCLUDED.document_id,
             submitted_at = now()
       RETURNING *`,
      [assignment_id, req.userId, document_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit" });
  }
});

// GET /api/submissions/my — student's own submissions
router.get("/my", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM submissions WHERE student_id = $1",
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

export default router;
