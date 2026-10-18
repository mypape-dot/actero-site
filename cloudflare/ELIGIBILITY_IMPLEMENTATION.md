# Eligibilitate server — implementare și validare locală, 16 octombrie 2026

Ramură de integrare: `draft/server-eligibility-20261016`, pornită exact din PR #18,
`5029d1ccf325622e0aa0b03f61aaac784df2d47b`. Contractul și corecțiile motorului
provin din PR #17, `98698b00296988bf2ffbc04c74ded56d2767809a`.
PR #16, PR #17, PR #18 și main nu sunt modificate de această ramură.

## Implementare

- `shared/eligibility.mjs` este sursa comună. Cele 14 funcții de reguli auxiliare
  sunt identice cu PR #17. `paymentDecisionFor` păstrează predicatul și semnalele
  juridice, adăugând ruta în rezultat. Această funcție de diagnostic acceptă în
  continuare cazuri parțiale și o rută dată; nu autorizează singură un checkout.
- `checkoutDecisionFor` validează cazul complet, derivează independent ruta din
  răspunsuri, recalculează câmpurile derivate și apoi aplică predicatul canonic.
  Verifică vârsta, cetățenia, țara, scopul, selecția/starea documentelor, enumurile,
  informațiile obligatorii și contradicțiile. Recalculează scenariul CRDS din
  starea documentului, aceeași țară, valabilitatea D1 și cerința certificatului
  de cetățenie. `allowed`, cheia, statusul și confirmarea juridică din browser
  nu constituie autoritate. Răspunsurile rămân declarații ale utilizatorului;
  implementarea nu verifică autenticitatea documentelor la autorități.
- Browserul folosește același `checkoutDecisionFor` prin `paymentDecision()`.
  Codul inline este generat de `node scripts/sync-eligibility.mjs`; CI verifică
  identitatea cu modulul prin `--check`. Pentru modificări viitoare, Claude trebuie
  să editeze modulul comun și să regenereze blocul, nu să editeze separat copia HTML.
  Funcțiile de întrebări și API-ul de randare al ghidurilor sunt păstrate.
- `/checkout` cere obligatoriu `case_state`, inclusiv când recuperarea nu este
  obligatorie. Verifică eligibilitatea la fiecare încercare, inclusiv retry, înainte
  de orice intent/token de cumpărare. Ruta/cheia diferite dau `case_route_changed`;
  cazul neeligibil dă `not_eligible`; baza juridică neconfirmată dă
  `legal_basis_unconfirmed` (409). Forma invalidă dă `invalid_case_state` (400).
- Aprobarea editorială D1 pentru hash-ul exact și aprobările tuturor țărilor unui
  ghid partajat rămân condiții independente, obligatorii și neschimbate.
- Recuperarea stochează numai răspunsurile recunoscute, câmpurile recalculate și
  contoarele de clarificare validate. Serializarea acceptă markerul legitim
  `cei_case: null`; un `null` pentru o dovadă obligatorie nu trece eligibilitatea.
- Funcția de checkout din browser verifică eligibilitatea și baza juridică înainte
  de a cere o sesiune; Worker-ul repetă independent verificarea. BE/NL/IE B1/B5
  și remediul francez rămân blocate la plată conform contractului lui Claude.
- Integrarea `index.html` păstrează configurația runtime, protecția accesului,
  recuperarea și checkout-ul închis din PR #18. CI păstrează verificările ambelor
  PR-uri și rulează și pentru PR-uri cu baza într-o ramură `draft/**` / `fix/**`.

Nu există modificări de schemă, migrări, deploy, seed remote, configurări Shopify,
secrete reale sau aprobări editoriale reale. Aprobările din teste există numai în
SQLite în memorie și se referă la un script sintetic.

## Rezultate locale

Node 24.19.0. Testele de mai jos au fost executate direct, pentru numărătoare pe caz:

