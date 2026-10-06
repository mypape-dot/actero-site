# ActeRO payment backend

This Cloudflare Worker is the server-side payment gate for ActeRO.

## What it does

- `POST /checkout`: creates a Shopify cart for the ActeRO product and carries `actero_case_id` into the order.
- `POST /webhooks/orders-paid`: verifies Shopify's HMAC and unlocks the paid case only after an `orders/paid` event.
- `GET /access?case_id=...`: lets the ActeRO frontend check whether that case is paid.
- `GET /health`: health check.

## Required configuration

1. Create one Shopify product/variant for "Ghid personalizat ActeRO".
2. Create a Shopify custom app / Storefront API access token that can create carts.
3. Create a Cloudflare KV namespace and bind it as `ACTERO_ACCESS`.
4. Set:
   - `SHOPIFY_STORE_DOMAIN`
   - `SHOPIFY_VARIANT_GID`
   - `ALLOWED_ORIGINS`
5. Add Worker secrets:
   - `SHOPIFY_STOREFRONT_TOKEN`
   - `SHOPIFY_WEBHOOK_SECRET`
6. Subscribe Shopify to `orders/paid` with:
   - `https://YOUR-WORKER.workers.dev/webhooks/orders-paid`
7. Put the deployed Worker URL into `window.ACTERO_PAYMENT_API` in `index.html`.

## Security properties

- The browser never decides that payment succeeded.
- The Shopify webhook must pass HMAC verification.
- Only the configured Shopify variant can unlock a case.
- Case IDs are validated before storage or lookup.
- Shopify secrets are not committed to GitHub.

## Important

The current ActeRO evaluation state lives in the buyer's browser. V1 therefore expects the buyer to return on the same browser/device after checkout. Cross-device recovery should be added later only with an explicit privacy/data-retention design.

If the Shopify/payment-provider account has an age requirement, the store and payment account must be operated by an eligible adult account holder; do not bypass age or identity requirements.
