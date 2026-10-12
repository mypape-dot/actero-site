-- ActeRO Shopify checkout schema. After 0.4 protected-guide migration.
ALTER TABLE access_grants ADD COLUMN access_token_hash TEXT;
CREATE TABLE IF NOT EXISTS checkout_intents (
  checkout_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  route TEXT NOT NULL,
  guide_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_checkout_intents_case ON checkout_intents(case_id);
