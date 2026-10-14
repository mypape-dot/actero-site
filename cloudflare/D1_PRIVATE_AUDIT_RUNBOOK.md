# ActeRO — inventar D1 și aprobarea ghidurilor (STAGING / READ-ONLY)

**Situație la 13 octombrie 2026:** nu există o conexiune directă la D1 din instrumentele de audit. Utilizatorul a executat în Cloudflare D1 Console o interogare exclusiv de metadate și a comunicat rezultatele: **43/43 chei prezente, rutele coincid cu catalogul, toate scripturile au lungime nenulă**. O altă interogare a arătat că singura pereche identică este `B5_DAMAGED` și `B5_DATA_CHANGE`; cele două conțin atât `DAMAGED:{`, cât și `DATA_CHANGE:{` și generatorul comun. **Nu s-a inspectat sau validat complet conținutul efectiv din D1**. Toate cele 43 de rânduri din `guide-review-tracker.csv` au în continuare `sale_approved=NO`.

## 1. Inventariere fără exportul textului plătit

În Cloudflare D1 Console, selectează baza corectă (mai întâi STAGING, nu production) și folosește numai interogări de **citire**:

```sql
-- Verifică structura, fără să citești scripturile:
PRAGMA table_info(guide_scripts);

-- Exportă strict metadate; NU selecta script_js:
SELECT guide_key, route, LENGTH(script_js) AS script_chars
FROM guide_scripts
ORDER BY guide_key;
```

Rezultatele de mai sus identifică cheile lipsă, dublurile, rutele nepotrivite și scripturile goale, nu corectitudinea instrucțiunilor. Dacă rezultatul este disponibil ca JSON, salvează-l **local, într-un loc privat din afara repository-ului**, apoi rulează:

```bash
node cloudflare/audit-d1-metadata.mjs /cale/privata/d1-metadata.json
```

Format: un array JSON de rânduri `[{ "guide_key":"B1_ES", "route":"B1_FIRST_CRDS", "script_chars":1000 }]`, sau forma uzuală Wrangler `[{ "results": [...] }]`. Scriptul refuză câmpuri `script_js`, `guide_json` și tokenuri.

**NU copia în GitHub, în chat public sau în issue-uri nici conținutul `script_js`, nici parole, webhookuri, tokenuri de acces, adrese e-mail ale clienților sau exporturi brute de D1.**

## 2. Aprobare editorială legată de versiunea conținutului

Fișierul `008-guide-approvals.sql` este o **migrare nouă, neaplicată**. Ea creează un tabel privat separat `guide_approvals`, fără a aproba implicit niciun ghid.

Orice aprobare trebuie să includă:

- `guide_key` și `route` aferente, strict concordante cu catalogul;
- `script_sha256`: hash SHA-256 al **scriptului real** verificat (UTF-8, exact octeții stocați în `script_js`), calculat numai în mediu privat;
- `status='approved'`, `approved_at` și `reviewer_reference` după inspecția oficială individuală a conținutului.

Worker-ul din **această ramură Draft** verifică aprobarea și hash-ul înainte de emiterea linkului Shopify și înainte de a livra ghidul plătit. Dacă scriptul este modificat, aprobarea veche nu îl mai autorizează. Pe lipsă tabel/migrare, nu vinde (eroare server), deci trebuie pregătite și testate **migrarea și conținutul în staging înainte de orice deploy**.

## 3. Proba reală necesară înainte de `approved`

Pentru fiecare cheie, documentează în mediu privat:

1. Procedura și instituțiile competente, surse oficiale (link exact), dată verificare.
2. Eligibilitatea, jurisdicția, domiciliul declarat și dovezile acceptate (inclusiv diferențe UE/CH/GB).
3. Fiecare document, taxă, valabilitate, termen și PDF oficial, cu exactitate și rol clar.
4. Toate avertizările și blocajele din motor, corelate cu ghidul.
5. Script efectiv în D1, pași complet randabili, utilizabili pe iPhone Safari/desktop.
6. Test Shopify Test Mode: checkout, webhook semnat, acces corect, recuperare, refund/dispute.
7. Aprobare editorială independentă pentru cheia și SHA-ul exact, cu evidență păstrată privat.

