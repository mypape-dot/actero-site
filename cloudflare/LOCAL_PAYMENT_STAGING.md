# Staging local pentru plăți și livrare — fără servicii externe

Acest mediu rulează codul real din `worker.js` în workerd/Miniflare, cu D1 local
temporar și frontend-ul real în Playwright. Shopify, emailul și alertele sunt
simulate. Nu există nicio comandă de deploy, migrare remote sau plată reală.

## Rulare

Node 22+ și npm:

```bash
npm ci
npm test
npm run check:public
npx playwright install --with-deps chromium webkit
npm run test:staging
```

Într-un mediu care are Chromium de sistem, dar blochează descărcările Playwright:

```bash
ACTERO_TEST_BROWSERS=chromium ACTERO_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:staging
```

Această a doua comandă validează numai Chromium. Nu reprezintă PASS WebKit/Safari.
CI rulează implicit Chromium desktop și WebKit la viewport mobil.

`npm test` include toate fișierele `*.test.mjs` independente. Validatorul CLI
`b5-review-draft.test.mjs` are nevoie de un fișier de intrare și este rulat separat
în jobul browser existent, cu fixture sintetic, ca înainte.

## Izolarea datelor și a rețelei

- Se creează o bază locală goală aplicând exact migrarea pregătită pentru staging,
  `staging/migrations/0001-empty-staging.sql` (baseline + 001–010). Testul de
  echivalență o compară cu migrațiile originale; aceasta nu este schema constatată a D1 live.
- Se introduce numai un renderer `B1_ES` sintetic, care afișează titlul de test și
  țara din răspunsuri. Aprobarea sa este exclusiv pentru această bază temporară.
  Nu sunt citite sau aprobate ghidurile private reale.
- Configurația publică `actero-config.js` rămâne goală. Playwright înlocuiește
  numai răspunsul HTTP interceptat în test.
- Toate cererile browserului sunt interceptate. Pagina Shopify este un ecran
  explicit de simulare; nu există conexiune la magazin.
- Toate apelurile externe Worker sunt oprite de `outboundService`. Emailurile și
  alertele sunt colectate în memorie; alte destinații sunt respinse.
- Se folosesc numai chei fictive și adrese `.test`, fără încărcarea vreunui `.env`,
  `.dev.vars`, export D1 sau credențial de operator.
- Baza temporară și runtime-ul sunt închise la terminare, inclusiv la eșec.

## Ce verifică fluxul

1. Clickuri prin chestionarul existent până la paywall-ul de 49 lei.
2. `/session`, ownership, `/checkout`, intent și permalink Shopify fără tokenuri.
3. Revenire înainte de plată: acces blocat; semnătură falsă și magazin greșit respinse.
4. Webhook de test semnat: acces acordat exact o dată; cheie greșită și token în URL respinse.
5. Confirmare → descărcare autorizată → execuție renderer sintetic → refresh.
6. Retragerea aprobării blochează redeschiderea în aceeași filă.
7. Recuperare în alt context de browser, inclusiv navigare doar prin fragment în
   pagina deja deschisă; restaurare răspunsuri, rotație token și link de unică folosință.
8. Refund semnat: livrare, redeschidere și recuperare blocate; webhook paid întârziat nu reactivează accesul.

Testele `payment-security.test.mjs` acoperă suplimentar sume lipsă/NaN/Infinity,
discounturi, preț diferit de 49 RON, separarea test/live, concurența asupra aceleiași
comenzi, migrarea cu duplicate și limita atomică de trei emailuri per comandă/oră.

Miniflare este fixat la versiunea stabilă `4.20260730.0`. Override-urile de test
`sharp@0.35.5` și `undici@7.29.1` elimină advisory-urile din dependențele versiunii
stabile. Fluxul workerd/D1 este retestat cu acestea; niciuna nu intră în bundle-ul
Worker publicat. `npm audit` a raportat zero vulnerabilități la 15 octombrie 2026.

## Staging găzduit: încă nevalidat

Proprietarul a creat separat `actero-staging` și `actero-staging-db` și a aplicat
bootstrap-ul 0001. Codul și serviciile externe nu sunt încă activate de agent.
Configurația și pașii următori sunt în [`staging/README.md`](staging/README.md) și
[planul Shopify Test Mode](staging/SHOPIFY_TEST_SETUP.md).

Fluxul browser folosește acum frontend-ul generat pe o origine staging sintetică,
un shop, o variantă și un secret distincte. Flag-ul de checkout este activat numai
în răspunsul interceptat în test; artifactul de publicat rămâne dezactivat.

`npm run check:staging` verifică offline șablonul închis și schema generată.
`staging-isolation.test.mjs` adaugă 18 teste pentru configurații greșite (inclusiv
UUID de producție sub nume de staging), echivalența schemei, bootstrap repetat și
comportamentul real workerd cu checkout oprit, fără date sau aprobări.

`npm run test:staging:failures` rulează suplimentar 9 teste pe workerd/D1 locale:
email indisponibil și retry, alertă de plată indisponibilă, revocare cu alertă
eșuată, anulare/dispută înaintea plății, link expirat, link emis înaintea revocării,
consum concurent și limita de emailuri concurente. Comanda `npm run test:staging`
rulează această suită înaintea fluxului în browser. Niciun serviciu extern nu este apelat.

Nu trata simulatorul ca dovadă pentru formatul curent al payload-urilor Shopify,
aplicarea reală a proprietăților permalink-ului, Test Mode al magazinului, email
livrat sau migrații D1 remote. Acestea necesită un mediu izolat configurat și
verificarea operatorului, în limitele aprobării proprietarului.

Pentru o viitoare migrare 010: verifică duplicatele prin SELECT înaintea oricărui
DDL, fă backup și oprește dacă există mai multe granturi cu același order ID.
Nu șterge automat granturi și nu rula acest SQL în producție din acest runbook.

`return_url` transmis de frontend nu produce o redirecționare Shopify: Worker-ul
nu îl folosește în permalink. Revenirea din Shopify trebuie configurată și
verificată explicit. Simulatorul navighează controlat către confirmare.
