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
