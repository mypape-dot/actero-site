# ActeRO: testare Shopify pe medii separate (fără deploy executat)

## Stare și implementare

Proprietarul a confirmat Worker `actero-staging`, D1 `actero-staging-db`, binding
`DB`, URL-uri publice oprite, migrarea 0001 înregistrată și 11 tabele. Dry-run-ul
pentru versiunea anterioară a trecut pe Mac. Nu reaplica și nu regenera 0001.

`environment.js` configurează backend-ul per cerere, fără stare globală mutabilă.
Fără variabile noi, valorile existente rămân:
`https://mypape-dot.github.io`, `gyfu4v-5q.myshopify.com`, `67640764400007`.
Staging cere valori explicite și respinge acea origine, acel shop, acea variantă
și orice mod de plată diferit de `test`. Un shop necompletat blochează checkout-ul
și webhook-urile cu 503; un origin invalid blochează API-ul. Nu există fallback
staging către producție. Preflight-urile CORS și recuperarea folosesc aceeași origine.

Checkout oprit blochează **numai cumpărări noi**. Accesul, recuperarea și webhook-urile
rămân disponibile cu configurație validă. Acest lucru permite finalizarea unei
plăți în curs, refunduri și revocări după oprirea vânzărilor. HMAC, magazinul,
varianta, suma și tokenurile continuă să fie validate. `test:true` este verificat
la plata primită; refundurile nu presupun existența acestui câmp în payload.

## Frontend recomandat: Cloudflare Pages Direct Upload separat

Proiect propus `actero-staging-ui`, origine propusă
`https://actero-staging-ui.pages.dev`. Disponibilitatea numelui nu este verificată.
Un proiect Pages separat oferă HTTPS și storage pe origine separată. Nu conecta
repository-ul la un deploy automat și nu folosi un subdirector al producției.
Într-un proiect Direct Upload, deploy-ul principal al proiectului **de staging**
folosește originea stabilă; un URL de preview cu hash ar fi altă origine CORS.

Generatorul `scripts/build-staging-frontend.mjs` copiază exclusiv cele trei pagini
publice, generează `actero-config.js`, `_headers`, `robots.txt` și manifestul build.
Nu copiază repository-ul, secrete, exporturi D1, backend sau ghiduri. Paginile
au un banner de test; scripturile chestionarului sunt copiate fără transformări.
`ACTERO_PAYMENT_API` este configurat pe artifact, iar `ACTERO_CHECKOUT_ENABLED=false`
ține butonul de plată oprit. Această opțiune nu blochează accesul/recuperarea plătite.
`noindex` nu este autentificare; accesul testerilor trebuie stabilit separat.

Din rădăcina repository-ului, doar generare locală (directorul țintă trebuie să fie nou):

```bash
mkdir -p ../work
node scripts/build-staging-frontend.mjs \
  --origin https://actero-staging-ui.pages.dev \
  --api-origin https://actero-staging.actedsro.workers.dev \
  --out ../work/actero-staging-ui-review
```

Acest pas nu rezervă domeniul și nu publică nimic. Dacă numele aprobat diferă,
folosește noua origine atât la build, cât și în variabilele Worker. Frontend-ul
public existent păstrează `ACTERO_PAYMENT_API=''` și nu este schimbat.

## Variabile Worker și secrete

Sincronizează copia **ignorată de Git** `wrangler.staging.local.json` cu șablonul
actualizat, păstrând Account ID și UUID-ul bazei staging deja verificate.
Nu suprascrie modificări locale fără review. Sunt opt variabile publice permise:

| Variabilă | Valoare în etapa curentă |
|---|---|
| `ACTERO_ENVIRONMENT` | `staging` |
| `APP_ORIGIN` | Originea HTTPS exactă aprobată, fără slash final/path |
| `SHOPIFY_SHOP_DOMAIN` | Domeniul real al **noului** dev store, fără protocol/path; inițial `UNBOUND_STAGING_SHOP` |
| `SHOPIFY_VARIANT_ID` | ID-ul numeric al variantei de test, ca string; inițial `UNBOUND_STAGING_VARIANT` |
| `SHOPIFY_PAYMENT_MODE` | `test` |
| `SHOPIFY_CHECKOUT_ENABLED` | `false` |
| `RECOVERY_REQUIRED` | `true` |
| `RECOVERY_PAGE_URL` | Exact `APP_ORIGIN` + `/recuperare.html` |

Binding `DB` → numai D1 staging. Nu schimba flags `workers_dev=false`,
`preview_urls=false` sau `routes=[]` în această etapă.

