-- ActeRO guide QA approval gate (STAGING ONLY). Apply only after confirming
-- migration 001's guide_scripts table exists. No guide is approved by default.
-- NEVER insert approvals before independent official-source, content, D1 and checkout reviews.
CREATE TABLE IF NOT EXISTS guide_approvals (
  guide_key TEXT PRIMARY KEY REFERENCES guide_scripts(guide_key),
  route TEXT NOT NULL,
  script_sha256 TEXT NOT NULL CHECK(
    length(script_sha256)=64 AND script_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','revoked')),
  reviewer_reference TEXT,
  approved_at TEXT,
  CHECK(status <> 'approved' OR
    (reviewer_reference IS NOT NULL AND length(trim(reviewer_reference)) > 0
     AND approved_at IS NOT NULL AND length(trim(approved_at)) > 0))
);
CREATE INDEX IF NOT EXISTS idx_guide_approvals_status ON guide_approvals(status);
