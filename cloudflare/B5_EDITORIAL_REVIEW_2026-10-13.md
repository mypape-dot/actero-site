# ActeRO — B5 editorial review after private exact-diff confirmation (13 Oct 2026)

**Status: reviewed official baseline, NOT approved for sale. No D1/Shopify updates.**

## Operator evidence and limits

On 13 Oct 2026 the operator ran `cloudflare/verify-b5-review-diff.mjs` on their private, locally held original and revised D1 exports for `B5_DAMAGED` and `B5_DATA_CHANGE`. They reported:

```
5/5 planned substitutions; 0 unexpected edits; 2 matching guides. D1 unchanged.
```

This is an **operator-reported local result**; private commercial code was not copied to GitHub or submitted for external review. Together with the previous operator-reported 40/40 browser result, this establishes controlled **structural** changes and rendering, not legal correctness or successful paid delivery.

## Source-grounded editorial review

| Area | Authoritative source | Finding | Assessment |
| --- | --- | --- | --- |
| DAMAGED | [eConsulat – CRDS adult electronic passport, documents](https://econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/ActeNecesare/203000002) | The damaged/destroyed passport should be presented when enough identifiable elements remain. | **General core step supported**. Review full case before sale. |
| DATA_CHANGE | [DGP – CRDS](https://pasapoarte.mai.gov.ro/cetateni-romani-cu-domiciliul-in-strainatate/) and [eConsulat – CRDS documents](https://econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/ActeNecesare/203000002) | Changes of name/surname made abroad require inscription or transcription in Romanian civil-status records before application when the requested personal data differ. A CRDS document should not be used after an identity-data change. | **General core step supported**. Individual variations still require review. |
| UK eVisa | [GOV.UK – eVisa](https://www.gov.uk/evisa), [GOV.UK – BRP](https://www.gov.uk/biometric-residence-permits) | Immigration status proof is digital; UKVI share codes may be generated. Physical BRPs have expired, and cannot be treated as universally current proof. | **Supported as UK status description**; does not establish Romanian CRDS acceptance. |
| UK CRDS proof | [DGP – Conditions Great Britain PDF (2022)](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Marea-Britanie.pdf) | Historical DGP list includes electronically generated settled/pre-settled confirmation obtained after checks by named Romanian consulates, **at application or no more than 30 days before**. | **OPEN:** the current draft mentions checks but does not express the 30-day freshness condition. Independently verify how it is applied today at the selected consulate. |
| Consular fee | [eConsulat – CRDS passport fee](https://www.econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/TaxeConsulareDescriere/203000002) | Lists **53 EUR or equivalent in local currency** for adult CRDS electronic passport at consulates. | **General fee supported**; exact office and current payment instructions should still be checked. |
| Past verification date | Internal claim “Verified 5 Oct 2026” | No guide-specific editorial sign-off exists in the review register to substantiate the blanket badge. | **Removing the blanket claim is appropriate**; do not claim full verification without records. |

## Blocking editorial issues before approval

1. **UK proof freshness:** do not conflate a 90-day UKVI share-code validity period with the separate DGP 2022 requirement that certain consular-generated settled/pre-settled confirmations be from the date of application or no more than 30 days earlier. Check whether DGP/eConsulat updated this procedure and include a conditional note only if still applicable. Do **not** claim a share code is accepted automatically.
2. **Document lists:** validate case-specific originals, Romanian civil certificates, resident-country proof, translations, and differences between consular and Romania submissions. The existence of eight steps in tests does not establish their legal completeness.
3. **PDF and source UX:** verify each official link opens the intended current document on iPhone Safari, and a reference information page is not mislabelled a submit-ready form.
4. **Checkout:** no live or test payment grant/recovery has been exercised for the revised scripts. The new approval migration is not deployed and has no approved guides.
5. **Preserve exact private revision:** user-confirmed five-change local draft must not be overwritten by a new patch without another local exact-diff and full browser regression.

## Direct source confirmation — 13 October 2026

The official one-page [DGP document for Great Britain (PDF, file dated 2022)](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Marea-Britanie.pdf) is still publicly accessible on the DGP website. Its final paragraph specifically discusses **electronically generated settled/pre-settled confirmations following checks by named Romanian consular offices**, produced **on the application date or no more than 30 days earlier**. It does **not** state that *every* UKVI share code must be no more than 30 days old.

Current [GOV.UK eVisa guidance](https://www.gov.uk/evisa) and [GOV.UK share-code page](https://www.gov.uk/evisa/view-evisa-get-share-code-prove-immigration-status) explain that UK immigration status is digital and a UKVI share code lasts **90 days**. These official rules cover different objects and must not be conflated: a share code's lifetime is **not evidence** that it satisfies the Romanian CRDS application requirements.

**Editorial decision:** Keep the current local five-change draft unmodified pending confirmation from the consular/DGP side that the 2022 electronic-confirmation process and 30-day document freshness still apply. For now, advise the applicant to confirm the *exact* acceptable proof and issue date with eConsulat/consulate; do not promise that any 90-day-valid code is automatically sufficient. No guide may be marked approved based on this research alone.

Operator confirmed on their own Mac: **5/5 planned replacements, 0 unexpected edits, 2 identical shared guide scripts; D1 unchanged**. This is a local integrity test, not legal sign-off.

## Review disposition

- `B5_DAMAGED`: **render tested locally, editorial approval NO**.
- `B5_DATA_CHANGE`: **render tested locally, editorial approval NO**.
- No SQL `UPDATE`, no public deployment, no Shopify changes, no migration applied.
