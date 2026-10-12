# ActeRO — Cloudflare Worker + D1 (Draft PR #3 only)

The only maintained backend is `cloudflare/worker.js`. The old KV-based `backend/` directory has been removed **from this draft branch only**. The public source tree has no premium guide scripts or secrets.

## API contract in this branch

- `POST /session`: server issues a case ID + one-time ownership secret, stored as a hash (expires in 48 hours).
- `POST /checkout`: requires a valid server-issued session on first checkout, or the existing access token for a pending retry; creates a Shopify checkout link only when enabled, a matching D1 guide exists, and other security requirements pass.
- `POST /webhooks/shopify/orders-paid`: HMAC-verified paid order event, logged to D1. Unfulfilled orders are flagged for operator review.
- `POST /webhooks/shopify/refunds-create`, `/orders-cancelled`, `/disputes-create`: authenticated order revocation/tombstone handlers.
- `GET /access`: access status; returns `paid:false` after revocation.
- `GET /guide-script`: returns only the **purchased guide_key**, after a paid grant. Requires `X-Actero-Access-Token` header.
- `GET /guide`: legacy route-wide access **removed (410)** to prevent cross-country leakage.
- `POST /recover/request` and `/recover/consume`: email + Shopify order recovery using one-use links (30-minute expiry), with access rotation.
- `quota.js`: per-source-IP fixed-window quotas in D1. These reduce abuse but do not replace firewall, logging or a real staging audit.

## Proposed schema changes (STAGING ONLY)

Inspect the actual D1 schema and take a backup BEFORE applying any migration. The numbered files `001` through `007` are ordered incremental migrations, not a complete fresh-install schema. Existing databases may already have some columns/tables.

```
001-guide-variants.sql
002-shopify-checkout.sql
003-payment-events.sql
004-revocations.sql
005-recovery.sql
006-request-quotas.sql
007-evaluation-sessions.sql
```

Do not execute these on live D1 merely because GitHub tests passed. A full baseline `schema.sql` and private guide import procedure are not yet reproducible from this repository (audit issue F-14).

## Staging secrets and configuration

The Cloudflare Worker needs correctly bound D1 plus HMAC/email/alert/abuse-prevention secrets. Never commit or paste actual values. In particular, `ABUSE_HASH_PEPPER`, `SHOPIFY_WEBHOOK_SECRET`, `PAYMENT_ALERT_WEBHOOK_URL`, `RECOVERY_EMAIL_API_KEY`, `RECOVERY_EMAIL_PEPPER`, and `RECOVERY_EMAIL_FROM` require staging review.

Public `../actero-config.js` is deliberately **empty**, which disables checkout in the draft. Only configure a production/staging HTTPS Worker endpoint with a reviewed, domain-specific deployment. The Worker currently uses the old `mypape-dot.github.io` origin; migrating to a dedicated domain requires updating CORS and URLs in both backend and frontend.

The previous audit noted a Cloudflare Worker labeled `0.5.0` and 43 historical guide scripts, but **current live deployment code, DB schema, 43 D1 scripts and Shopify merchant settings were not independently checked by this branch**. Do not report them as verified or ready for sale.

## Required pre-launch reviews

- `F01_RELEASE_SECURITY.md`: fresh-history public repository, retire old GitHub Pages serving.
- `GUIDE_CONTENT_QA.md`, `guide-review-tracker.csv`: official-source review of each of the 43 expected guide variants.
- `F06_STAGING.md`, `RECOVERY_STAGING.md`, `REVOCATION_STAGING.md`: operational and email/security prerequisites.
- Real Shopify Test Mode checkout -> signed webhook -> correct guide -> recovered guide -> refund/dispute revocation.
- Browser QA in mobile Safari/desktop (including PDF previews, navigation, blocked cases and localized text).

**This is staging code, not an active secure payments deployment.**