Separat, numai după aprobare, configurează valori **noi**, fără preluare din producție:

- `SHOPIFY_WEBHOOK_SECRET`: secretul sursei care va semna webhook-urile dev store.
  Nu confunda secretul webhook-urilor create în admin cu secretul altei aplicații.
- `ABUSE_HASH_PEPPER` și `RECOVERY_EMAIL_PEPPER`: valori aleatoare independente,
  fiecare minimum 32 de caractere; nu se schimbă în mijlocul acceptanței.
- `RECOVERY_EMAIL_API_KEY`: cheia Resend dedicată testelor.
- `RECOVERY_EMAIL_FROM`: adresă simplă verificată de expeditor, nu `Nume <adresă>`.
- `PAYMENT_ALERT_WEBHOOK_URL`: destinație de test compatibilă cu payload `{content}`.

Nu există credential real în fixture-uri. Nu pune secrete în vars, frontend,
SQL, argumente shell sau Git. Worker-ul nu necesită token Shopify Admin/Storefront.
Un eventual instrument de creare a subscriptions are propriile permisiuni de operator.
Validatorul local nu poate verifica existența magazinului, Test Mode sau proveniența
secretelor; acestea necesită verificare explicită în Dashboard înainte de activare.

## Shopify: magazin de dezvoltare și mod de plată de test

Acești pași sunt **pentru după aprobare**; nu au fost executați.

1. În Shopify Dev Dashboard, Stores → Create store → tip **Dev**. Creează un
   magazin separat, fără conectare la clienți, fulfillment sau servicii reale.
   Notează domeniul lui `*.myshopify.com`. Nu utiliza magazinul existent.
2. Creează numai produsul „ActeRO — ghid SINTETIC de test”, varianta 49 RON,
   disponibilă pentru Online Store. Fără shipping pentru produsul digital,
   reduceri sau conversie valutară; configurează checkout-ul de test să afișeze
   totalul convenit de 49 RON. Notează **variant ID**, nu product ID.
3. Recomandat pentru dev store: Settings → Payments → selectarea providerului
   **Test payment gateway** (denumit și Bogus Gateway în interfețe/documentație
   anterioare) → Activate → Save. Orice schimbare de provider se face exclusiv
   în dev store. Gateway-ul de test produce comenzi de test fără captură reală.
4. Dacă alegem explicit **Shopify Payments Test Mode**, verifică întâi eligibilitatea
   contului/regiunii și setup-ul necesar. Documentația generală menționează plan
   plătit și posibil informații comerciale; nu cumpăra un plan și nu activa plăți
   reale pentru a debloca testarea fără o decizie separată. În magazinul de test:
   Settings → Payments → Shopify Payments → Manage → Enable test mode → Save.
5. Verifică vizual modul de test. Folosește exclusiv datele de test publicate de
   provider, niciodată un card real. După comandă verifică banner-ul test și
   payload-ul `test:true`. Flag-ul Worker nu activează Shopify Test Mode.
6. Configurează după aprobare subscriptions JSON pe endpoint-urile staging:

| Topic așteptat | Path Worker |
|---|---|
| `orders/paid` | `/webhooks/shopify/orders-paid` |
| `refunds/create` | `/webhooks/shopify/refunds-create` |
| `orders/cancelled` | `/webhooks/shopify/orders-cancelled` |
| `disputes/create` | `/webhooks/shopify/disputes-create` |

Folosește versiunea API stabilă aleasă și confirmă payload-urile în testele reale
ale magazinului. Disponibilitatea disputelor depinde de provider/permisiuni;
simularea locală a disputelor nu dovedește livrarea lor de Shopify.
Nu trimite notificările magazinului de producție la staging. Nu configura secrete
comune. Cloudflare Access pe webhook fără o integrare corespunzătoare blochează Shopify.

7. Configurează revenirea din Thank-you/Order-status către frontend-ul staging
   `/confirmare.html`. Pagina poate folosi cazul din localStorage; nu include
   tokenuri în link. Integrarea concretă depinde de editorul/extensiile disponibile
   în magazin și trebuie verificată. `return_url` transmis de frontend NU configurează
   singur această revenire. La prima acceptanță controlată, revenirea poate fi
   manuală în același browser; marchează distinct acest pas, fără a pretinde redirect automat.

Surse oficiale consultate la 15 octombrie 2026:
- https://shopify.dev/docs/apps/build/stores/development-stores
- https://help.shopify.com/en/manual/checkout-settings/test-orders/payments-test-mode
- https://help.shopify.com/en/manual/payments/shopify-payments/testing-shopify-payments

## Ghid sintetic: pregătire locală, niciun import din producție

