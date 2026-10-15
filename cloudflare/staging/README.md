# ActeRO staging separat — configurație pregătită, resurse necreate

La 15 octombrie 2026, proprietarul a verificat în Dashboard că există **numai**
Worker-ul `actero` (`https://actero.actedsro.workers.dev`) și D1 `actero-db`.
Nu există staging. Decizia este de a crea ulterior `actero-staging` și
`actero-staging-db`. **Crearea, deploy-ul, SQL-ul remote și setarea secretelor
nu sunt încă aprobate.** Această lucrare pregătește fișiere și teste locale.

## Fișierele pregătite

| Fișier | Rol |
|---|---|
| `wrangler.json.example` | Worker `actero-staging`, binding `DB` → `actero-staging-db`, mediu explicit `staging`; ID-uri placeholder nevalide |
| `migrations/0001-empty-staging.sql` | Schema completă pentru D1 nouă și goală: baseline + migrațiile existente 001–010 |
| `build-schema.mjs` | Generează/verifică offline reproducibilitatea acelei scheme; nu accesează baze |
| `check-config.mjs` | Verifică offline configurația inițială închisă și respinge ID-ul D1 de producție |
| `../tests/staging-isolation.test.mjs` | 18 regresii de configurație, schemă și pornire în workerd cu checkout oprit |

Șablonul nu este autodetectat ca fișier Wrangler. Nivelul implicit rămâne
`actero-unbound-do-not-deploy`, fără binding D1. Numai `env.staging` definește `DB`.
Checkout este `false`, payment mode este `test`, recovery este obligatorie,
iar URL-ul recovery `.invalid` este intenționat nefuncțional. Nu există routes,
workers.dev public, preview URLs, secrete sau job de deploy în CI.

`workers_dev=false` nu împiedică singur crearea/deploy-ul unui Worker de către
un operator autorizat. Numele diferite nu dovedesc singure izolarea bazei.

## Ce faci în Cloudflare când autorizezi crearea resurselor

Pașii următori sunt pentru proprietar/operator **după decizia explicită de
creare**, nu sunt operații executate de acest PR. Denumirile meniurilor pot varia
ușor în Dashboard. Nu conecta repository-ul la un deployment automat.

1. În contul corect, deschide **Storage & databases → D1 SQL Database → Create
   database**. Introdu exact `actero-staging-db`. Creează o bază nouă goală;
   nu importa/clona `actero-db`. Notează Account ID și UUID-ul noii baze din
   Overview/Settings. Dacă numele există deja, oprește și verifică proprietatea
   și conținutul; nu suprascrie nimic.
2. În **Workers & Pages → Create application → Create Worker** (sau **Start with
   Hello World**), folosește exact `actero-staging`. Păstrează numai răspunsul
   Hello World al Cloudflare, fără cod ActeRO, integrare Git sau secrete.
   Butonul Deploy de aici creează/publică acel placeholder și necesită aprobarea
   creării; nu reprezintă lansarea aplicației ActeRO.
3. În **actero-staging → Settings → Domains & Routes**, dezactivează ruta
   workers.dev și Preview URLs și nu adăuga domenii/rute de producție.
   Adresa probabilă este `https://actero-staging.actedsro.workers.dev`, dar trebuie
   confirmată în Dashboard; rămâne dezactivată până la aprobarea testării găzduite.
4. În **actero-staging → Settings → Bindings → Add binding → D1 database**,
   pune numele variabilei **`DB`**, selectează **`actero-staging-db`** și salvează.
   Nu selecta `actero-db` și nu adăuga service bindings spre `actero`.
5. În pagina **actero-staging-db**, verifică UUID-ul și că nu există tabele de
   aplicație. În pagina **actero-db**, citește numai UUID-ul pentru comparație;
   nu executa SQL, import sau migrare în producție. Verifică separat că
   **actero → Bindings** indică în continuare `actero-db`, fără modificări.
6. Păstrează o evidență cu cele două nume de Worker, cele două UUID-uri D1 și
   binding-ul fiecăruia. ID-urile nu sunt parole; nu trimite chei/API tokens în chat.
   În această etapă nu configura Shopify, secrete sau ghiduri.

Acești pași creează infrastructura izolată și un placeholder inofensiv. Publicarea
codului ActeRO, inițializarea D1 și configurarea secretelor sunt operații distincte,
care rămân condiționate de aprobarea proprietarului.

## Verificarea configurației înaintea oricărei operații remote

După ce resursele au fost create și identificate, copiază șablonul **în același
director** (căile `main` și `migrations_dir` sunt relative la configurație):

```bash
cp cloudflare/staging/wrangler.json.example cloudflare/staging/wrangler.staging.local.json
```

În copia ignorată de Git înlocuiește numai `account_id` cu ID-ul contului și
`env.staging.d1_databases[0].database_id` cu UUID-ul **noii** baze de staging.
Nu schimba numele, rutele, variabilele sau nivelul implicit. Apoi rulează offline,
înlocuind `UUID_PROD_CITIT_DIN_DASHBOARD` cu UUID-ul citit independent din producție:

```bash
node cloudflare/staging/check-config.mjs --config cloudflare/staging/wrangler.staging.local.json --production-d1-id UUID_PROD_CITIT_DIN_DASHBOARD
npm run check:staging
```

Validatorul respinge Worker-ul `actero`, numele D1 `actero-db`, UUID-uri identice
(inclusiv diferențe doar de majuscule), bindings suplimentare/la nivel implicit,
service bindings, routes, preview URLs, checkout activ, mod live și secrete în
vars. Lipsa UUID-ului de producție oprește verificarea configurației completate.
`--template` verifică numai șablonul cu placeholder-e; **nu** validează resurse reale.

