# ActeRO — audit PRIVAT (doar citire) al celor 12 ghiduri FR/BE/NL/IE

**Stadiu: mecanism local de diagnostic, fără aprobare editorială.** Scriptul nu poate accesa D1 din GitHub Actions și nu primește conturi sau tokenuri în repository. Operatorul îl rulează pe Mac în propriul cont Cloudflare.

## Sfera

12 ghiduri individuale: `B1_FR/BE/NL/IE`, `B5_RENEWAL_FR/BE/NL/IE` și `B5_LOST_FR/BE/NL/IE`.

- **Ce verifică:** exact 12 chei și rute corecte, prezența scripturilor (nu goale), sintaxă JavaScript *fără execuție*, indicii de surse oficiale, date neverificate, placeholder-uri și atenționări specifice fiecărei țări.
- **Ce NU verifică:** corectitudinea procedurală/juridică, eligibilitatea fiecărui client, linkuri PDF accesibile, afișarea reală, completitudinea documentelor, actualitatea tarifului, plata și accesul post-plată.
- **Confidențialitate:** transmite `script_js` numai printr-un pipe local Wrangler → Node; nu salvează exportul, nu execută JS-ul, nu afișează textul. Nu activa debugging (`set -x`), nu folosi `tee`, nu urca datele în GitHub, nu partaja outputul SQL.

## Pe Mac — comandă după selectarea ramurii

**O singură dată**, din repository, treci pe ramura separată de audit *fără să pierzi modificările nepublicate*:

```bash
cd ~/Desktop/actero-site
git fetch origin audit/private-12-guide-preflight-20261014
git switch audit/private-12-guide-preflight-20261014 || git switch --track origin/audit/private-12-guide-preflight-20261014
git pull --ff-only
```

Dacă o comandă Git refuză din cauza fișierelor modificate, **oprește-te**, nu folosi `git reset --hard`, `git clean` sau `git switch -C`. Aceasta este o ramură Draft care nu a fost integrată în `main`.

**Rulează testul doar pe computerul propriu și cu acces Cloudflare autorizat**:

```bash
bash cloudflare/audit-private-12-on-mac.sh
```

`npx wrangler` poate cere autentificare sau confirmarea instalării CLI-ului. În timpul execuției se folosește exclusiv `SELECT guide_key,route,script_js` pentru cele 12 chei. Nu se face `UPDATE`, migrare, deploy sau comandă Shopify.

## Interpretarea rezultatelor

- `STRUCTURE_OK`: există cheia așteptată, ruta, script nenul și sintaxă JS validă. **Nu** înseamnă procedură oficială aprobată.
- `BLOCKED`: ghid/rută lipsă, greșită, invalidă sau incompletă. Necesită diagnostic manual, fără a afișa scriptul.
- `REVIEW_...`: aspect editorial care trebuie inspectat de un operator; un semnal poate exista chiar dacă textul explică deja condiția corect.
- `NOT APPROVED FOR SALE`: se afișează permanent, inclusiv pentru 12/12 rezultate structurale bune.

Dacă apare un mesaj de eroare, trimite doar codurile `BLOCKED`/`REVIEW` sau numărul de ghiduri `STRUCTURE_OK`. **Nu trimite niciodată** `script_js`, JSON-ul din D1, comenzi ce includ tokenuri ori date personale.

## Cazuri editoriale de verificat după rezultat

1. FR: condițiile pentru dovezile subsidiare din fișa DGP 2022 și diferența dintre prima solicitare și reînnoire.
2. BE: dacă documentul este o cerere de înregistrare (anexa 19) ori dovadă de rezidență acceptată pentru CRDS românesc.
3. NL: extras de rezident BRP versus RNI/BSN.
4. IE: PPS/IRP versus dovadă efectivă de reședință a unui cetățean român.
5. Toate: instituție, documente originale, traduceri, termene, taxe, PDF-urile promise și pași afișați pe iPhone Safari.

**Niciunul dintre cele 12 ghiduri nu primește automat `sale_approved=YES`**. Orice aprobare trebuie făcută privat pentru exact scriptul/sursa verificată.