`tests/fixtures/synthetic-guide.mjs` este un singur renderer B1_ES de test, fără
instrucțiuni administrative. Îl folosesc și testele workerd. Generatorul de seed
produce două INSERT-uri: script și aprobare SHA-256 a exact acelui fixture.
Nu generează aprobări comerciale/country reviews. INSERT-urile nu suprascriu un ghid existent.

După completarea shop/variant reale de test, generează local un fișier NOU:

```bash
node cloudflare/staging/prepare-synthetic-seed.mjs \
  --config cloudflare/staging/wrangler.staging.local.json \
  --production-d1-id 52dfa127-44d1-4134-a8a9-56e4b5cad959 \
  --out ../work/actero-synthetic-seed.sql
```

Generatorul nu execută SQL. Aplicarea lui la D1 staging va necesita aprobare separată,
verificarea țintei și absența unui B1_ES existent. Nu utiliza `--remote` în etapa curentă.

## Verificări și acceptanță

Comenzi care se pot rula acum pe Mac, fără creare/deploy Cloudflare sau activare Shopify:

```bash
git status --short --branch
node cloudflare/staging/check-config.mjs \
  --config cloudflare/staging/wrangler.staging.local.json \
  --production-d1-id 52dfa127-44d1-4134-a8a9-56e4b5cad959
npm run check:staging
npm ci
npx playwright install chromium webkit
npm test
npm run test:staging
npm run check:public
```

După ce ai completat magazinul și varianta de test, adaugă `--require-ready` la
validator. Acesta cere valori explicite valide și separate, dar păstrează checkout
oprit și nu certifică Test Mode, secretele sau deployment-ul. Opțional, un nou dry-run:

```bash
node cloudflare/staging/check-config.mjs \
  --config cloudflare/staging/wrangler.staging.local.json \
  --production-d1-id 52dfa127-44d1-4134-a8a9-56e4b5cad959 --require-ready
WRANGLER_SEND_METRICS=false wrangler deploy \
  --config cloudflare/staging/wrangler.staging.local.json \
  --env staging --dry-run --outdir ../work/actero-staging-worker-review
```

E2E local folosește frontend-ul generat și o origine, un shop, o variantă și un
secret de staging sintetice. Checkout este activat **numai în fixture-ul din memorie**;
artifactul generat și configurațiile de deploy rămân oprite. Toate cererile externe
sunt interceptate. Nu există un simulator conectat pe ascuns la magazinul real.

După aprobări și configurare găzduită, criteriile de acceptanță sunt:

1. Chestionar → paywall 49 lei → checkout din dev store, fără card real.
2. Revenire înainte de webhook: niciun acces. Webhook HMAC greșit, shop greșit,
   sumă greșită sau comandă live: niciun grant plătit.
3. `orders/paid` valid: un singur grant, exact varianta/ghidul sintetic; retry nu
   dublează grantul. Tokenul se transmite prin header, nu URL.
4. Oprește cumpărările noi după crearea intent-ului, apoi livrează webhook-ul
   plății de test deja începute: acesta trebuie procesat și ghidul accesibil.
5. Recuperare în alt browser: mesaj de test, link pe originea staging, snapshot,
   token nou; tokenul vechi și reutilizarea linkului sunt respinse. Testează și expirarea.
6. Refund pentru varianta de test: accesul, redeschiderea și recuperarea sunt
   revocate. Un `orders/paid` întârziat nu reactivează grantul. Refundul trebuie
   să conțină itemul; un refund exclusiv monetar poate necesita review manual.
7. Retry la email/alerte indisponibile; anulare/dispută înaintea plății; limitele
   de concurență; originea de producție nu poate apela API-ul staging din browser.
8. Oprește checkout-ul la încheiere; păstrează webhook-urile funcționale pentru
   evenimentele în curs. Fără ștergeri automate, ghiduri reale sau activare live.

## Operații care așteaptă aprobarea proprietarului

- Crearea/publicarea proiectului Pages separat și expunerea API-ului staging.
- Crearea/configurarea dev store, produsului, providerului de test și subscriptions.
- Setarea secretelor noi, a sender-ului și a destinației de alerte.
- Deploy-ul Worker-ului și aplicarea seed-ului exclusiv în D1 staging.
- După verificarea magazinelor/secretelor: o schimbare explicit revizuită pentru
  activarea temporară a checkout-ului backend și a flag-ului frontend. Validatorul
  actual respinge intenționat checkout activ și rute publice; nu îl ocoli pentru deploy.

Nicio astfel de operație nu este executată de build, seed generator, teste sau CI.
