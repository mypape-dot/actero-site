-- ActeRO shared B5 guide country-review coverage (STAGING ONLY).
-- A shared script must be reviewed for ALL supported country branches before any sale.
-- Do NOT populate rows until each country's actual private output is independently checked.
CREATE TABLE IF NOT EXISTS guide_country_approvals (
  guide_key TEXT NOT NULL REFERENCES guide_scripts(guide_key),
  route TEXT NOT NULL,
  country TEXT NOT NULL CHECK(country IN ('ES','IT','DE','AT','FR','GB','BE','NL','IE','CH')),
  script_sha256 TEXT NOT NULL CHECK(
    length(script_sha256)=64 AND script_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','revoked')),
  reviewer_reference TEXT,
  approved_at TEXT,
  PRIMARY KEY (guide_key,country),
  CHECK(status <> 'approved' OR
    (reviewer_reference IS NOT NULL AND length(trim(reviewer_reference)) > 0
     AND approved_at IS NOT NULL AND length(trim(approved_at)) > 0))
);
CREATE INDEX IF NOT EXISTS idx_guide_country_approvals_status
  ON guide_country_approvals(guide_key,status);
