#!/usr/bin/env bash
# ActeRO local authorized audit: the D1 premium scripts travel only over a
# local pipe from Wrangler into a read-only Node preflight. No JSON export saved.
# Never run this with shell -x or tee/cat; do not paste its input into chats.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if ! command -v node >/dev/null 2>&1; then
  echo 'BLOCKED: Node.js is required.'
  exit 2
fi
echo 'Running READ-ONLY D1 SELECT on 12 guide scripts; output is a private code-free summary.'
# --no-install avoids silently installing an unreviewed Wrangler CLI. If
# Wrangler isn't installed, ask the owner to install it deliberately.
npx --no-install wrangler d1 execute actero-db --remote --json \
  --command "SELECT guide_key, route, script_js FROM guide_scripts WHERE guide_key IN ('B1_FR','B1_BE','B1_NL','B1_IE','B5_RENEWAL_FR','B5_RENEWAL_BE','B5_RENEWAL_NL','B5_RENEWAL_IE','B5_LOST_FR','B5_LOST_BE','B5_LOST_NL','B5_LOST_IE') ORDER BY guide_key" \
  | node cloudflare/private-12-guide-preflight-local.mjs --stdin
