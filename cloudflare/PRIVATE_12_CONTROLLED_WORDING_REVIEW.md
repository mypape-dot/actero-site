# ActeRO — draft de neutralizare controlată a afirmațiilor (14 octombrie 2026)

**Document de audit, ramură Draft; nu reprezintă o aprobare de conținut sau pentru vânzare.**

## Baza de dovezi — verificare privată a conținutului afișat

Proprietarul a executat `audit-private-12-visible-claims-on-mac.sh` pe datele private D1 printr-o comandă SQL **doar SELECT**, cu randări Chromium și WebKit offline.

Rezumat: 24/24 randări afișate, 12/12 perechi desktop–mobil cu aceleași numărători. **12 etichete** „Procedură verificată”, **10 etichete** exacte „Surse reverificate: 5 octombrie 2026” și **17 mențiuni suplimentare** ale datei. Mențiunile suplimentare nu sunt automat claims de verificare; trebuie controlate manual.

Cele 10 ghiduri cu eticheta exactă sunt:
- B1_FR, B1_BE
- B5_RENEWAL_FR, B5_RENEWAL_BE, B5_RENEWAL_NL, B5_RENEWAL_IE
- B5_LOST_FR, B5_LOST_BE, B5_LOST_NL, B5_LOST_IE

B1_NL și B1_IE nu au aceeași etichetă datată, dar au câte un „Procedură verificată”.

## Draft propus, doar pe Mac

Utilitarul `cloudflare/prepare-private-12-badge-draft.mjs` verifică exact 12 chei și rute și pregătește, numai local și într-un dosar privat, următoarele substituții:
- În fiecare ghid, strict `Procedură verificată` → `Ghid informativ`.
- Numai în cele 10 chei enumerate, strict `Surse reverificate: 5 octombrie 2026` → `Surse de consultat` (exact o apariție per ghid).

**Nu** se modifică alte date, documente, taxe, secvența pașilor sau linkurile. O altă afirmație explicită „Verificat la 5 octombrie 2026” blochează în continuare draftul. Verificările de sintaxă, integritate, rutare și comparație SHA-256 se fac înainte de orice fișier generat. Un script original modificat între verificări necesită refacerea auditului.

## Condiții înainte de lansare

**Fără aprobare automată:** fiecare ghid privat trebuie inspectat în întregime și comparat cu DGP/eConsulat și documentele oficiale din țara de reședință. Mai sunt necesare: valabilitatea dovezilor în cazurile B1/B5, traducerile, programarea, taxele și termenele curente; verificarea PDF-urilor originale în Safari real; fluxul complet de plată–acces–recuperare în Shopify/Cloudflare staging; testele de confidențialitate și revizuirea materialelor promoționale.

Cele **17 mențiuni suplimentare ale datei** rămân neschimbate și reprezintă un punct de control editorial, nu un rezultat de tip PASS. `Ghid informativ` nu înseamnă informație validată de o autoritate.

Niciun cod premium nu este inclus în acest document sau pe GitHub. **Nu** se aprobă `sale_approved`, nu se face `UPDATE` în D1, merge, deploy sau integrare de plată.
