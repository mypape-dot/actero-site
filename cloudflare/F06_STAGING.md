# F-06 — Abuse protection (STAGING ONLY)

**Not deployed.** This patch extends PR #3, which itself targets PR #2, and does not change `main`, Shopify, or the live Cloudflare Worker.

## Additional ownership hardening (007)
- `007-evaluation-sessions.sql` adds `evaluation_sessions` for server-issued `case_id` and a **hashed** 256-bit secret that expires in 48 hours.
- `POST /session` issues the new case and secret, with the same Cloudflare source-IP quota (8/hour). The client saves both and rebinds its existing questionnaire answers to this case before starting checkout.
- **First `POST /checkout` must include `X-Actero-Session-Token`**, which must match the server-issued session. A guessed or leaked case ID alone cannot start checkout. After checkout is pending, existing `X-Actero-Access-Token` still authorizes retries, including cases started before this change.
- Explicit CORS allow-header added for the session secret. Never put this secret in URL parameters.
- **Migration 007 must exist before deploying this Worker or /session will fail.**
- The actual Worker was tested against a simulated D1 database: 10/10 ownership checks, plus re-run 23/23 payment and 15/15 recovery checks in the local harness. Browser/UI source inspection is separate from live Shopify verification.

## Added
- `006-request-quotas.sql` creates `request_quotas` in D1. Inspect the live/staging schema and back up D1 before applying.
- `quota.js` uses a SHA-256 digest of a secret pepper, Cloudflare-provided client IP, endpoint and fixed time bucket. No raw IP is stored in D1. D1 atomic `INSERT ... ON CONFLICT ... WHERE count < limit` prevents simultaneous requests exceeding the quota.
- `POST /checkout`: 8 attempts per hour per IP; HTTP 429 when exhausted.
- `POST /recover/request`: 5 requests per hour per IP; continues to return the same generic 202 response so the limit cannot be used to enumerate purchasers.
- `POST /recover/consume`: 15 attempts per hour per IP; HTTP 429 when exhausted.
- If the D1 database, secret `ABUSE_HASH_PEPPER` (32+ characters), or Cloudflare trusted IP header is missing, endpoints fail closed (503) instead of allowing unlimited requests.
- Tests: `node --test cloudflare/tests/quota.test.mjs` (new regression suite; **not yet executed against a deployed Worker**).

## Configuration before staging tests
1. Apply migrations 001 through 007 **in order** to a staging D1 database after inspecting its current schema.
2. Set `ABUSE_HASH_PEPPER` as a Cloudflare secret (a fresh random secret, not a user password or an email pepper).
3. Run on actual Cloudflare Workers to ensure `CF-Connecting-IP` is present and trusted; local unit tests must supply it explicitly.
4. Validate shared-network behavior: many diaspora customers may use one IP. Tune 8/5/15 based on observed legitimate usage and add rate-limit response messaging.
5. Periodically purge stale quota buckets (e.g. older than 48 hours) using a controlled scheduled task. This patch does not create a scheduler.

## Important limitations
- **F-06 has server-issued first-checkout ownership**, but still needs a real staging browser test, rate-limit tuning, and long-term session retention/deletion policy. The session is issued when payment begins, not at the first question.
- Per-IP limits do not stop distributed abuse or attacks from many IP addresses. Consider Cloudflare WAF/bot protections and account-level quotas.
- The existing recovery request limit of three emails per case per hour is retained.
- No real Shopify or Cloudflare staging test has been performed by this change. The shared GitHub Pages origin and frontend storage exposure (F-15) still need a dedicated domain and CSP.
