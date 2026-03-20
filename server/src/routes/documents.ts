import { Router, Response } from "express";
import { pool } from "../db.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/documents
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, title, assignment_id, created_at, updated_at, ai_disclosure
       FROM documents
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// POST /api/documents
router.post("/", async (req: AuthRequest, res: Response) => {
  const { title, assignment_id } = req.body as { title?: string; assignment_id?: string };
  try {
    const result = await pool.query(
      `INSERT INTO documents (user_id, title, assignment_id)
       VALUES ($1, $2, $3)
       RETURNING id, title, assignment_id, created_at, updated_at, ai_disclosure`,
      [req.userId, title || "Untitled", assignment_id ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create document" });
  }
});

// GET /api/documents/:id
// Instructors can fetch any document (for viewing student reports)
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const query =
      req.userRole === "instructor"
        ? `SELECT id, title, final_text, assignment_id, created_at, updated_at, ai_disclosure
           FROM documents WHERE id = $1`
        : `SELECT id, title, final_text, assignment_id, created_at, updated_at, ai_disclosure
           FROM documents WHERE id = $1 AND user_id = $2`;
    const params = req.userRole === "instructor" ? [req.params.id] : [req.params.id, req.userId];
    const result = await pool.query(query, params);
    if (!result.rows[0]) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// PATCH /api/documents/:id
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  const { title, final_text, ai_disclosure } = req.body as {
    title?: string;
    final_text?: string;
    ai_disclosure?: Record<string, boolean>;
  };

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
  if (final_text !== undefined) { fields.push(`final_text = $${idx++}`); values.push(final_text); }
  if (ai_disclosure !== undefined) { fields.push(`ai_disclosure = $${idx++}`); values.push(JSON.stringify(ai_disclosure)); }

  if (fields.length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  fields.push(`updated_at = now()`);
  values.push(req.params.id, req.userId);

  try {
    const result = await pool.query(
      `UPDATE documents SET ${fields.join(", ")}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING id, title, final_text, updated_at, ai_disclosure`,
      values
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update document" });
  }
});

// DELETE /api/documents/:id
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
