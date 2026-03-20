import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import authRouter        from "./routes/auth.js";
import documentsRouter   from "./routes/documents.js";
import sessionsRouter    from "./routes/sessions.js";
import eventsRouter      from "./routes/events.js";
import snapshotsRouter   from "./routes/snapshots.js";
import timelineRouter    from "./routes/timeline.js";
import assignmentsRouter from "./routes/assignments.js";
import submissionsRouter from "./routes/submissions.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "draftly-server" });
});

app.use("/api/auth",        authRouter);
app.use("/api/documents",   documentsRouter);
app.use("/api/sessions",    sessionsRouter);
app.use("/api/events",      eventsRouter);
app.use("/api/snapshots",   snapshotsRouter);
app.use("/api/timeline",    timelineRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/submissions", submissionsRouter);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
