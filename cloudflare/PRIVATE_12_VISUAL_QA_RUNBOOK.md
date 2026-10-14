# ActeRO — test vizual privat pentru 12 ghiduri (diagnostic, nu aprobare)

**Stare:** numai în ramură Draft, fără modificări D1, Shopify sau `main`. Acesta este un instrument pentru computerul autorizat al proprietarului, nu un export de ghiduri și nu o verificare juridică.

## De ce

Verificarea privată de sintaxă din 14.10.2026 a returnat **12/12 STRUCTURE_OK**, dar toate cele 12 scripturi conțin indicatori textuali de „Procedură verificată” fără certificare editorială pe ghid. Mai ales `B1_FR` trebuie verificat pentru ca dovezile subsidiare Franța să nu fie oferite automat la o primă solicitare CRDS.

## Ce verifică noul instrument

- Interogarea SQL `SELECT` selectează numai 12 scripturi deținute de operator. Datele sunt transmise direct de la Wrangler către procesul Node printr-un pipe local. **Nu** se generează niciun export JSON cu `script_js` pe disc.
- Verificatorul refuză chei/rute lipsă, erori de sintaxă, intrări neprevăzute și nume de funcții ambigue. Funcțiile necunoscute sunt **REVIEW**, nu PASS.
- Unde poate identifica **fără ambiguitate** o funcție de randare, rulează scriptul într-o pagină de test offline, separată de magazin, pe **Chromium 1280px și WebKit 390px**, cu stări sintetice ale chestionarului. Nu este Safari real pe iPhone și nu reproduce checkout-ul.
- Verifică existența unui titlu și a conținutului, structura pașilor, carduri și documente, linkuri evident invalide, afirmații de verificare vizibile, mesaje tehnice și overflow. **Nu** verifică dacă documentele sunt acceptate la consulat, dacă linkurile externe chiar funcționează, sau dacă pașii sunt corecți.
- Imaginile, care pot conține textul comercial privat, se salvează **numai local** într-un director din `$HOME`, cu acces restricționat. În GitHub Actions se folosesc exclusiv 12 ghiduri **sintetice**, fără date premium.

## Pe Mac

Din `~/Desktop/actero-site`, dacă nu ai schimbări locale nesalvate:

```bash
cd ~/Desktop/actero-site
git fetch origin
git switch audit/private-12-render-qa-20261014 || git switch --track origin/audit/private-12-render-qa-20261014
git pull --ff-only
bash cloudflare/audit-private-12-visual-on-mac.sh
```

Dacă Git refuză schimbarea ramurii din cauza unor modificări, oprește-te, nu șterge fișiere. Dacă Playwright lipsește, nu instala nimic nesolicitat: anunță eroarea ca să fie diagnosticată. Dacă directorul de ieșire există deja, folosește un nume **nou** și privat, de exemplu:

```bash
bash cloudflare/audit-private-12-visual-on-mac.sh "$HOME/actero-private-12-visual-qa-20261014-b"
```

Terminalul va afișa numai `RENDER_OK` sau `REVIEW`, cheile de ghid publice și coduri de diagnostic. Directorul privat cu imagini se deschide automat dacă a fost creat. **Nu trimite în chat imaginile cu pagini premium complete, codul sursă, exportul din D1, secrete sau datele clienților.** Trimite doar mesajul `PRIVATE VISUAL QA: X/24` și liniile `REVIEW ...`.

**Interpretare:** `RENDER_OK` = randare sintetică izolată fără avertizări automate în acel viewport; nu înseamnă ghid complet sau aprobare pentru vânzare. `REVIEW_RENDER_ENTRYPOINT...` = testul nu a putut identifica modul exact de apelare, nu neapărat o defecțiune în ghid. Testele nu pot certifica afișarea reală după plata Shopify.

## Pasul următor după diagnostic

Revizuirea umană a ghidului efectiv în browser, a tuturor documentelor, taxelor, condițiilor pentru FR/BE/NL/IE, linkurilor PDF oficiale și a fluxului Shopify–Worker în staging. Orice corecție va fi pregătită prin modificări private, testată diferențial și aprobată separat. Cele 12 ghiduri și toate cele 43 chei rămân **neaprobate pentru vânzare**.

## Clarificare diagnostic după rularea reală 0/24 din 14.10.2026

**Operator-reported (screenshot, fără exportul sursei):** 24/24 cazuri au primit un semnal `REVIEW`, însă **nu** sunt 24 erori de ghid: B1_IE și B1_NL au randat pe ambele viewporturi, dar au afișat o afirmație `Procedură verificată` fără aprobarea editorială; B1_FR și B1_BE au eșuat în testul de randare offline; cele 8 scripturi B5 (lost/renewal × 4 țări) nu au funcții cunoscute de selector. Nu schimbați codul premium pe baza acestor rezultate.

Ramura de diagnostic `fix/private-12-render-diagnostics-20261014` distinge acum faza erorii de browser (`BROWSER_RENDER_FAILED_HTML_SETUP`, `..._GUIDE_ENTRYPOINT_CALL`, etc.), afișează doar **identificatori de funcție** din sursa privată într-o listă limitată `FUNCTION_IDENTIFIERS_ONLY` și semnalează un titlu din altă țară. Numele funcțiilor sunt metadate tehnice; **nu** afișați corpul funcțiilor, pașii, linkurile clienților, tokenurile sau exportul.

Comandă de retestare doar în mediul propriu, într-un director privat NOU (nu suprascrie rezultatele anterioare):

```bash
cd ~/Desktop/actero-site
git fetch origin
git switch fix/private-12-render-diagnostics-20261014 || git switch --track origin/fix/private-12-render-diagnostics-20261014
git pull --ff-only
bash cloudflare/audit-private-12-visual-on-mac.sh "$HOME/actero-private-12-render-diagnostic-20261014"
```

Trimite doar rezultatul textual care începe cu `PRIVATE VISUAL QA` și codurile `BROWSER_RENDER_FAILED_...` / `FUNCTION_IDENTIFIERS_ONLY`, **nu** codul comercial sau fotografiile premium. Această probă nu aprobă nicio variantă de vânzare și nu modifică D1/Shopify.
