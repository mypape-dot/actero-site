# ActeRO — draft of the protected digital guide

**NOT A PRODUCTION RELEASE.** This repository contains a public frontend and a Cloudflare Worker backend, but it must not be used to accept real payments until the security, content, Shopify and operational checks are complete.

## Project layout

- `index.html` — public questionnaire, result and preview of the paid offer; **no premium guide text**.
- `confirmare.html` — post-checkout payment confirmation.
- `recuperare.html` — cross-device email recovery of a paid guide.
- `actero-config.js` — **nonsecret**, centralized public API URL; left empty to disable checkout in this draft.
- `cloudflare/worker.js` — **the sole supported Worker implementation** (D1, not the obsolete KV Worker).
- `cloudflare/001…007-*.sql` — proposed staging migrations. They have **not** been applied to the live database.
- `cloudflare/guide-catalog.json` — metadata for the 43 expected guide keys; it contains no paid instructions and does not confirm which scripts exist in D1.
- `cloudflare/guide-review-tracker.csv` and `cloudflare/GUIDE_CONTENT_QA.md` — individual official-source/content/mobile QA gate.
- `scripts/check-public-surface.mjs` — regression check for accidental exposure of paid guides.
- `.github/workflows/actero-release-guard.yml` — CI that runs the security and routing checks.

## Important release constraints

1. This work is deliberately on **Draft PR #3, based on PR #2**, not on `main`. No production Cloudflare, Shopify, or Pages service is changed by commits to this branch.
2. `main` and historical Git commits still expose old paid guide texts. **Merging a clean branch into `main` does not erase the old history.** Plan a fresh public repository with a new history as explained in `cloudflare/F01_RELEASE_SECURITY.md`.
3. Keep private guide scripts, Cloudflare D1 exports, Shopify secrets, email API credentials and customer details out of GitHub.
4. This draft disables checkout via `actero-config.js`. Staging configuration requires a deliberately selected HTTPS Worker URL and matching Worker CORS, email-recovery link and return URL settings. Never insert secrets in the public configuration file.
5. The script count (43) is **expected**, not verified against deployed D1. Every guide requires source review before being marked ready to sell.

## Local security checks (Node 22+)

```bash
node scripts/check-public-surface.mjs
node --test cloudflare/tests/guide-catalog.test.mjs cloudflare/tests/protected-guide-access.test.mjs
node --test cloudflare/tests/evaluation-session.test.mjs cloudflare/tests/checkout-frontend.test.mjs
node --test cloudflare/tests/quota.test.mjs cloudflare/tests/recovery.test.mjs cloudflare/tests/recovery-page.test.mjs cloudflare/tests/swiss-loop.test.mjs
node --no-warnings cloudflare/tests/audit-payment.test.mjs
```

CI passing does not replace a staging D1 migration, real Shopify Test Mode payment, official procedure verification or mobile Safari testing.
