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

## Source reconciliation after operator's private 8/8 preflight (13 October 2026)

Operator screenshot reports `8/8 textual safeguards present` and `REVIEW UK_DGP_2022_30_DAY_CONSULAR_CONTEXT`. Interpret the last line as an **open source-policy question**, not a failed browser test and not a requirement to add a blanket 30-day rule.

Evidence rechecked on official sites:
- [DGP CRDS general requirements (last updated 31 July 2025)](https://pasapoarte.mai.gov.ro/documente-necesare-pentru-pasaport-simplu-electronic-simplu-temporar-cu-mentionarea-statului-de-domiciliu-c-r-d-s/): accepted categories of residence evidence, original civil-status documents, payment and registration of foreign name changes. It does **not** resolve whether the UK country-specific 2022 30-day consular confirmation process still applies.
- [DGP UK 2022 one-page PDF](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Marea-Britanie.pdf): says the relevant *consular-generated* settled/pre-settled confirmation was issued at filing or within 30 days before filing; it does not say that all UKVI share codes expire after 30 days.
- [GOV.UK UKVI share code](https://www.gov.uk/evisa/view-evisa-get-share-code-prove-immigration-status): share code lasts 90 days **for UK immigration-status verification**, which is not a Romanian consular admissibility guarantee.
- [GOV.UK expired BRPs](https://www.gov.uk/biometric-residence-permits): BRP cards have expired and are replaced by eVisas; outdated physical BRP listings are not automatically valid consular documentary proof.

**Open decision, deliberately not patched into premium guide:** Confirm with DGP or the selected Romanian UK consular office whether electronically generated settled/pre-settled *consular confirmations* remain acceptable in October 2026, who generates them, which issue-date requirement applies and whether the office accepts eVisa/share-code information directly. Keep B5_DAMAGED and B5_DATA_CHANGE unapproved until current acceptance and client-facing text are checked. Avoid expanding the already long GB checklist with an unverified legal instruction. No D1/Shopify/publication action is authorised by this document.
