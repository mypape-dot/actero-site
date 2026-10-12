-- ActeRO F-06 server-issued checkout ownership session.
-- Staging only: back up and inspect D1 before applying.
CREATE TABLE IF NOT EXISTS evaluation_sessions (
  case_id TEXT PRIMARY KEY,
  session_token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evaluation_sessions_expiry ON evaluation_sessions(expires_at);