Verificarea nu contactează Cloudflare și nu poate autentifica ID-urile introduse.
PASS-ul trebuie corelat cu binding-urile efective din Dashboard. Pentru eventuale
operații CLI folosește credențiale dedicate cu permisiunile minime disponibile;
dacă furnizorul permite doar drepturi D1 la nivel de cont, acestea **nu izolează
criptografic producția**. Un operator cu acces la ambele resurse poate ocoli
validatorul. Pentru o limită IAM strictă ar fi necesar un cont separat. Nu putem
promite risc zero doar din două nume diferite în același cont.

## Schema și migrarea — doar după aprobarea inițializării D1 staging

`0001-empty-staging.sql` este o singură migrare inițială, cu toate cele 11 tabele
de aplicație. Include indexul unic pentru `shopify_order_id`, sesiuni, cote,
evenimente, revocări, recuperare și aprobările de ghid. Nu introduce niciun rând,
ghid, aprobare sau client. Baseline-ul reflectă contractul local al codului;
nu pretinde că reproduce schema curentă a producției.

- Se aplică **numai unei D1 staging demonstrat goale**. Preexistența oricărui
  tabel de aplicație cere oprire și analiză separată. Nu se șterg tabele ca să
  treacă bootstrap-ul. Reaplicarea SQL brut peste ActeRO inițializat eșuează la
  `CREATE TABLE access_grants` fără a rescrie rândurile existente.
- Nu aplica separat și `001`–`010`: sunt deja incluse. `migrations_dir` indică
  exclusiv `./migrations`; Wrangler ține evidența în `d1_migrations`.
- Pentru verificarea bazei **selectate explicit ca staging**, interogarea read-only
  este `SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE
  'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations';`. Înainte de
  bootstrap trebuie să nu returneze tabele. Aceasta nu se execută pe `actero-db`.
- După prima aplicare găzduită, îngheață migrarea 0001 și sursele sale; schimbările
  viitoare primesc migrații numerotate noi. Nu regenera un bootstrap deja aplicat.

Comenzi de referință **neexecutate**, pentru operator cu Wrangler instalat și
aprobare de migrare acordată. Din rădăcina repository-ului, numai după verificările
anterioare, fără a omite `--config`, `--env staging` sau numele exact al bazei:

```bash
wrangler d1 migrations list actero-staging-db --config cloudflare/staging/wrangler.staging.local.json --env staging --remote
wrangler d1 migrations apply actero-staging-db --config cloudflare/staging/wrangler.staging.local.json --env staging --remote
```

După aplicare, confirmă în noua bază migrarea `0001-empty-staging.sql` în ledger,
11 tabele de aplicație și zero rânduri în ele. Nu introduce ghiduri premium.
În testele locale se adaugă ulterior **numai** renderer-ul sintetic B1_ES și
aprobarea sa de test. Nu există seed automat pentru resursele Cloudflare.
Comenzile Wrangler remote și autentificarea nu au fost validate pe un cont real.

## Ce mai trebuie pregătit înaintea testării găzduite

- **Frontend HTTPS separat.** Originea este încă fixată la
  `https://mypape-dot.github.io` în `worker.js`, `recovery.js` și
  `evaluation-session.js`. O variabilă inventată `APP_ORIGIN` nu ar schimba codul.
  Trebuie ales domeniul de staging, configurat și testat coerent CORS/recovery,
  apoi conectată numai copia frontend de staging la API. Separarea doar printr-un
  path GitHub Pages nu izolează localStorage. Checkout-ul frontend-ului public rămâne oprit.
- **Shopify separat.** Shop și variantă sunt încă fixe în cod. Pentru magazinul
  de dezvoltare trebuie o schimbare explicită și teste. `SHOPIFY_PAYMENT_MODE=test`
  verifică payload-ul, dar **nu activează Test Mode în Shopify și nu împiedică
  debitarea unui card** dacă magazinul este live. Nicio activare Shopify acum.
- **Secrete noi, dedicate testelor**, numai după aprobare:
  `SHOPIFY_WEBHOOK_SECRET`, `ABUSE_HASH_PEPPER`, `PAYMENT_ALERT_WEBHOOK_URL`,
  `RECOVERY_EMAIL_PEPPER`, `RECOVERY_EMAIL_API_KEY`, `RECOVERY_EMAIL_FROM`.
  Fără reutilizarea valorilor de producție; alerte/sender/căsuță dedicate testelor.
- **Expunere și integrare.** Activarea endpoint-ului staging și schimbarea
  configurației inițiale închise necesită un nou review. Nu adăuga rute de producție.
  Configurează cele patru webhook-uri și linkul Thank-you/Order-status numai în
  magazinul de test aprobat. Cloudflare Access fără integrare pe webhook ar bloca
  Shopify. `return_url` trimis de frontend nu produce automat revenirea din Shopify.
- **Acceptanță găzduită.** Plată în Test Mode → acces → ghid sintetic → recuperare
  → refund/anulare/dispută → revocare, inclusiv retry și validarea livrării email.
  Apoi checkout staging oprit conform planului aprobat, fără ștergeri automate.

## Teste locale executabile acum

Fără Wrangler, secrete, acces Cloudflare sau modificări Shopify:

```bash
npm test
npm run check:staging
ACTERO_TEST_BROWSERS=chromium ACTERO_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:staging
npm run check:public
```

Miniflare aplică exact `migrations/0001-empty-staging.sql` într-o D1 temporară.
Cele 9 teste de eșec și fluxul E2E existent folosesc această schemă. Browserul și
Worker-ul blochează traficul extern; Shopify, emailul și alertele sunt simulate.
CI rulează și WebKit mobil. Testele nu constituie dovadă pentru o plată Shopify
reală de test sau pentru infrastructura Cloudflare încă necreată.
