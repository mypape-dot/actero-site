# ActeRO — questionnaire engine QA and safe integration notes

**Current source:** `index.html` on Draft PR #3, based on PR #2. No premium guide definitions are present in the public frontend.

## Source comparison with historical QA files

A prior independent audit compared `main`, `ActeRO_QA_v2.html`, `ActeRO_QA_auditat.html` and the Swiss candidate. Those full historical files are **not** suitable to copy wholesale into public GitHub because they contain paid guide implementations or incompatible checkout logic.

Differences reviewed individually:

- **`q006` (document status, Back navigation): ported from `ActeRO_QA_auditat.html`. Every selected document status now pushes a snapshot *before* changing state. The final status transitions via `replace('AFTER_DOCS')`, avoiding a redundant snapshot and the risk of returning to a finished document queue.
- **`afterDocs` for urgent travel:** deliberately retained from the protected PR base/audited candidate. It flags a contradiction when a passport is marked valid but otherwise proceeds to destination/context questions. The older `ActeRO_QA_v2.html` stopped immediately for a valid national ID, which may be overly broad for destination-specific eligibility; it was not copied.
- **`showStop`:** no wholesale replacement. A previous QA variant preserved the specific `STOP_...` identifier instead of the status color. This must be evaluated together with `STOP_SCREENS`, persistence and refresh behavior before porting.
- **`showResult` / `unlockGuide`:** deliberately retained the paid access gate from PR #3. Never import the old preview/unlock behavior that might show premium guides without a Shopify grant.
- **Swiss OTHER-document route:** already terminates at an explanatory no-payment screen instead of repeating Q109/Q125 (F-07).
- **Paywall:** case context, blocker notice and benefits copied from verified public metadata, not fictional customer reviews.

## Automated checks and current limits

- `cloudflare/tests/quiz-history.test.mjs` exercises the real `q006()` and `afterDocs()` functions extracted from `index.html`, including the Back snapshot and urgent-travel behavior.
- `cloudflare/tests/guide-catalog.test.mjs` checks that the router maps 43 metadata entries to the expected `guide_key`. This confirms internal routing, **not** the legal correctness of any procedure.
- `cloudflare/tests/swiss-loop.test.mjs` checks CH OTHER/G/B/C/L branches.
- Additional payment/backend tests cover session ownership, access token boundaries, refunds and recovery.

## Next true E2E checks

1. Run real browser/mobile automated tours across all 10 countries with random but valid scenarios, a deterministic seed and back/refresh operations.
2. Test each distinct `guide_key` after a Shopify Test Mode order, using its private D1 script: a key selected in the client must exist in D1 and render the expected documents/steps.
3. Explicitly test all STOP outcomes and make sure the user is not charged if a route is uncertain or a missing prerequisite invalidates the guide.
4. Test document previews and downloads on current Safari mobile/desktop and accessibility preferences.
5. Review all 43 paid scripts against current official sources; automated router tests do not verify fees, terms, eligibility, or eConsulat details.

**Do not claim the full engine or 43 paid guides are legally verified until all of these checks pass.**
