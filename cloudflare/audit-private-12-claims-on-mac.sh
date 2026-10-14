#!/usr/bin/env bash
# ActeRO: strictly READ-ONLY source metadata inventory, prints COUNTS ONLY.
# Never write D1 scripts to disk, GitHub or a shared terminal log.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"
echo "Checking Wrangler before the private read-only pipe."
npx wrangler --version
echo "Inspecting 12 guide text markers: counts only, no guide content."
npx wrangler d1 execute actero-db --remote --json \
 --command "SELECT guide_key,route,script_js FROM guide_scripts WHERE guide_key IN ('B1_FR','B1_BE','B1_NL','B1_IE','B5_RENEWAL_FR','B5_RENEWAL_BE','B5_RENEWAL_NL','B5_RENEWAL_IE','B5_LOST_FR','B5_LOST_BE','B5_LOST_NL','B5_LOST_IE') ORDER BY guide_key" \
 | node cloudflare/inventory-private-12-claims-local.mjs --stdin
echo "Finished: zero edits, zero approvals, zero uploads."
