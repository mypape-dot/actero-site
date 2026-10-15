-- Baseline for synthetic local tests and the generated EMPTY staging bootstrap.
-- Not a production schema claim; never apply to an existing database.
-- Historical migrations 001 onward require this pre-existing table.
CREATE TABLE access_grants (
  case_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending','paid')),
  route TEXT,
  shopify_order_id TEXT,
  shopify_order_name TEXT,
  paid_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
