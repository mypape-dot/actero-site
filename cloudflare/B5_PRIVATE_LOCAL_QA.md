# ActeRO — test PRIVAT al celor doua ghiduri B5 direct din D1

**Scop:** verifica daca **scripturile existente in Cloudflare D1**, nu doar generatorul istoric din `main`, afiseaza cazurile DAMAGED si DATA_CHANGE pentru toate cele 10 tari. Testul se executa **exclusiv pe computerul autorizat al operatorului**, nu in GitHub Actions si nu in chat.

**Nimic din aceasta procedura nu modifica D1, nu initiaza comenzi Shopify si nu activeaza plati.**

## Conditii

- Acces autorizat in contul propriu Cloudflare, Node.js si un checkout local al ramurii `fix/engine-logic-audit-20261013`.
- In acel checkout, Playwright pentru Chromium + WebKit. Instaleaza numai daca nu este deja prezent:
  ```bash
  npm install --no-save --no-package-lock --ignore-scripts playwright@1.56.1
  npx playwright install chromium webkit
  ```
- Cloudflare Wrangler autentificat in contul tau. Comanda `npx wrangler login` este optionala si se executa numai de proprietarul contului.

## 1. Export local al DOAR celor doua scripturi

Executa din terminalul tau local; comanda SQL este numai `SELECT`:

```bash
npx wrangler d1 execute actero-db --remote --json \
  --command "SELECT guide_key,route,script_js FROM guide_scripts WHERE guide_key IN ('B5_DAMAGED','B5_DATA_CHANGE') ORDER BY guide_key" \
  > "$HOME/actero-b5-private.json"
```

Cloudflare documenteaza comenzile `d1 execute --remote --command --json` la https://developers.cloudflare.com/workers/wrangler/commands/d1/ .

**ATENTIE:** acesta este un fisier **privat cu produsul platit**. NU il copia in directorul repository-ului, NU il comite in Git, NU il incarca in GitHub/issue-uri si NU il lipi in chat. Fisierul nu trebuie sa contina date ale clientilor, parole, tokenuri sau exportul bazei complete.

## 2. Test de afisare pe computerul tau

Din directorul de lucru al ramurii de audit:

```bash
node cloudflare/tests/b5-legacy-render.browser.mjs "$HOME/actero-b5-private.json"
```

Parserul verifica existenta exact a celor doua chei `B5_DAMAGED` si `B5_DATA_CHANGE`, ruta `B5_EXISTING_CRDS` si identitatea celor doua scripturi. Apoi ruleaza **40 de teste de browser**: 10 tari × 2 tipuri de caz × 2 motoare (Chromium si WebKit mobil simulat). Nu trimite nimic catre Cloudflare din pasul 2 si nu afiseaza continutul scripturilor.

Asteptat: `PRIVATE LOCAL D1 EXPORT (no content uploaded): 40/40 passed...`.

Daca un test esueaza, pastreaza **doar mesajul de eroare redactat**, fara fragmente de script, tokenuri sau continut privat.

## 3. Curatare

Dupa salvarea rezultatului testarii in jurnalul QA privat si daca nu mai ai nevoie de export:

```bash
rm "$HOME/actero-b5-private.json"
```

## Limite

- Testul executa **codul local** provenit din D1 si verifica titluri, pași, checklist, avertizari si corelarea cu sursa tarii. Nu verifica linkurile oficiale accesand internetul si nu demonstreaza exactitatea juridica.
- Nu simuleaza autentificarea cumparatorului, plata reala, plata de test, permisiunile D1 Worker sau interfața completa de recuperare.
- Comparatia a doua scenarii cu scripturi identice este intentionata: modul de ghid se alege din datele utilizatorului, nu din `guide_key` singur.
- Nu aproba vanzarea; toate cele 43 de rute raman neaprobate pana la QA individual, inclusiv verificarea documentelor si taxelor oficiale.

## 4. Propunere de corecție UK (nepublicată, doar local)

Pe 13 octombrie 2026, operatorul a confirmat prin interogare D1 exclusiv de citire că `B5_DAMAGED` și `B5_DATA_CHANGE` conțin `settled`, dar **NU** conțin `evisa` și `share code` ca expresii exacte. Verificarea `instr()` nu validează singură lipsa oricărei explicații alternative, dar identifică o lacună de revizuit.

- [GOV.UK — eVisa](https://www.gov.uk/evisa) spune că dovada actuală a statutului este digitală și se poate genera un share code.
- [GOV.UK — BRP](https://www.gov.uk/biometric-residence-permits) confirmă expirarea BRP-urilor fizice și înlocuirea cu eVisa.
- [DGP — condiții Marea Britanie (PDF din 2022)](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Marea-Britanie.pdf) enumeră documente istorice (inclusiv BRP) și dovezile electronice settled/pre-settled generate după verificarea consulară. **Nu substitui automat un share code oricărei dovezi cerute de consulat.**
- [eConsulat — tarif CRDS electronic](https://econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/TaxeConsulareDescriere/203000002?isServiciuElectronic=False) confirmă 53 EUR sau echivalentul local la consulat, nu un tarif unic pentru depuneri în România.

Am pregătit instrumentul de **revizie locală** `cloudflare/prepare-b5-uk-review.mjs`: actualizează doar paragraful pentru Regatul Unit, păstrează celelalte țări, clarifică taxa consulară și elimină afirmațiile nesusținute de verificare editorială (`Procedură verificată`, `5 octombrie 2026`). Nu schimbă D1 sau Shopify. Refuză exporturi diferite, intrări nepotrivite și suprascrierea fișierelor.

Din folderul `~/Desktop/actero-site`, cu fișierul PRIVAT inițial în `$HOME`:

```bash
git pull --ff-only origin fix/engine-logic-audit-20261013
node cloudflare/prepare-b5-uk-review.mjs "$HOME/actero-b5-private.json" "$HOME/actero-b5-review-draft.json"
node cloudflare/verify-b5-review-diff.mjs "$HOME/actero-b5-private.json" "$HOME/actero-b5-review-draft.json"
node cloudflare/tests/b5-legacy-render.browser.mjs "$HOME/actero-b5-review-draft.json"
```

Fișierul de ieșire **conține codul comercial privat**. Nu îl pune în repository, în GitHub, în chat sau într-o conversație publică. Trimite doar ultimele linii de succes/eroare fără cod. Nu folosi scriptul pentru `UPDATE` D1; aprobarea editorială, verificarea linkurilor și testele de plată/livrare lipsesc în continuare.

CI verifică instrumentul **numai pe conținut sintetic derivat din `main` istoric**: [GitHub Actions 38443229096](https://github.com/mypape-dot/actero-site/actions/runs/38443229096) — securitate + browser PASS, revizia sintetică 40/40 PASS. Nu este dovada că fișierul privat revizuit de pe Mac a trecut până când operatorul rulează comanda.

## 5. Operator update: 40/40 post-edit private rendering PASS

The operator ran the private D1 review draft locally on Mac (13 October 2026) and reported `40/40 passed for 10 countries × 2 incidents × 2 browser engines. Contents verified for rendering only; legal accuracy not reviewed.` This is **operator-reported evidence**, not an independent audit of the private source bytes; no raw private source was transferred. `verify-b5-review-diff.mjs` was subsequently added to independently regenerate the exact reviewed draft from the original and verify it contains only the five planned replacements. This exact-diff check still needs to be executed locally on the actual two private files. Do not set any sale approvals.
