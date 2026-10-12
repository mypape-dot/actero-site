-- Apply ONCE after 001/002/003, after inspecting live D1 schema and making a backup.
-- Separate revocation marker from status to avoid assuming a production CHECK(status) constraint.
ALTER TABLE access_grants ADD COLUMN revoked_at TEXT;
ALTER TABLE access_grants ADD COLUMN revoked_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_access_grants_shopify_order ON access_grants(shopify_order_id);
CREATE TABLE IF NOT EXISTS order_revocations (
  order_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS revocation_events (
  event_id TEXT PRIMARY KEY,
  shopify_order_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('revoked','pending_order','needs_review','ignored')),
  reason TEXT NOT NULL,
  case_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  alerted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_revocation_events_order ON revocation_events(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_revocation_events_needs_alert ON revocation_events(outcome,alerted_at);
