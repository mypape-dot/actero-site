# ActeRO — draft editorial privat pentru 12 ghiduri (14.10.2026)

**Stare: doar propunere Draft.** Nu este migrare sau aprobare pentru vânzare. Nu se modifică Cloudflare D1, Shopify, repo `main` ori clientul public.

## Context

Rularea privată pe Mac a arătat `VISUALLY DISPLAYED: 24/24`, însă toate cele 24 de capturi (12 ghiduri × Chromium/WebKit) au o afirmație vizibilă „Procedură verificată”. Verificarea tehnică nu susține această afirmație. Îndepărtarea ei este necesară, dar **nu înlocuiește auditul corectitudinii procedurilor**.

## Ce generează utilitarul

- Execută o interogare D1 **SELECT**, local și numai pe calculatorul autorizat.
- Confirmă **toate cele 12 chei + rute** așteptate; refuză duplicate, lipsuri, scripturi prea scurte, erori de sintaxă, modificări neașteptate și etichete absente.
- Înlocuiește **numai șirul exact** `Procedură verificată` cu `Ghid informativ` în fiecare script, într-o **copie privată**. Pentru **B1_FR și B1_BE exclusiv**, neutralizează și formularea confirmată `Surse reverificate: 5 octombrie 2026` ca `Surse de consultat`. Dacă textul este diferit, absent, apare prea des sau rămâne o altă afirmație de verificare datată, blochează draftul. Nu schimbă pași, taxe, formulare sau linkuri.
- Compilează sintactic noile scripturi, verifică egalitatea cu înlocuirea exactă, înregistrează identificatorii și amprentele SHA-256 înainte/după.
- Generează `private-draft.json` și `safe-summary.json` **numai pe Mac**, într-un folder nou, privat, în afara checkout-ului GitHub. Nu scrie în D1.
- Execută offline un test Chromium/WebKit al draftului (`24` randări) și salvează capturi locale într-un al doilea folder. Nu testează magazinul și nu validează legea sau acceptarea consulară.

## Pe Mac — după ce CI este verde

```bash
cd ~/Desktop/actero-site
git fetch origin
git switch audit/private-12-editorial-badge-draft-20261014 || git switch --track origin/audit/private-12-editorial-badge-draft-20261014
git pull --ff-only
bash cloudflare/audit-private-12-badge-on-mac.sh
```

Dacă Git refuză schimbarea ramurii din cauza modificărilor locale, **oprește-te**; nu șterge fișiere. Wrangler poate solicita autentificare, dar nu folosi niciun token în chat sau în comenzi salvate. Directorul implicit este `$HOME/actero-private-12-badge-review-20261014` și pentru capturi `$HOME/actero-private-12-badge-review-20261014-visual`. Dacă există deja, rulează ulterior cu o locație **nouă** ca argument; scriptul refuză suprascrierea.

Trimite în chat **doar** mesajele `PRIVATE BADGE DRAFT:`, `DRAFT_ONLY` și `PRIVATE VISUAL QA:` plus semnale `REVIEW`; nu trimite `private-draft.json`, capturi premium ori exportul Cloudflare.

## Limite și puncte de control

- `Ghid informativ` este o etichetă neutră, nu o certificare juridică. Neconcordanțele existente din pașii procedurali rămân de revizuit.
- Dacă schimbarea de text nu e găsită, apare de peste patru ori într-un singur script, dacă sursa conține vechi afirmații de reverificare sau dacă eroarea de sintaxă apare, utilitarul **refuză producerea draftului**.
- Dacă simulatorul reușește 24/24, acea verificare demonstrează doar comportamentul UI în mediul artificial; nu certifică Safari real, plata sau PDF-urile la distanță.
- Aprobarea finală cere confirmarea surselor oficiale, a dovezilor pentru fiecare țară, a documentelor originale și traducerilor, taxelor/termenelor, plus un test real de cumpărare și recuperare pe staging.
- Nu rula nicio comandă `UPDATE`, `INSERT`, `wrangler deploy` ori `git merge` pe baza acestor rezultate. Cele 43 de ghiduri rămân neaprobate pentru vânzare.

### Situații editoriale critice care trebuie revizuite după etichetă

| Țară | Prima solicitare B1 | Reînnoire B5 / pierdere B5 |
|---|---|---|
| Franța | Dovezile subsidiare din fișa DGP nu se aplică automat primei solicitări | Verifică dacă titularul avea deja CRDS pentru Franța și condițiile listelor secundare |
| Belgia | Anexa 19 poate atesta depunerea, nu acceptarea definitivă | Confirmă dovada belgiană actuală și acceptarea ei de DGP |
| Țările de Jos | BRP al rezidenților diferă de RNI/BSN | Clarifică documentul oficial al rezidenței; IND 8004 nu e formular CRDS universal |
| Irlanda | PPS și IRP nu sunt dovezi generale de domiciliu pentru români | EUTR2 se aplică condiționat; confirmă dovezi concrete de rezidență |

Îndepărtarea etichetei nu ridică niciunul dintre blocajele editoriale de mai sus.

## Actualizare după diagnosticul privat 14.10.2026, ora 22:00

Screenshotul local a confirmat `SAFE_DIAGNOSTIC` pentru `B1_FR` și `B1_BE`, cu două semnale suprapuse pentru aceeași expresie datată; detectorul mai general caută și subșirul „verificat” din „reverificate”. Am introdus o **singură modificare editorială controlată** pentru formula exactă `Surse reverificate: 5 octombrie 2026`, doar în aceste două scripturi. Nici alte date, nici alte afirmații și nici instrucțiuni procedurale nu pot fi schimbate automat. Alte claim-uri datate rămân blocante.

După actualizarea GitHub, se folosește un folder nou, fără ștergerea rezultatelor anterioare:

```bash
cd ~/Desktop/actero-site
git pull --ff-only origin audit/private-12-editorial-badge-draft-20261014
bash cloudflare/audit-private-12-badge-on-mac.sh "$HOME/actero-private-12-badge-review-v3"
```

Scop: **12/12** drafturi pregătite, **24/24** randări offline fără claim-ul vechi. Acest rezultat nu conferă aprobare de vânzare și nu se aplică automat în D1. Trimite numai `PRIVATE BADGE DRAFT`, `PRIVATE VISUAL QA`, `SAFE_DIAGNOSTIC` și codurile `REVIEW`, fără fișiere private sau conținut premium.

## Verificare vizibilă fără fișiere private (după inventar)

Numărătorile din scriptul brut pot include fragmente neafișate sau potriviri între propoziții. Noua comandă
`bash cloudflare/audit-private-12-visible-claims-on-mac.sh` citește cele 12 scripturi prin SELECT, le redă în Chromium și WebKit local, dar **nu salvează capturi sau exporturi**. Afișează câte o linie `VISIBLE_CLAIMS` pe ghid cu:

- `badge` — aparițiile exacte ale etichetei „Procedură verificată” în textul afișat;
- `source_date` — aparițiile exacte „Surse reverificate: 5 octombrie 2026”;
- `other_dates` — alte mențiuni vizibile ale datei, chiar dacă nu reprezintă o afirmație de verificare; necesită revizuire manuală;
- `mobile_match` — dacă numărătorile coincid în randarea desktop și WebKit mobil.

Este un test offline cu date sintetice de stare, **nu Safari real**, nu verifică linkuri externe, nu aprobă conținutul legal și nu atinge D1/Shopify. Următorul draft de editare se va face numai după compararea rezultatelor vizibile cu regulile editoriale. Nu rula încă scriptul de modificare `audit-private-12-badge-on-mac.sh`.
