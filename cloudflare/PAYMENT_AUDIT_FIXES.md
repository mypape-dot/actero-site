# ActeRO — F-02 / F-05 fixes (STAGING ONLY)

**NOT DEPLOYED. Do not merge or enable real payments.** This branch starts from PR #2 (Worker 0.5.0). The original public `main`, Cloudflare deployment and Shopify store have not been changed by these fixes.

## F-05 — pending checkout token hijack
- Initial `POST /checkout` still creates a case and returns `accessToken`.
- A repeat checkout for the same pending `case_id` must include the existing `X-Actero-Access-Token` header. Otherwise it returns `409 case_in_progress` **without replacing the existing token**.
- The D1 write uses a conditional compare-and-swap plus an intent insert conditional on the newly issued token. Concurrent unauthenticated requests cannot silently rotate a pending token.
- **Frontend follow-up required:** `startShopifyCheckout()` must send the saved token on retries, persist the new access token before navigation, and explain `case_in_progress`. Until this is integrated, legitimate retries return 409.

## F-02 — paid webhook without fulfilled access
- Migration `003-payment-events.sql` adds a durable `payment_events` table (apply once **only after inspecting actual D1 schema and backup**, following migrations 001/002).
- Each Shopify `orders/paid` webhook with valid HMAC and expected shop records a result, keyed by `X-Shopify-Webhook-Id` (fallback: deterministic digest of payload).
- A paid ActeRO order with missing or unknown checkout property, unexpected discount/amount/currency/quantity, a second paid order for a case, or a missing/mismatched grant becomes `needs_review` rather than a silent HTTP 200.
- A `needs_review` event triggers a private Discord-compatible alert. Configure Cloudflare secret `PAYMENT_ALERT_WEBHOOK_URL` with a private, operator-controlled webhook URL. **Do not commit or paste the URL.** If alert delivery fails, backend returns 503 to request Shopify retry. Incident remains in D1.
- `POST /checkout` now requires alert URL configuration in addition to the previous checkout feature flag, DB and HMAC secret.
- **Manual resolution still required:** `needs_review` does not automatically grant access or issue a refund. Check corresponding Shopify orders and incident log.

## Test coverage
A Node 22+ SQLite-in-memory harness reconstructed the basic D1 schema, applied migrations 001, 002, 003, and executed **35/35 passing local checks**: token replacement attempts, concurrent requests, authenticated retries, payments, missing properties, discounts, incorrect currency, duplicate orders, HMAC, alert failure and retry. These tests are simulations, not verification against deployed Cloudflare D1 or Shopify.

## Still blocking production
1. Inspect deployed Worker and D1 schema/migrations, then test against a separate staging Worker.
2. Adapt frontend checkout retry to send old token and persist newly issued token.
3. Configure/test the alert secret; verify a real Shopify Test Mode `orders/paid` payload, then test page -> checkout -> webhook -> guide.
4. Resolve F-01 (paid content public), F-03 (cross-device recovery), F-04 (refund/dispute revocation), F-06 (rate limits / unowned initial checkout) and F-07 (Swiss questionnaire loop).
5. Do not assume initial `case_id` proves case ownership. An attacker aware of the case ID before the first checkout can still preempt creation. A server-issued case session is a future defense.

**Review-only branch:** no SQL migration, Worker deployment, GitHub Pages publication or Shopify setting was changed by this patch.
