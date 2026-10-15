-- STAGING CANDIDATE ONLY. Never apply blindly to an existing database.
-- Preflight: SELECT shopify_order_id,COUNT(*) FROM access_grants
-- WHERE shopify_order_id IS NOT NULL GROUP BY shopify_order_id HAVING COUNT(*)>1;
-- If duplicates exist, STOP for operator review; do not delete customer grants.
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_grants_unique_order
  ON access_grants(shopify_order_id) WHERE shopify_order_id IS NOT NULL;
