# ActeRO F-04 — Refunds, cancellations and disputes (STAGING ONLY)

**Not deployed. Do not apply this migration to the public Worker without checking the actual D1 schema and making a backup.** This change is layered on PR #3 / existing PR #2; it does not create another Worker or database.

## D1 migration

After the existing migrations 001, 002 and 003, apply **004-revocations.sql** to an isolated staging D1 database. It adds two nullable columns to `access_grants` (`revoked_at` and `revoked_reason`) plus `order_revocations` and `revocation_events`.

The existing `status='paid'` is retained even when revoked, so the Worker always checks `revoked_at` when returning `paid`, `/guide-script` or `/guide`. Do not deploy the new Worker before migration 004 or `GET /access` will fail because `revoked_at` does not exist.

## Shopify subscriptions to configure in STAGING

Use the same Worker / Shopify HMAC secret as orders/paid but distinct topics and paths:

| Shopify topic | Worker POST path |
| --- | --- |
| `refunds/create` | `/webhooks/shopify/refunds-create` |
| `orders/cancelled` | `/webhooks/shopify/orders-cancelled` |
| `disputes/create` | `/webhooks/shopify/disputes-create` |

Keep the private `PAYMENT_ALERT_WEBHOOK_URL` secret configured and tested. Never paste or commit Shopify webhook secrets, D1 tokens or alert URLs.

The Worker validates the HMAC and exact Shopify shop/topic before any database modification. Responses with invalid HMAC are 401; wrong shop/topic 403.

## Revocation policy in this candidate

- `refunds/create`: automatically revoke **only** when `refund_line_items[].line_item.variant_id` matches the ActeRO product and refunded quantity is at least 1. For a refund with other variants, keep ActeRO access. For ambiguous money-only refund on an already paid ActeRO order, log `needs_review`, alert and leave access unchanged until an operator verifies it.
- `orders/cancelled`: revoke access for a matching Shopify order ID. A cancellation associated with an ActeRO line before payment creates a tombstone, preventing an out-of-order paid webhook from granting access.
- `disputes/create`: suspend existing access for that Shopify order pending manual operator review, including an inquiry. An event received before payment creates a tombstone.
- All affected events are saved in `revocation_events` and alerted; a failed alert returns 503 so Shopify can retry. The same event ID is idempotent.
- `order_revocations` is checked by the `orders/paid` handler. Granting paid access also uses `NOT EXISTS (SELECT 1 FROM order_revocations ...)` to defend against event races.
- Revocation is **not automatically reversed** when a dispute closes or a refund is cancelled; manual reinstatement is not implemented. Implement a controlled, audited reinstatement process before production.

**Shopify caveat:** `refunds/create` can fire when a refund is created, independently of actual movement of money. The access policy above reacts to a product-level refund event, not proof of a settled bank refund. Test against real Shopify Test Mode payloads; the payload schema for monetary-only adjustments is not fully covered here.

**Technical caveat:** the server can block future downloads; it cannot erase a guide script already loaded into a customer's browser.

## Regression checks

```bash
node --no-warnings cloudflare/tests/audit-payment.test.mjs
node --test cloudflare/tests/checkout-frontend.test.mjs
node --test cloudflare/tests/swiss-loop.test.mjs
```

The extended offline harness reports 35/35 F-02/F-05 and 28/28 F-04 passing; the repository `audit-payment.test.mjs` verifies 23/23. **These are local simulations**, not confirmation of the deployed D1/Shopify state.

## Launch blockers that remain

- **F-01:** premium guide scripts and historical QA versions remain public on `main` and in Git history.
- **F-03:** customers cannot recover their guide after losing the original browser.
- **F-06:** protection from abusive first-time checkout attempts and rate limiting not complete.
- **F-16:** no real Shopify Test Mode order -> HMAC webhook -> D1 grant -> guide end-to-end test.
- Legal/customer disclosure: refunds, disputes, digital-content withdrawal consent and transparent support process require review.
