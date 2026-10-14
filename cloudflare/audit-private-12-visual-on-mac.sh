#!/usr/bin/env bash
# Read-only operator-side renderer QA. No private guide source written to disk.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"
OUT="$HOME/actero-private-12-visual-qa-20261014"
if [[ $# -ge 1 ]]; then OUT="$1"; fi
if [[ ! "$OUT" = /* ]]; then
  echo "BLOCKED: use an absolute private output folder outside the repository."
  exit 2
fi
if [[ -e "$OUT" ]]; then
  echo "BLOCKED: output folder already exists. Choose a new private folder."
  exit 2
fi
echo 'Checking Wrangler CLI interactively BEFORE piping private D1 output.'
npx wrangler --version
echo 'Running READ-ONLY local D1 -> offline Chromium/WebKit visual diagnostics.'
set +e
npx wrangler d1 execute actero-db --remote --json \
  --command "SELECT guide_key,route,script_js FROM guide_scripts WHERE guide_key IN ('B1_FR','B1_BE','B1_NL','B1_IE','B5_RENEWAL_FR','B5_RENEWAL_BE','B5_RENEWAL_NL','B5_RENEWAL_IE','B5_LOST_FR','B5_LOST_BE','B5_LOST_NL','B5_LOST_IE') ORDER BY guide_key" \
  | node cloudflare/private-12-guide-render-local.mjs "$OUT"
status=$?
set -e
if [[ -d "$OUT" ]]; then
  echo 'Private screenshots and code-free summary are on this Mac only.'
  if command -v open >/dev/null 2>&1; then open "$OUT"; fi
fi
exit "$status"
