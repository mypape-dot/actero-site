# ActeRO — F-02 / F-03 / F-04 / F-05 / F-07 fixes (STAGING ONLY)

**NOT DEPLOYED. Do not merge or enable real payments.** This branch starts from PR #2 (Worker 0.5.0). The original public `main`, Cloudflare deployment and Shopify store have not been changed by these fixes.

## F-05 — pending checkout token hijack
- Initial `POST /checkout` still creates a case and returns `accessToken`.
- A repeat checkout for the same pending `case_id` must include the existing `X-Actero-Access-Token` header. Otherwise it returns `409 case_in_progress` **without replacing the existing token**.
- The D1 write uses a conditional compare-and-swap plus an intent insert conditional on the newly issued token. Concurrent unauthenticated requests cannot silently rotate a pending token.
- **Frontend adapted on this branch:** `startShopifyCheckout()` now sends the saved token on retries, saves the returned replacement token before navigation, and explains `case_in_progress`, `case_route_changed`, and `already_paid`. Tested with nine local isolated checkout-function checks. This does not prove a deployed browser or Shopify payment.

## F-02 — paid webhook without fulfilled access
- Migration `003-payment-events.sql` adds a durable `payment_events` table (apply once **only after inspecting actual D1 schema and backup**, following migrations 001/002).
- Each Shopify `orders/paid` webhook with valid HMAC and expected shop records a result, keyed by `X-Shopify-Webhook-Id` (fallback: deterministic digest of payload).
- A paid ActeRO order with missing or unknown checkout property, unexpected discount/amount/currency/quantity, a second paid order for a case, or a missing/mismatched grant becomes `needs_review` rather than a silent HTTP 200.
- A `needs_review` event triggers a private Discord-compatible alert. Configure Cloudflare secret `PAYMENT_ALERT_WEBHOOK_URL` with a private, operator-controlled webhook URL. **Do not commit or paste the URL.** If alert delivery fails, backend returns 503 to request Shopify retry. Incident remains in D1.
- `POST /checkout` now requires alert URL configuration in addition to the previous checkout feature flag, DB and HMAC secret.
- **Manual resolution still required:** `needs_review` does not automatically grant access or issue a refund. Check corresponding Shopify orders and incident log.

## F-03 — email-based recovery of purchased guide
- `005-recovery.sql` adds a bounded evaluation snapshot, keyed email hash, and one-time recovery link records.
- A paid order's Shopify-verified email and order name are required to request recovery. `/recover/request` returns the same generic response for known or unknown orders.
- Resend sends a 30-minute, 256-bit one-time link. `/recover/consume` rotates the access token and returns the exact saved evaluation. Revoked orders cannot recover.
- A new `recuperare.html` page handles email requests, browser-state restoration, and redirects into the protected guide.
- **Recovery is staging code only:** emails cannot be sent without verified sender/provider keys, and `RECOVERY_REQUIRED=true` must be set before taking real payments.
- Tests: **15/15** dedicated Node/D1 regression, **6/6** simulated recovery-page checks; plus **61/61** extended local regression checks. See `RECOVERY_STAGING.md`.

## F-04 — refunds, cancelled orders and payment disputes
- Adds `004-revocations.sql` (revocation timestamps, order-level tombstones, revocation events) and three HMAC-verified Shopify webhook handlers.
- Product-level refund, order cancellation and dispute events revoke an existing grant or prevent a delayed paid event from granting it.
- Money-only refunds of a known paid order are flagged `needs_review`; revocation is not automatic when the refunded product cannot be identified. If such a refund arrives before paid, a tombstone blocks automatic grant pending review.
- Existing access endpoints check `revoked_at` before responding paid or serving any protected guide.
- **No Cloudflare migration or webhook subscriptions were installed.** See `REVOCATION_STAGING.md` for operational steps, manual-review policy and limitations.

## F-07 — Swiss document clarification loop
- `q109()` and `q125()` now route `OTHER` to `STOP_CH_OTHER` with an explanation and **no payment**, rather than returning to the same clarification.
- B, C, L and G paths remain unchanged. Existing `UNKNOWN` handling is unchanged.
- Eight local Swiss branching checks passed; a full live guided journey remains to be tested.

## Test coverage
A Node 22+ SQLite-in-memory harness reconstructed the basic D1 schema, applied migrations 001, 002, 003, 004, and executed **35/35 passing local checks**: token replacement attempts, concurrent requests, authenticated retries, payments, missing properties, discounts, incorrect currency, duplicate orders, HMAC, alert failure and retry. Additional isolated checks: **9/9 frontend checkout** and **8/8 Swiss OTHER-document branching**, exercised with local function fixtures. The repository also contains `cloudflare/tests/checkout-frontend.test.mjs` and `cloudflare/tests/swiss-loop.test.mjs`, which operate on its current `index.html`. Additional local F-04 simulation: **28/28 checks**. Repository `audit-payment.test.mjs` currently verifies **23/23 scenarios** including refund, cancellation, dispute, and out-of-order delivery. These tests are simulations, not verification against deployed Cloudflare D1 or Shopify.

## Still blocking production
1. Inspect deployed Worker and D1 schema/migrations, then test against a separate staging Worker.
2. Run frontend and backend together in a staging browser using actual D1 (the local functions and isolated tests passed, but no integration deploy has occurred).
3. Configure/test the alert secret; verify a real Shopify Test Mode `orders/paid` payload, then test page -> checkout -> webhook -> guide.
4. Resolve F-01 (paid content public), validate F-03 against a real email provider in staging, F-06 (rate limits / unowned initial checkout), test F-04 on real staging webhooks, and independently retest F-07 in the deployed questionnaire.
5. Do not assume initial `case_id` proves case ownership. An attacker aware of the case ID before the first checkout can still preempt creation. A server-issued case session is a future defense.

**Review-only branch:** no SQL migration, Worker deployment, GitHub Pages publication or Shopify setting was changed by this patch.
