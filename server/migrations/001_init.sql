-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'instructor')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- Documents
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL DEFAULT 'Untitled',
  final_text     TEXT,
  ai_disclosure  JSONB,          -- e.g. {"brainstorming": true, "grammar": false}
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

-- ─────────────────────────────────────────
-- Writing Sessions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS writing_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id          UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  start_time           TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time             TIMESTAMPTZ,
  active_time_seconds  INT         NOT NULL DEFAULT 0,
  idle_time_seconds    INT         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_document_id ON writing_sessions(document_id);

-- ─────────────────────────────────────────
-- Keystroke Events  (privacy-safe — no raw keys)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS keystroke_events (
  id               BIGSERIAL   PRIMARY KEY,
  session_id       UUID        NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  timestamp        TIMESTAMPTZ NOT NULL,
  event_type       TEXT        NOT NULL CHECK (event_type IN ('insert','delete','paste','pause','resume')),
  char_count_delta INT         NOT NULL DEFAULT 0,
  cursor_position  INT         NOT NULL DEFAULT 0,
  paragraph_index  INT
);

CREATE INDEX IF NOT EXISTS idx_events_session_id ON keystroke_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp   ON keystroke_events(timestamp);

-- ─────────────────────────────────────────
-- Text Snapshots  (versioned auto-saves)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS text_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  version     INT         NOT NULL,
  content     TEXT        NOT NULL,
  word_count  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, version)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_session_id ON text_snapshots(session_id);
