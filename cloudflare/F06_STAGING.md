# F-06 — Abuse protection (STAGING ONLY)

**Not deployed.** This patch extends PR #3, which itself targets PR #2, and does not change `main`, Shopify, or the live Cloudflare Worker.

## Added
- `006-request-quotas.sql` creates `request_quotas` in D1. Inspect the live/staging schema and back up D1 before applying.
- `quota.js` uses a SHA-256 digest of a secret pepper, Cloudflare-provided client IP, endpoint and fixed time bucket. No raw IP is stored in D1. D1 atomic `INSERT ... ON CONFLICT ... WHERE count < limit` prevents simultaneous requests exceeding the quota.
- `POST /checkout`: 8 attempts per hour per IP; HTTP 429 when exhausted.
- `POST /recover/request`: 5 requests per hour per IP; continues to return the same generic 202 response so the limit cannot be used to enumerate purchasers.
- `POST /recover/consume`: 15 attempts per hour per IP; HTTP 429 when exhausted.
- If the D1 database, secret `ABUSE_HASH_PEPPER` (32+ characters), or Cloudflare trusted IP header is missing, endpoints fail closed (503) instead of allowing unlimited requests.
- Tests: `node --test cloudflare/tests/quota.test.mjs` (new regression suite; **not yet executed against a deployed Worker**).

## Configuration before staging tests
1. Apply migrations 001 through 006 **in order** to a staging D1 database after inspecting its current schema.
2. Set `ABUSE_HASH_PEPPER` as a Cloudflare secret (a fresh random secret, not a user password or an email pepper).
3. Run on actual Cloudflare Workers to ensure `CF-Connecting-IP` is present and trusted; local unit tests must supply it explicitly.
4. Validate shared-network behavior: many diaspora customers may use one IP. Tune 8/5/15 based on observed legitimate usage and add rate-limit response messaging.
5. Periodically purge stale quota buckets (e.g. older than 48 hours) using a controlled scheduled task. This patch does not create a scheduler.

## Important limitations
- **F-06 is not fully resolved.** Rate limiting reduces request volume but does not authenticate the *initial* case creation. The client still supplies `case_id`; someone who learns an unused ID can initiate its first checkout. The correct next step is a server-issued, authenticated evaluation session before any checkout.
- Per-IP limits do not stop distributed abuse or attacks from many IP addresses. Consider Cloudflare WAF/bot protections and account-level quotas.
- The existing recovery request limit of three emails per case per hour is retained.
- No real Shopify or Cloudflare staging test has been performed by this change.
