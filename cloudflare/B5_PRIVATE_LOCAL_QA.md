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
