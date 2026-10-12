-- Run once in Cloudflare D1, BEFORE deploying worker.js.
-- Existing access_grants and guides tables are kept.
ALTER TABLE access_grants ADD COLUMN guide_key TEXT;
CREATE TABLE IF NOT EXISTS guide_scripts (
 guide_key TEXT PRIMARY KEY,
 route TEXT NOT NULL,
 title TEXT NOT NULL,
 script_js TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guide_scripts_route ON guide_scripts(route);
