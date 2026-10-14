#!/usr/bin/env bash
# ActeRO: local-only offline rendered-text claim audit, READ-ONLY Cloudflare D1.
# No output files, screenshots, deployments or source-code logging.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"
npx wrangler --version
echo "Checking only what the client sees in 12 guides; no images or files saved."
npx wrangler d1 execute actero-db --remote --json \
  --command "SELECT guide_key,route,script_js FROM guide_scripts WHERE guide_key IN ('B1_FR','B1_BE','B1_NL','B1_IE','B5_RENEWAL_FR','B5_RENEWAL_BE','B5_RENEWAL_NL','B5_RENEWAL_IE','B5_LOST_FR','B5_LOST_BE','B5_LOST_NL','B5_LOST_IE') ORDER BY guide_key" \
  | node cloudflare/private-12-guide-render-local.mjs --claims-only