| Suită | Rezultat |
|---|---:|
| `server-eligibility.test.mjs` | 47/47 PASS |
| `engine-full-journeys.test.mjs` | 10/10 PASS; paritate și Worker pe toate cele 43 chei |
| `engine-rules.test.mjs` | 70/70 PASS |
| `engine-audit-2026-10-15.test.mjs` | 29/29 PASS |
| `checkout-frontend.test.mjs` | 15/15 PASS |
| `evaluation-session.test.mjs` | 10/10 PASS |
| `payment-security.test.mjs` | 17/17 PASS |
| `environment-separation.test.mjs` | 15/15 PASS |
| `guide-approval.test.mjs` | 10/10 PASS |

Acoperirea negativă include GN-03 pentru cetățenie de la naștere/redobândită pe
A1/A3/C1, BE/NL/IE, remediile franceze, acte/dovezi lipsă, enumuri inventate,
documente nedeclarate, flaguri juridice/eligibilitate falsificate, ruta/cheia
schimbate, contradicții CRDS și o derogare falsificată pentru certificatul de
cetățenie. Testele vechi de plăți/recuperare au primit cazuri sintetice complete.

`npm test`: **32/34 fișiere PASS, 2 fișiere eșuate; suita completă NU este verde**:

- `audit-d1-metadata.test.mjs`: 1/3 teste PASS; celelalte două primesc stdout gol
  de la subprocess și nu pot parsa JSON. Fișierele validatorului și ale acestui
  test nu au fost schimbate. S-a reprodus separat și cu un copil Node care face
  numai `console.log(123)`: exit 0, stdout gol. Necesită rerulare pe Mac/CI.
- `staging-isolation.test.mjs`: 17/18 PASS; pornirea workerd e blocată cu
  `listen EPERM 127.0.0.1` de mediul de execuție.

`check:eligibility`, `check:staging`, `check:public`, `git diff --check` și bundling
Worker ESM cu esbuild: PASS. Bootstrap-ul 001–010 și configurația staging închisă
rămân neschimbate; validatorul șablonului nu certifică infrastructura remote.

Browser/workerd — executate, dar **nevalidate**:

- Noul `test:eligibility:browser` încearcă ambele browsere. Chromium sistemului
  se închide cu `setsockopt: Operation not permitted` / SIGTRAP. Executabilul
  WebKit Playwright 2215 nu este instalat în acest mediu.
- `test:browser` se oprește la `listen EPERM 127.0.0.1`.
- `test:staging:failures` și traseul `payment-journey.browser.mjs`, cerut separat
  pentru Chromium și WebKit, sunt blocate la pornirea backend-ului local workerd
  cu același EPERM. Nu sunt declarate PASS și nu au fost înlocuite cu teste mock.

## Verificare pe Mac înainte de orice test găzduit

După transferul ramurii, în checkout-ul ei, cu modificările locale deja salvate:

```sh
git branch --show-current
git merge-base --is-ancestor 5029d1ccf325622e0aa0b03f61aaac784df2d47b HEAD
npm ci --no-audit --no-fund
npx playwright install chromium webkit
npm run check:eligibility
npm run check:staging
npm run check:public
npm test
npm run test:eligibility:browser
npm run test:browser
npm run test:staging
```

Aceste comenzi rulează local; nu publică Worker-ul și nu ating D1 remote.
Nu activa checkout și nu publica Worker-ul dacă validările nu sunt verzi.
Pentru un Draft PR, baza este `draft/staging-shopify-environments-20261016`
(ramura PR #18); titlul propus: `Enforce independent server eligibility before checkout`.

## Blocaje comerciale rămase

Rerularea completă Chromium/WebKit/workerd și a suitei pe Mac/CI; validarea umană
a bazei juridice și a listelor de acte; aprobări editoriale reale pentru hash-urile
exacte și toate țările ghidurilor partajate; confirmarea izolării Shopify/secrete
și un E2E găzduit exclusiv în Test Mode. Toate cer aprobările și verificările
existente înainte de activare. Niciuna nu este îndeplinită doar de acest patch.
