-- Add join code to assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- Backfill any existing assignments with a random code
UPDATE assignments SET code = upper(substring(md5(random()::text), 1, 6)) WHERE code IS NULL;

-- Make code required going forward
ALTER TABLE assignments ALTER COLUMN code SET NOT NULL;

-- Student enrollment: tracks who joined which assignment
CREATE TABLE IF NOT EXISTS assignment_enrollments (
  assignment_id UUID        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON assignment_enrollments(student_id);
