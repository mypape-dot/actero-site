# ActeRO — Cloudflare Worker + D1 (Draft only)

The only maintained backend is `cloudflare/worker.js`. The old KV-based `backend/` directory has been removed **from this draft branch only**. The public source tree has no premium guide scripts or secrets.

## API contract in this branch

- `POST /session`: server issues a case ID + one-time ownership secret, stored as a hash (expires in 48 hours).
- `POST /checkout`: requires a valid server-issued session on first checkout, or the existing access token for a pending retry; creates a Shopify checkout link only when enabled, a matching D1 guide exists **and an approved SHA-256 fingerprint for that exact guide script matches** (migration 008); the four country-shared B5 keys also require **all 10 country reviews** (migration 009), and other security requirements pass.
- `POST /webhooks/shopify/orders-paid`: HMAC-verified paid order event, logged to D1. Unfulfilled orders are flagged for operator review.
- `POST /webhooks/shopify/refunds-create`, `/orders-cancelled`, `/disputes-create`: authenticated order revocation/tombstone handlers.
- `GET /access`: access status; returns `paid:false` after revocation.
- `GET /guide-script`: returns only the **purchased guide_key**, after a paid grant and a matching, still-approved exact content fingerprint; shared B5 scripts also need all 10 country approvals. Requires `X-Actero-Access-Token` header. When approvals are withdrawn or scripts change, purchasers may require support/refund; retaining older purchased versions is not implemented.
- `GET /guide`: legacy route-wide access **removed (410)** to prevent cross-country leakage.
- `POST /recover/request` and `/recover/consume`: email + Shopify order recovery using one-use links (30-minute expiry), with access rotation.
- `quota.js`: per-source-IP fixed-window quotas in D1. These reduce abuse but do not replace firewall, logging or a real staging audit.

## Proposed schema changes (STAGING ONLY)

Inspect the actual D1 schema and take a backup BEFORE applying any migration. The numbered files `001` through `010` are ordered incremental migrations, not a complete fresh-install schema. Existing databases may already have some columns/tables.

```
001-guide-variants.sql
002-shopify-checkout.sql
003-payment-events.sql
004-revocations.sql
005-recovery.sql
006-request-quotas.sql
007-evaluation-sessions.sql
008-guide-approvals.sql
009-guide-country-approvals.sql
010-order-uniqueness.sql
```

Do not execute these on live D1 merely because GitHub tests passed. The local harness now bootstraps an empty synthetic database from `tests/fixtures/local-baseline.sql` and migrations 001–010. This fixture is NOT a claim about the live schema. The private guide import and actual database upgrade/backup procedure remain unverified (audit issue F-14). Migration 010 must stop for operator review if duplicate order IDs already exist; it never deletes grants.

## Staging secrets and configuration

`SHOPIFY_PAYMENT_MODE` defaults to `test`: paid events require the literal JSON
boolean `test: true`. The explicit value `live` requires `test: false`; unknown
values block checkout and route paid events to operator review. This setting does
not control Shopify Test Mode and cannot prevent a merchant checkout from charging
a real card. Verify Shopify separately before any hosted test. No live mode is
enabled by this branch.

For current reproducible test commands and limits, see
[`LOCAL_PAYMENT_STAGING.md`](LOCAL_PAYMENT_STAGING.md) and
[`TECHNICAL_AUDIT_2026-10-15.md`](TECHNICAL_AUDIT_2026-10-15.md).

The Cloudflare Worker needs correctly bound D1 plus HMAC/email/alert/abuse-prevention secrets. Never commit or paste actual values. In particular, `ABUSE_HASH_PEPPER`, `SHOPIFY_WEBHOOK_SECRET`, `PAYMENT_ALERT_WEBHOOK_URL`, `RECOVERY_EMAIL_API_KEY`, `RECOVERY_EMAIL_PEPPER`, and `RECOVERY_EMAIL_FROM` require staging review.

Public `../actero-config.js` is deliberately **empty**, which disables checkout in the draft. Only configure a production/staging HTTPS Worker endpoint with a reviewed, domain-specific deployment. The Worker currently uses the old `mypape-dot.github.io` origin; migrating to a dedicated domain requires updating CORS and URLs in both backend and frontend.

The previous audit noted a Cloudflare Worker labeled `0.5.0` and 43 historical guide scripts, but **current live deployment code, DB schema, 43 D1 scripts and Shopify merchant settings were not independently checked by this branch**. Do not report them as verified or ready for sale.

## Required pre-launch reviews

- `F01_RELEASE_SECURITY.md`: fresh-history public repository, retire old GitHub Pages serving.
- `D1_PRIVATE_AUDIT_RUNBOOK.md`: metadata-only D1 inventory and private exact-script approval procedure; **not yet run against real D1**.
- `GUIDE_CONTENT_QA.md`, `guide-review-tracker.csv`: official-source review of each of the 43 expected guide variants.
- `F06_STAGING.md`, `RECOVERY_STAGING.md`, `REVOCATION_STAGING.md`: operational and email/security prerequisites.
- Real Shopify Test Mode checkout -> signed webhook -> correct guide -> recovered guide -> refund/dispute revocation.
- Browser QA in mobile Safari/desktop (including PDF previews, navigation, blocked cases and localized text).

**This is staging code, not an active secure payments deployment.**

## Guide review lock (Draft only)

Migration `008-guide-approvals.sql` creates a private approval table with no pre-approved guides. A stored paid guide is **not sellable** in the proposed Worker until a reviewer approves the exact SHA-256 hash of its D1 `script_js`. For `B5_STOLEN`, `B5_DAMAGED`, `B5_DATA_CHANGE`, and `B5_MOVED`, **all 10 country-specific outputs** must additionally have separate, same-hash `approved` reviews in `guide_country_approvals`; no partial-coverage sale is permitted. Every content update invalidates its prior approval. Tests use fake-approved fixtures only; all 43 real guide approvals remain `NO`. Do not deploy this Worker to an environment with active paid purchasers until the new migration, inventory, customer-support fallback, and staging transactions have been reviewed.

## Shared B5 country approval lock (Draft branch only)

Four shared paid scripts render up to 40 country-specific results. The new
`guide-country-review-tracker.csv` lists all 40 obligations as **NO**. Migration
`009-guide-country-approvals.sql` starts empty. Approvals must correspond to
independent checks of the **actual private rendered output**, official Romanian
and foreign sources, required documents, fees, eligibility, and mobile usability.
Do not generate approvals automatically from this public CSV; the true D1 review
register and script fingerprint must remain private. A single country approval
never authorizes checkout for the shared key: all 10 must be approved, or checkout
returns 409. Missing migration fails closed (500). Missing/revoked/mismatched
approval blocks delivery to existing buyers as well; this is staging-only code
requiring support/refund planning before a production deployment.

**No migration, Shopify action, D1 change, merge or deployment has been performed.**
