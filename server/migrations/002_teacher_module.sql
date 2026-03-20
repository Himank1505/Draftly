-- ─────────────────────────────────────────
-- Teacher Module
-- ─────────────────────────────────────────

-- Link documents to assignments (optional)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS assignment_id UUID;

-- Assignments created by instructors
CREATE TABLE IF NOT EXISTS assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  deadline    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);

-- FK from documents → assignments (set null when assignment deleted)
ALTER TABLE documents
  ADD CONSTRAINT fk_documents_assignment
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;

-- Student submissions
CREATE TABLE IF NOT EXISTS submissions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id   UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id   ON submissions(student_id);
