# ActeRO — B5 granular document-checklist QA (13 October 2026)

**Status:** synthetic regression PASS; private Mac test not yet executed. NO Cloudflare D1 migration, Shopify change, merge or sale approval.

## Objective

The historical shared B5 generator marked the CRDS passport as `ok:true` in its sidebar checklist even in a `DAMAGED` case, and grouped many different legal documents under one "civil status" row. Those cues may confuse users about what must be prepared and what has been verified by a consulate.

## Draft changes (local only)

The new `cloudflare/prepare-b5-checklist-review.mjs` transforms the **existing operator-owned five-change B5 UK draft** into a separate private draft, requiring 2 identical B5 scripts with matching route, and refusing to overwrite any existing file. It replaces one checklist-data block and one status-style expression:

1. **Pașaport CRDS anterior**: `deteriorat` for DAMAGED, `date schimbate` for DATA_CHANGE; warning rather than an automatic green “OK”.
2. **Dovada actuală din țară**: user-confirmed possession is not legal acceptance; show `de verificat`, or `neconfirmată` as a warning when missing.
3. **Certificatul românesc de naștere**: show as an independently preparable original, not silently folded into an aggregated label.
4. **Acte românești privind schimbarea datelor**: conditional row for a data-change case or declared civil change; unresolved registration is a warning, updated records are presented as `de prezentat` rather than legally “approved”.
5. **Carte de identitate românească**: explicitly conditional `dacă există`, not silently mandatory for all CRDS cases.
6. **Dovada achitării taxei**: shown separately, with a reminder to confirm amount/method at the chosen consulate.

Status colors: `warn` for a problem/missing prerequisite, neutral for an unverified document to be prepared; no misleading green “OK” on an old damaged passport.

## Tests

[GitHub Actions run 38449471702](https://github.com/mypape-dot/actero-site/actions/runs/38449471702), on **synthetic historical public code only**, passed:

- Existing engine/browser QA 8/8;
- Historical common B5 renderer 40/40;
- First UK editorial draft 40/40;
- Granular-checklist draft 40/40 in Chromium desktop and simulated WebKit mobile;
- `verify-b5-checklist-diff.mjs` 2/2 intended replacement regions, 0 unexpected changes;
- All security/purchase-gating regression checks.

Tests verify both incident headings, 5 document rows (DAMAGED) or 6 (DATA_CHANGE), neutral vs warning statuses, missing residence evidence, updates to civil-registration state, and zero uncaught browser exceptions.

**Limitations:** no physical iPhone test of the revised private D1 output, no live Worker paid delivery, no proof that official documents or translations are accepted for every client, and no legal/editorial approval.

## Run locally with your PRIVATE original and five-change review draft

The operator keeps two private files outside the GitHub checkout:
`$HOME/actero-b5-private.json` (original D1 copy) and
`$HOME/actero-b5-review-draft.json` (five-change UK review draft).

From Terminal on the operator's Mac:

```bash
cd ~/Desktop/actero-site
git pull --ff-only origin fix/engine-logic-audit-20261013
node cloudflare/prepare-b5-checklist-review.mjs "$HOME/actero-b5-review-draft.json" "$HOME/actero-b5-checklist-draft.json"
node cloudflare/verify-b5-checklist-diff.mjs "$HOME/actero-b5-review-draft.json" "$HOME/actero-b5-checklist-draft.json"
node cloudflare/tests/b5-legacy-render.browser.mjs "$HOME/actero-b5-checklist-draft.json"
```

If the output file already exists, the preparer refuses to overwrite; inspect the existing draft privately instead of deleting or replacing it without checking.

**Never upload, commit, email or paste any `script_js` in chat.** Share only the local summary lines `B5 CHECKLIST DIFF` and `40/40 passed`, without usernames, secrets, raw source or private paths.

### Release gates

Maintain `sale_approved=NO`. Manually verify evidence requirements on current DGP/eConsulat pages for the actual country/consular post, inspect content on iPhone Safari, and test paid delivery/restoration in Shopify–Cloudflare staging before updating any D1 script.
