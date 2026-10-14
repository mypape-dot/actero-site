# ActeRO — private B5 mobile visual QA

**Scope:** inspect the *local private* B5 checklist draft, not the production website. Do not commit screenshots or paid scripts to GitHub. No D1 or Shopify modifications.

The new `cloudflare/b5-mobile-visual-local.mjs` loads the actual styles from the local `index.html`, then renders the two private B5 cases at three viewport widths (320, 390, 430 CSS pixels) in simulated WebKit mobile mode.

It tests four combinations: Italy / UK × damaged passport / changed personal data; **12 responsive checks** total. At 390px, it saves 4 complete-page screenshots and 4 sidebar-only screenshots in a user-supplied local folder **outside the checkout**. The checks flag page-wide horizontal overflow, document-card overflow, wrong checklist row count, or JavaScript exceptions.

It is **not a real iPhone Safari session**. A local screenshot of a draft is not evidence that the live paid access flow renders identically.

On the operator's Mac, with `$HOME/actero-b5-checklist-draft.json` from their previous approved-for-test local process:

```bash
cd ~/Desktop/actero-site
git pull --ff-only origin fix/engine-logic-audit-20261013
node cloudflare/b5-mobile-visual-local.mjs "$HOME/actero-b5-checklist-draft.json" "$HOME/actero-b5-visual-qa"
open "$HOME/actero-b5-visual-qa"
```

Observe the labels in each `*_checklist.png`, especially that a damaged passport is in a warning state, residence proof is neutral until reviewed, civil-record updates are conditional, and no document names are cut off. Report the numeric test summary (no source code).

**Sale approval remains NO.** Do not upload premium source, screenshots containing sensitive data, or any D1 export to this repository. No deploy or migration is part of this step.
