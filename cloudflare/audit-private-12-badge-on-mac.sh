#!/usr/bin/env bash
# Authorized owner only. D1 SQL is SELECT only; private JS stays on this Mac.
# A draft is never applied to D1, deployed or marked editorially approved.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"
OUT="$HOME/actero-private-12-badge-review-20261014"
if [[ $# -ge 1 ]]; then OUT="$1"; fi
if [[ "$OUT" != /* || -e "$OUT" || -e "$OUT-visual" ]]; then
  echo "BLOCKED: use a new absolute private output folder outside the repo."
  exit 2
fi
# Protect against hidden npx confirmation during streaming.
npx wrangler --version
echo 'Preparing an UNDEPLOYED editorial wording draft from READ-ONLY Cloudflare D1...'
npx wrangler d1 execute actero-db --remote --json \
  --command "SELECT guide_key,route,script_js FROM guide_scripts WHERE guide_key IN ('B1_FR','B1_BE','B1_NL','B1_IE','B5_RENEWAL_FR','B5_RENEWAL_BE','B5_RENEWAL_NL','B5_RENEWAL_IE','B5_LOST_FR','B5_LOST_BE','B5_LOST_NL','B5_LOST_IE') ORDER BY guide_key" \
  | node cloudflare/prepare-private-12-badge-draft.mjs "$OUT"
echo 'Review draft is stored locally. Confirm visual QA without deployment.'
# In a separate folder, run offline visual QA using the private draft as stdin.
set +e
node cloudflare/private-12-guide-render-local.mjs "$OUT-visual" < "$OUT/private-draft.json"
status=$?
set -e
echo 'Only the local summary and flags may be shared. Never attach private-draft.json or premium images.'
if command -v open >/dev/null 2>&1; then
  open "$OUT-visual" 2>/dev/null || true
fi
exit "$status"
