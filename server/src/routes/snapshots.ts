import { Router, Response } from "express";
import { pool } from "../db.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// POST /api/snapshots — save a text snapshot (auto-save)
router.post("/", async (req: AuthRequest, res: Response) => {
  const { session_id, content, word_count } = req.body as {
    session_id: string;
    content: string;
    word_count?: number;
  };

  if (!session_id || content === undefined) {
    res.status(400).json({ error: "session_id and content are required" });
    return;
  }

  try {
    const check = await pool.query(
      `SELECT ws.id FROM writing_sessions ws
       JOIN documents d ON d.id = ws.document_id
       WHERE ws.id = $1 AND d.user_id = $2`,
      [session_id, req.userId]
    );
    if (!check.rows[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Get next version number for this session
    const versionResult = await pool.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM text_snapshots WHERE session_id = $1`,
      [session_id]
    );
    const version = versionResult.rows[0].next_version;

    const result = await pool.query(
      `INSERT INTO text_snapshots (session_id, version, content, word_count)
       VALUES ($1, $2, $3, $4)
       RETURNING id, session_id, version, word_count, created_at`,
      [session_id, version, content, word_count ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save snapshot" });
  }
});

// GET /api/snapshots?session_id=xxx — list snapshots (no content, just metadata)
// Instructors can fetch snapshots for any session (for viewing student reports)
router.get("/", async (req: AuthRequest, res: Response) => {
  const { session_id } = req.query as { session_id?: string };
  if (!session_id) {
    res.status(400).json({ error: "session_id query param is required" });
    return;
  }

  try {
    if (req.userRole !== "instructor") {
      const check = await pool.query(
        `SELECT ws.id FROM writing_sessions ws
         JOIN documents d ON d.id = ws.document_id
         WHERE ws.id = $1 AND d.user_id = $2`,
        [session_id, req.userId]
      );
      if (!check.rows[0]) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
    }

    const result = await pool.query(
      `SELECT id, session_id, version, word_count, created_at
       FROM text_snapshots
       WHERE session_id = $1
       ORDER BY version ASC`,
      [session_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch snapshots" });
  }
});

// GET /api/snapshots/:id — get a single snapshot with content
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT ts.*
       FROM text_snapshots ts
       JOIN writing_sessions ws ON ws.id = ts.session_id
       JOIN documents d ON d.id = ws.document_id
       WHERE ts.id = $1 AND d.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Snapshot not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch snapshot" });
  }
});

export default router;
