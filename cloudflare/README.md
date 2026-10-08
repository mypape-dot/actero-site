# ActeRO — protected guides (DRAFT, not deploy-ready)
This branch stages the public frontend and Cloudflare Worker code only. Premium guide templates and their D1 seed must remain **private** and are intentionally NOT in this public repository.

## Changes
- `index.html` no longer contains the large paid-guide rendering function declarations. It loads a grant-specific JavaScript guide script after server-side access confirmation.
- `cloudflare/worker.js` adds `GET /guide-script?case_id=...&guide_key=...` with paid grant checks, route matching and variant-specific access. `/access` and the preexisting `/guide` JSON test remain.
- `cloudflare/001-guide-variants.sql` adds the `guide_key` column and the private `guide_scripts` table.

## Do not deploy until
1. Apply the D1 migration and import the private seed from the separate package.
2. Deploy updated Worker, verify paid and unpaid flows with D1; remove the temporary TEST-001 grant afterwards.
3. Implement verified Shopify checkout and paid-order HMAC webhook so the backend records both route and guide_key.
4. Address the old public GitHub history, which still contains previously published paid guide texts. Deleting text from the current HTML **does not erase history**.
5. Move towards a structured JSON guide API and proper signed payment entitlement tokens. case_id alone is not a production-grade authenticated session.

Checkout and Shopify webhook intentionally return HTTP 501. The public live site on `main` is unchanged. Do not merge this draft.
