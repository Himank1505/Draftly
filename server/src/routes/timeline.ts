import { Router, Response } from "express";
import { pool } from "../db.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { computeDiff, diffStats } from "../services/diff.js";

const router = Router();
router.use(requireAuth);

// ─────────────────────────────────────────────────────────────
// GET /api/timeline?document_id=xxx
//
// Returns the full writing timeline for a document:
//   - each session with its snapshots and diff stats between them
//   - first snapshot in each session is diffed against the last
//     snapshot of the previous session (cross-session continuity)
// ─────────────────────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res: Response) => {
  const { document_id } = req.query as { document_id?: string };
  if (!document_id) {
    res.status(400).json({ error: "document_id query param is required" });
    return;
  }

  try {
    // Verify ownership
    const doc = await pool.query(
      "SELECT id, title FROM documents WHERE id = $1 AND user_id = $2",
      [document_id, req.userId]
    );
    if (!doc.rows[0]) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Fetch all sessions for this document
    const sessions = await pool.query<{
      id: string;
      start_time: string;
      end_time: string | null;
      active_time_seconds: number;
      idle_time_seconds: number;
    }>(
      `SELECT id, start_time, end_time, active_time_seconds, idle_time_seconds
       FROM writing_sessions
       WHERE document_id = $1
       ORDER BY start_time ASC`,
      [document_id]
    );

    if (sessions.rows.length === 0) {
      res.json({ document: doc.rows[0], sessions: [] });
      return;
    }

    const sessionIds = sessions.rows.map((s) => s.id);

    // Fetch all snapshots across all sessions in one query
    const snapshots = await pool.query<{
      id: string;
      session_id: string;
      version: number;
      content: string;
      word_count: number | null;
      created_at: string;
    }>(
      `SELECT id, session_id, version, content, word_count, created_at
       FROM text_snapshots
       WHERE session_id = ANY($1)
       ORDER BY created_at ASC`,
      [sessionIds]
    );

    // Group snapshots by session
    const snapshotsBySession = new Map<string, typeof snapshots.rows>();
    for (const snap of snapshots.rows) {
      const list = snapshotsBySession.get(snap.session_id) ?? [];
      list.push(snap);
      snapshotsBySession.set(snap.session_id, list);
    }

    // Build timeline: compute diffs between consecutive snapshots
    let prevContent = "";
    const timeline = sessions.rows.map((session) => {
      const snaps = snapshotsBySession.get(session.id) ?? [];

      const snapsWithDiffs = snaps.map((snap) => {
        const stats = diffStats(prevContent, snap.content);
        prevContent = snap.content;
        return {
          id: snap.id,
          version: snap.version,
          word_count: snap.word_count,
          created_at: snap.created_at,
          diff: stats,
        };
      });

      return {
        session_id: session.id,
        start_time: session.start_time,
        end_time: session.end_time,
        active_time_seconds: session.active_time_seconds,
        idle_time_seconds: session.idle_time_seconds,
        snapshots: snapsWithDiffs,
      };
    });

    res.json({ document: doc.rows[0], sessions: timeline });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to build timeline" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/timeline/replay?document_id=xxx
//
// Lightweight ordered list of snapshots for the replay scrubber.
// Returns content + timestamp for each version — no full diffs.
// ─────────────────────────────────────────────────────────────
router.get("/replay", async (req: AuthRequest, res: Response) => {
  const { document_id } = req.query as { document_id?: string };
  if (!document_id) {
    res.status(400).json({ error: "document_id query param is required" });
    return;
  }

  try {
    const doc = await pool.query(
      "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
      [document_id, req.userId]
    );
    if (!doc.rows[0]) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const result = await pool.query<{
      id: string;
      session_id: string;
      version: number;
      content: string;
      word_count: number | null;
      created_at: string;
    }>(
      `SELECT ts.id, ts.session_id, ts.version, ts.content, ts.word_count, ts.created_at
       FROM text_snapshots ts
       JOIN writing_sessions ws ON ws.id = ts.session_id
       WHERE ws.document_id = $1
       ORDER BY ts.created_at ASC`,
      [document_id]
    );

    // Build replay frames: each frame has full content + elapsed ms from start
    const frames = result.rows;
    const startMs =
      frames.length > 0 ? new Date(frames[0].created_at).getTime() : 0;

    const replay = frames.map((f, index) => ({
      index,
      snapshot_id: f.id,
      session_id: f.session_id,
      version: f.version,
      content: f.content,
      word_count: f.word_count,
      created_at: f.created_at,
      elapsed_ms: new Date(f.created_at).getTime() - startMs,
    }));

    res.json({ document_id, total_frames: replay.length, frames: replay });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to build replay" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/timeline/compare?from=snapshot_id&to=snapshot_id
//
// Word-level diff between any two snapshots (full change array).
// ─────────────────────────────────────────────────────────────
router.get("/compare", async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) {
    res.status(400).json({ error: "from and to snapshot IDs are required" });
    return;
  }

  try {
    // Fetch both snapshots, verify user owns them via document ownership
    const result = await pool.query<{
      id: string;
      version: number;
      content: string;
      word_count: number | null;
      created_at: string;
    }>(
      `SELECT ts.id, ts.version, ts.content, ts.word_count, ts.created_at
       FROM text_snapshots ts
       JOIN writing_sessions ws ON ws.id = ts.session_id
       JOIN documents d ON d.id = ws.document_id
       WHERE ts.id = ANY($1) AND d.user_id = $2`,
      [[from, to], req.userId]
    );

    const snapshotMap = new Map(result.rows.map((r) => [r.id, r]));
    const fromSnap = snapshotMap.get(from);
    const toSnap = snapshotMap.get(to);

    if (!fromSnap || !toSnap) {
      res.status(404).json({ error: "One or both snapshots not found" });
      return;
    }

    const diff = computeDiff(fromSnap.content, toSnap.content);

    res.json({
      from: {
        id: fromSnap.id,
        version: fromSnap.version,
        word_count: fromSnap.word_count,
        created_at: fromSnap.created_at,
      },
      to: {
        id: toSnap.id,
        version: toSnap.version,
        word_count: toSnap.word_count,
        created_at: toSnap.created_at,
      },
      stats: {
        added_words: diff.added_words,
        removed_words: diff.removed_words,
        unchanged_words: diff.unchanged_words,
      },
      changes: diff.changes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to compare snapshots" });
  }
});

export default router;