Nu aproba ghiduri printr-un script automat care copiază date din catalog; catalogul definește doar *ce ar trebui să existe*.

## 4. Cazuri de avarie/operare

- **Migrarea 008 lipsește:** Worker-ul nou va refuza checkout și poate refuza și livrarea scripturilor cumpărate. Repetă toți pașii în STAGING, cu backup D1 și plan de revenire, înainte de deploy.
- **Aprobarea este retrasă sau scriptul se schimbă:** sistemul refuză să afișeze conținutul neaprobat chiar și unui cumpărător deja plătit. E necesar suport operațional, comunicare și posibil un mecanism de păstrare a versiunii cumpărate ori rambursare; această funcționalitate **nu este implementată**.
- **Testele CI trec:** nu înseamnă că baza reală conține 43 de scripturi, că sunt aprobate sau că fluxul Shopify live funcționează.
- **D1 nu este inspectabil direct:** stadiul corect este `D1_metadata_checked=NO`, iar vânzarea rămâne blocată.

## 5. Prag minim de lansare

Fără merge în `main`, fără deploy Cloudflare, fără activarea Shopify și fără migrare production până când metadatele, conținutul și plățile au fost verificate în staging, backup-ul/restaurarea au fost testate, iar utilizatorul aprobă explicit lansarea.

## 6. Verificarea locală a surselor și PDF-urilor, fără expunerea ghidurilor

Un export privat cu câmpurile `guide_key`, `route`, `script_js` poate fi verificat numai pe calculatorul operatorului, **în afara repository-ului public**:

```bash
cd ~/Desktop/actero-site
git pull --ff-only origin fix/engine-logic-audit-20261013
node cloudflare/audit-private-guides.mjs "$HOME/actero-all-guides-private.json" > "$HOME/actero-private-audit-report.json"
```

Raportul include numai cheile deja prezente în catalog și semnale structurale agregate: rute, chei duplicate/lipsă, compilarea JavaScript fără execuție, scripturi identice, număr de URL-uri statice, domenii instituționale cunoscute și URL-uri PDF. **Nu afișează conținutul, adresele URL, titlurile sau tokenurile**.

Avertizările `NO_KNOWN_OFFICIAL_DOMAIN_URL`, `OTHER_DOMAIN_REVIEW`, `INSECURE_HTTP_REFERENCE`, `PLACEHOLDER_REFERENCE` și `POSSIBLE_UNSAFE_OR_PLACEHOLDER_HREF` sunt indicii pentru verificare, nu dovezi ale unei erori. `GUIDE_PERFORMS_NETWORK_REQUEST_REVIEW` și `GUIDE_READS_BROWSER_STATE_REVIEW` cer evaluarea motivului pentru care codul solicită date sau accesează stocarea browserului.

Un PDF construit din variabile poate lipsi din numărul `static_pdf_url_count`. Un URL prezent nu dovedește că linkul se deschide, că documentul este actual sau că formularul este acceptat la consulat. Validarea fiecărui PDF se face manual, în browser și, pentru disponibilitatea mobilă, pe iPhone Safari real.

Pentru fiecare ghid, păstrează separat dovada: instituție, procedură, document exact, URL oficial, scop (formular / informații / document de descărcat), data verificării, taxă, termen, condiții și diferențe între țări/consulate. Nu transforma niciun raport automat în `sale_approved=YES` sau `guide_approvals.status='approved'`.

Dacă operatorul are momentan numai exporturile private pentru `B5_DAMAGED` și `B5_DATA_CHANGE`, raportul poate identifica acele două ghiduri, dar va marca celelalte 41 ca lipsă **din fișierul verificat**, nu din D1. CLI va încheia cu cod 1 pentru că inventarul analizat este incomplet.

Nu încărca exporturi D1 cu `script_js` în GitHub, PR, CI, chat sau issue-uri. Comunică numai totalurile și codurile de avertizare, fără fragmente private.
