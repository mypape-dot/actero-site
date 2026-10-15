#!/usr/bin/env bash
# Private read-only, local-only evidence cue audit. No screenshots, no export.
# Every output remains REVIEW; never use as legal/consular approval.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"
echo "Checking Cloudflare Wrangler before private D1 SELECT."
npx wrangler --version
echo "Examining only the rendered guide text in two offline browsers. No scripts printed or saved."
npx wrangler d1 execute actero-db --remote --json \
  --command "SELECT guide_key,route,script_js FROM guide_scripts WHERE guide_key IN ('B1_FR','B1_BE','B1_NL','B1_IE','B5_RENEWAL_FR','B5_RENEWAL_BE','B5_RENEWAL_NL','B5_RENEWAL_IE','B5_LOST_FR','B5_LOST_BE','B5_LOST_NL','B5_LOST_IE') ORDER BY guide_key" \
  | node cloudflare/private-12-guide-render-local.mjs --evidence-only
echo "COMPLETE: no Cloudflare D1 writes, no Shopify actions, no public approval."
