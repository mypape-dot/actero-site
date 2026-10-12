-- ActeRO F-03. Apply once, only AFTER inspecting and backing up the target D1.
-- Store an order-verified keyed email hash (not raw buyer emails) and the paid guide snapshot.
ALTER TABLE access_grants ADD COLUMN recovery_email_hash TEXT;
ALTER TABLE access_grants ADD COLUMN evaluation_json TEXT;
CREATE INDEX IF NOT EXISTS idx_actero_recovery_buyer ON access_grants(shopify_order_name,recovery_email_hash);
CREATE TABLE IF NOT EXISTS recovery_links (
  token_hash TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  consumed_by TEXT,
  delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_actero_recovery_case_time ON recovery_links(case_id,created_at);
