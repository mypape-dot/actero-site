# ActeRO — B5 local editorial preflight (13 October 2026)

**Scope:** B5_DAMAGED and B5_DATA_CHANGE, still **not approved for sale**. This tool reports *literal textual safeguards only*, not legal accuracy, successful checkout, or correct rendering on an actual iPhone. It does not patch the premium guides.

## Why this check exists

The operator ran 40/40 private renderer checks and 12/12 simulated mobile layout checks. Those results demonstrate rendering and responsive layout, not whether a document is accepted by a consular office in 2026. In particular:

- [eConsulat adult CRDS electronic passport — acts](https://econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/ActeNecesare/203000002): prior passport if it exists; relevant Romanian civil-status originals; Romanian identity card if it exists; damaged passport with identifiable elements; changed foreign name must be reflected in Romanian civil-status records before applying.
- [DGP Great Britain country conditions PDF (2022)](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Marea-Britanie.pdf): described consulate-generated settled/pre-settled electronic confirmation at the time of application or at most 30 days earlier. **This is not the UKVI share-code validity period.** The PDF is older: whether this confirmation route/period is still applied in 2026 must be checked with the selected Romanian consular office.
- [GOV.UK eVisa](https://www.gov.uk/evisa) and [GOV.UK BRP](https://www.gov.uk/biometric-residence-permits): present-day UK immigration status is digital, not universally proved by a physical expired BRP.
- [DGP Italian country conditions PDF (2022)](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Italia.pdf): lists Italian residence evidence and states no authorised Romanian translation is required for the listed document types. Verify current consular practice before individual sign-off.
- [eConsulat CRDS electronic passport — fee](https://econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/TaxeConsulareDescriere/203000002): 53 EUR or local equivalent on the displayed consular service page; check the selected post and payment method.

## Private, read-only check on the Mac

Use the **existing** operator-owned reviewed checklist draft. This does not change D1, Shopify, the public frontend or the draft.

```bash
cd ~/Desktop/actero-site
git fetch origin fix/b5-editorial-preflight-20261013
git switch -c fix/b5-editorial-preflight-20261013 --track origin/fix/b5-editorial-preflight-20261013
node cloudflare/b5-editorial-preflight-local.mjs "$HOME/actero-b5-checklist-draft.json"
```

If the local branch already exists, switch to it instead. Do not delete or overwrite the private draft. Keep it outside the GitHub checkout, and never upload, commit, paste or email its `script_js`.

Output is a list of `PASS` / `REVIEW` labels. This deliberately does not print source text, file paths, hashes, tokens or identities. Exit code 2 means a required textual safety signal was missing or the input validation failed; **it does not prove that the guide is illegal**. A 0 exit code **does not mean sale approved**. The UK-2022/30-day marker is an informational review signal and may remain `REVIEW` until clarified.

## Human release gates (both guide keys remain NO)

1. Compare rendered case-specific instructions to the latest official eConsulat/DGP and current selected consulate, including civil-status changes and original documents.
2. Confirm UK digital settled/pre-settled evidence and whether the historical DGP 30-day consular confirmation rule applies, without treating share codes as automatically accepted.
3. Validate Italy/UK source URLs, country-specific accepted proof, translation requirements, local payment and turnaround details.
4. Complete actual mobile Safari link/PDF UX checks and Shopify–Worker staging paid delivery/recovery/revocation.
5. Only then consider a separate approved private exact-script revision and individual `sale_approved` review. Never set approvals automatically based on this helper.

**No live database writes, migrations, Shopify interactions, premium guide publication or deploy.**
