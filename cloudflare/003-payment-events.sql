-- Apply once to D1 already migrated through 002-shopify-checkout.sql.
-- Stores valid, authenticated Shopify orders/paid outcomes for incident handling.
CREATE TABLE IF NOT EXISTS payment_events (
  event_id TEXT PRIMARY KEY,
  shopify_order_id TEXT,
  checkout_id TEXT,
  case_id TEXT,
  result TEXT NOT NULL CHECK(result IN ('granted','duplicate','ignored','needs_review')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  alerted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_events_review ON payment_events(result,alerted_at,created_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(shopify_order_id);
