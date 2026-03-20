import { Router, Response } from "express";
import { pool } from "../db.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// POST /api/sessions — start a new writing session
router.post("/", async (req: AuthRequest, res: Response) => {
  const { document_id } = req.body as { document_id: string };
  if (!document_id) {
    res.status(400).json({ error: "document_id is required" });
    return;
  }

  try {
    // Verify document belongs to user
    const doc = await pool.query(
      "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
      [document_id, req.userId]
    );
    if (!doc.rows[0]) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO writing_sessions (document_id, start_time)
       VALUES ($1, now())
       RETURNING id, document_id, start_time`,
      [document_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start session" });
  }
});

// PATCH /api/sessions/:id — end session or update timing stats
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  const { active_time_seconds, idle_time_seconds, end } = req.body as {
    active_time_seconds?: number;
    idle_time_seconds?: number;
    end?: boolean;
  };

  try {
    // Verify session belongs to user via document ownership
    const check = await pool.query(
      `SELECT ws.id FROM writing_sessions ws
       JOIN documents d ON d.id = ws.document_id
       WHERE ws.id = $1 AND d.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (!check.rows[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (active_time_seconds !== undefined) {
      fields.push(`active_time_seconds = $${idx++}`);
      values.push(active_time_seconds);
    }
    if (idle_time_seconds !== undefined) {
      fields.push(`idle_time_seconds = $${idx++}`);
      values.push(idle_time_seconds);
    }
    if (end) {
      fields.push(`end_time = now()`);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE writing_sessions SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update session" });
  }
});

// GET /api/sessions?document_id=xxx — list sessions for a document
// Instructors can fetch sessions for any document (for viewing student reports)
router.get("/", async (req: AuthRequest, res: Response) => {
  const { document_id } = req.query as { document_id?: string };
  if (!document_id) {
    res.status(400).json({ error: "document_id query param is required" });
    return;
  }

  try {
    if (req.userRole !== "instructor") {
      const doc = await pool.query(
        "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
        [document_id, req.userId]
      );
      if (!doc.rows[0]) {
        res.status(404).json({ error: "Document not found" });
        return;
      }
    }

    const result = await pool.query(
      `SELECT id, document_id, start_time, end_time, active_time_seconds, idle_time_seconds
       FROM writing_sessions
       WHERE document_id = $1
       ORDER BY start_time ASC`,
      [document_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// GET /api/sessions/:id
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT ws.*
       FROM writing_sessions ws
       JOIN documents d ON d.id = ws.document_id
       WHERE ws.id = $1 AND d.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

export default router;
