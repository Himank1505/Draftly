import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { generateFeedback } from "../ai-services/feedback/index.js";
import { detectAiText } from "../ai-services/detection/text.js";
import { analyzeProcessRisk } from "../ai-services/detection/process.js";
import { generateNudges } from "../ai-services/behavior/index.js";
import { generateNarrative } from "../ai-services/narrative/index.js";

const router = Router();
router.use(requireAuth);

// Re-export types consumed by other modules
export type { FeedbackItem } from "../ai-services/feedback/index.js";

function handleError(err: any, res: Response, fallback: string) {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? fallback });
}

// POST /api/ai/feedback  — students only
router.post("/feedback", async (req: AuthRequest, res: Response) => {
  const { document_id } = req.body as { document_id: string };
  if (!document_id) { res.status(400).json({ error: "document_id is required" }); return; }
  if (req.userRole === "instructor") { res.status(403).json({ error: "Feedback is for students only" }); return; }

  try {
    res.json(await generateFeedback({ documentId: document_id, userId: req.userId! }));
  } catch (err) {
    handleError(err, res, "Failed to generate feedback");
  }
});

// POST /api/ai/detect  — instructors only
router.post("/detect", async (req: AuthRequest, res: Response) => {
  const { document_id } = req.body as { document_id: string };
  if (!document_id) { res.status(400).json({ error: "document_id is required" }); return; }
  if (req.userRole !== "instructor") { res.status(403).json({ error: "AI detection is for instructors only" }); return; }

  try {
    res.json(await detectAiText({ documentId: document_id }));
  } catch (err) {
    handleError(err, res, "Failed to run AI detection");
  }
});

// POST /api/ai/process-risk  — instructors only
router.post("/process-risk", async (req: AuthRequest, res: Response) => {
  const { document_id } = req.body as { document_id: string };
  if (!document_id) { res.status(400).json({ error: "document_id is required" }); return; }
  if (req.userRole !== "instructor") { res.status(403).json({ error: "Process risk analysis is for instructors only" }); return; }

  try {
    res.json(await analyzeProcessRisk({ documentId: document_id }));
  } catch (err) {
    handleError(err, res, "Failed to run process risk analysis");
  }
});

// POST /api/ai/nudge  — students only
router.post("/nudge", async (req: AuthRequest, res: Response) => {
  const { document_id } = req.body as { document_id: string };
  if (!document_id) { res.status(400).json({ error: "document_id is required" }); return; }
  if (req.userRole === "instructor") { res.status(403).json({ error: "Nudges are for students only" }); return; }

  try {
    res.json(await generateNudges({ documentId: document_id, userId: req.userId! }));
  } catch (err) {
    handleError(err, res, "Failed to generate nudges");
  }
});

// POST /api/ai/narrative  — instructors only
router.post("/narrative", async (req: AuthRequest, res: Response) => {
  const { document_id } = req.body as { document_id: string };
  if (!document_id) { res.status(400).json({ error: "document_id is required" }); return; }
  if (req.userRole !== "instructor") { res.status(403).json({ error: "Authorship narrative is for instructors only" }); return; }

  try {
    res.json(await generateNarrative({ documentId: document_id }));
  } catch (err) {
    handleError(err, res, "Failed to generate authorship narrative");
  }
});

export default router;
