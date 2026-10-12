# ActeRO F-01 — Public source separation and release safety

**State: source-tree guard PASS in PR #3; historical disclosure NOT remediated.**

This file is a deployment plan, not a record of a completed migration. Existing `main` and GitHub Pages were not changed.

## What is confirmed

- On `main`, `index.html`, `ActeRO_QA_v2.html`, `ActeRO_index_corectat.html`, and earlier QA files contain full guide-generation functions. These are accessible through public GitHub and potentially GitHub Pages.
- On PR #3, the root contains only `index.html`, `confirmare.html`, and `recuperare.html` as HTML documents. Definitions of premium functions such as `showB1ESValidatedGuide` are absent; they are fetched by the authenticated `/guide-script?case_id=...&guide_key=...` flow after payment.
- A CI guard now rejects extra public HTML documents, `qa/`, obsolete `backend/`, and known premium guide function definitions. It is deliberately a **regression detector**, not a comprehensive security proof.
- The old route-level `GET /guide` endpoint is now **410 Gone** in the PR #3 Worker, preventing access to other country material with a token for a shared route (F-12). URL access tokens have been removed (F-13).

## Required release migration (NOT performed)

1. Finish reviewing PR #3 without publishing the existing contaminated history. Preserve private backups of the original guide content outside the public repository.
2. Create a **new empty public repository with a new Git history**. Copy an audited snapshot of allowed release files from PR #3, never merge or fork the contaminated repository into the new one.
3. Do not copy `ActeRO_QA_v2.html`, `ActeRO_index_corectat.html`, `qa/`, `backend/`, premium function source files, raw D1 databases, guide exports, Shopify secrets or private client data. Keep D1 premium scripts solely on Cloudflare, with restricted operator access.
4. Run `node scripts/check-public-surface.mjs` and CI tests before setting up hosting.
5. Prefer a **dedicated origin/domain** for the new site so localStorage access is isolated from other unrelated GitHub Pages projects (F-15). Update Worker CORS origin allowlist, frontend API URL, recovery page URL, Shopify return URLs, email links and the trusted domain policy together. The current Worker is hardcoded to `https://mypape-dot.github.io`, so simply moving the page to a new origin would otherwise break the API.
6. Configure a separate staging Worker + D1 and migrate the schema in order, after backup and schema inspection; do not put premium data into GitHub. Verify D1 `guide_scripts` metadata against the 43-key catalog before any real checkout.
7. Run real Shopify **Test Mode** flows and check refunds, cancellation, dispute, recovery, duplicate webhooks and no-access cases; then conduct mobile Safari/desktop usability tests.
8. Only after the replacement site works: deliberately retire public serving from the old GitHub Pages project and update links. Existing old clones, cached copies, forks and historical commits may still exist; switching domains does **not** undo a past disclosure.
9. Require manual approval for enabling checkout, D1 migrations in production, or changes to Shopify/domain settings.

## Read-only metadata verification, without copying paid guide text

Run against an isolated staging D1 database:

```sql
SELECT guide_key, route FROM guide_scripts ORDER BY guide_key;
SELECT COUNT(*) AS variant_count FROM guide_scripts;
SELECT route, COUNT(*) AS variant_count FROM guide_scripts GROUP BY route ORDER BY route;
```

Compare the first result against `cloudflare/guide-catalog.json` (43 unique expected `guide_key` values). A count of 43 alone is **not** sufficient: each key must match the right route, and each script still requires source and content review. Do not commit the `script_js` column or SQL database export to a public repository.

## No irreversible actions were performed

No existing public repository or Pages project was deleted, privatized or rewritten. We did not create or point a production domain at a new site and did not deploy this Worker.

GitHub's documentation explains that rewriting history does not remove copies held by forks, clones and cached references:
https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
