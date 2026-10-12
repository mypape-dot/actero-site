-- F-06 staging migration: fixed-window request quotas (no raw IP/email stored).
-- Apply only after checking actual D1 schema and backing up staging.
CREATE TABLE IF NOT EXISTS request_quotas (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_request_quotas_expiry ON request_quotas(updated_at);
