# ActeRO — Paid guide content QA gate (43 variants)

**Status: ALL 43 variants require source verification and real checkout testing.**
This inventory is built from the frontend guide-key router. It does NOT claim scripts are deployed to Cloudflare D1 or that procedures are legally correct.

## Evidence and required checks per guide

The independent audit tested routing consistency but noted that a consistently incorrect legal procedure can pass every frontend test. For each entry in `guide-review-tracker.csv`, do not set `sale_approved=YES` until:

1. A reviewer identifies the exact official Romanian/foreign institution and checks an authoritative source that supports the stated procedure and applicant eligibility; record official URL, checked date, and responsible reviewer **privately**.
2. The fee, validity period, and processing time are verified or explicitly marked as variable. Never invent a fee or promise a precise deadline without an identifiable official source.
3. The user's situation (residence country, legal domicile, existing documents, expired/lost/stolen status, civil-record changes and required evidence) is consistent with the route and this exact `guide_key`.
4. The guide explicitly reflects any blockers displayed before checkout and clearly distinguishes missing prerequisites from an immediately actionable procedure.
5. Every referenced document has an accurate label and relevant official destination; a downloadable PDF link must go to the actual official PDF when advertised, rather than merely an informational landing page. Label reference pages as references, not forms to submit.
6. The actual private D1 guide script exists under the matching `guide_key` and `route`. Test the returned guide after a Shopify Test Mode transaction, not through direct public source inspection.
7. The guide is readable and complete on mobile Safari and desktop; no missing text, inaccessible PDF preview, duplicate information, technical status labels, blank steps or console errors.
8. Buyer recovery, refund revocation and cross-country isolation succeed; no one can buy a guide lacking verified instructions.
9. Unsupported uncertainty yields a clear explanation and **no checkout**. A verified badge may be shown only if it has a documented, recent, guide-specific verification log.

## Issues from the independent audit — NOT automatically corrected

| Audit ID | Check needed | Status |
|---|---|---|
| G-01 | Remove/revalidate blanket 'verified on 5 Oct 2026' claim across all 43 guides; not all procedures were independently corroborated. | Pending D1/source review |
| G-02 | Reconcile CEI fee wording across A1, C1, D2 and C5. DGEP rule checked 13 Oct 2026: first CEI free after age 13 years 11 months, new CEI 70 RON. Actual guide scripts still require review. | Official general rule corroborated; pending private-guide review |
| G-03 | Validate and include urgent consular travel fee, or explicitly say it varies. | Pending official confirmation |
| G-04 | Remove internal editorial note from A1 customer-facing step. | Confirmed in historical guide, private D1 not inspected |
| G-05 | Replace placeholder in C5 guide title. | Confirmed in historical guide, private D1 not inspected |
| G-06 | Verify proxy eligibility, traditional ID process and CEI restrictions in A2/A3. | Pending official confirmation |
| G-07 | Validate eConsulat steps after login with an authorized operator; do not assume unseen screens. | Pending real flow |
| G-08 | Label conflicting fee/time information from DGP vs eConsulat rather than silently choosing one. | Pending official confirmation |
| G-09 | UK eVisa officially replaces physical-status documents in standard cases (GOV.UK checked 13 Oct 2026); check its acceptance by Romanian consular/CRDS offices. Ireland documents and Belgian/Dutch links remain pending. | UK status rule corroborated; CRDS eligibility and other countries pending |
| G-10 | Perform new B5 route audit; original finding lacked sufficient detail to safely change text. | Pending |
| G-11 | Swiss SEM informational reference must not be labelled as an application form to submit. | Pending source/document review |
| G-12 | DGP confirms a general maximum of 60 working days for electronic-passport applications through Romanian missions in third countries, including Switzerland. Do not delete the rule without checking the specific submission/collection scenario. | General 60-day rule corroborated 13 Oct 2026; private-guide context pending |

The notes above reflect the audit's findings and confidence levels; they are not a substitute for checking the original government material and current service rules.

## Highest-risk product logic to recheck

- Country-dependent B5 routes share four keys: `B5_STOLEN`, `B5_DAMAGED`, `B5_DATA_CHANGE`, `B5_MOVED`. Verify each script branches correctly by country and document status; a common key must not imply an identical document list across Switzerland, Spain and other jurisdictions.
- Switzerland: distinguish permits B/C/L, G commuter status, other-document uncertainty, and the actual evidence needed for domicile. Do not accept or reject permit L universally without official policy review.
- A missing paid script or inconsistent route in D1 must block checkout, not silently show an empty guide.
- Do not mistake static router tests for a guarantee of correct or current administrative advice.

## Immediate next steps

1. Read-only verify D1 metadata `SELECT guide_key, route FROM guide_scripts` against `guide-catalog.json`; avoid exporting `script_js` to GitHub.
2. Review G-04/G-05 and claimed verification dates in a PRIVATE content environment, then verify dynamic fees/terms on official sources.
3. Mark each tracker row only after documented independent checks. Do not publish paid guides with unchecked claims.
4. Finish F-01 clean-history publication plan before enabling real payments.

**This file deliberately contains no paid guide instructions, customer data or D1 secrets.**

## Official rule-level review, 13 Oct 2026

The public-source evidence and limitations are recorded in [`GUIDE_OFFICIAL_SOURCE_AUDIT_2026-10-13.md`](GUIDE_OFFICIAL_SOURCE_AUDIT_2026-10-13.md). This updates **general fact-check notes only**, not the 43 individual approval states. Do not use it to bypass private D1 content review.
