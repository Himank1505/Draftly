import { Router, Response } from "express";
import { pool } from "../db.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const VALID_EVENT_TYPES = ["insert", "delete", "paste", "pause", "resume"] as const;
type EventType = (typeof VALID_EVENT_TYPES)[number];

interface KeystrokeEvent {
  timestamp: string;
  event_type: EventType;
  char_count_delta: number;
  cursor_position: number;
  paragraph_index?: number;
}

// POST /api/events — batch ingest keystroke events for a session
// Accepts up to 500 events per request to avoid abuse
router.post("/", async (req: AuthRequest, res: Response) => {
  const { session_id, events } = req.body as {
    session_id: string;
    events: KeystrokeEvent[];
  };

  if (!session_id || !Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: "session_id and events[] are required" });
    return;
  }

  if (events.length > 500) {
    res.status(400).json({ error: "Max 500 events per batch" });
    return;
  }

  // Validate all event types before inserting
  for (const e of events) {
    if (!VALID_EVENT_TYPES.includes(e.event_type)) {
      res.status(400).json({ error: `Invalid event_type: ${e.event_type}` });
      return;
    }
  }

  try {
    // Verify session belongs to user
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

    // Bulk insert using unnest for performance
    const timestamps = events.map((e) => e.timestamp);
    const eventTypes = events.map((e) => e.event_type);
    const deltas = events.map((e) => e.char_count_delta ?? 0);
    const cursors = events.map((e) => e.cursor_position ?? 0);
    const paragraphs = events.map((e) => e.paragraph_index ?? null);

    await pool.query(
      `INSERT INTO keystroke_events
         (session_id, timestamp, event_type, char_count_delta, cursor_position, paragraph_index)
       SELECT $1, unnest($2::timestamptz[]), unnest($3::text[]),
              unnest($4::int[]), unnest($5::int[]), unnest($6::int[])`,
      [session_id, timestamps, eventTypes, deltas, cursors, paragraphs]
    );

    res.status(201).json({ inserted: events.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to store events" });
  }
});

// GET /api/events?session_id=xxx — retrieve events for a session
router.get("/", async (req: AuthRequest, res: Response) => {
  const { session_id } = req.query as { session_id?: string };
  if (!session_id) {
    res.status(400).json({ error: "session_id query param is required" });
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

    const result = await pool.query(
      `SELECT id, timestamp, event_type, char_count_delta, cursor_position, paragraph_index
       FROM keystroke_events
       WHERE session_id = $1
       ORDER BY timestamp ASC`,
      [session_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

export default router;
