# Frontend staging și Shopify: implementare pentru review

Ramură: `draft/staging-shopify-environments-20261016`, derivată din PR Draft #16
la `2eafee2`. Include implementarea locală păstrată în `812e577` și raportul
`470c1b9`; nu reconstruiește funcționalitățile existente. PR-ul nou trebuie să
aibă baza `draft/shopify-worker-security-20261015`, nu `main`.

## Ce este implementat

- `cloudflare/environment.js`: API-ul selectează explicit originea, shop-ul și
  varianta pentru staging. Valorile implicite existente de producție sunt păstrate.
  Staging fără configurare validă nu moștenește valorile de producție.
- Worker, sesiune și recuperare folosesc aceleași reguli CORS. URL-ul recuperării
  trebuie să aparțină originii configurate. Webhook-urile verifică HMAC, magazinul,
  topicul, produsul și plata de test, inclusiv când checkout-ul este oprit.
- `scripts/build-staging-frontend.mjs`: artifact separat pentru Cloudflare Pages
  Direct Upload, șapte fișiere publice, API configurabil, banner sintetic și checkout
  oprit. Nu publică nimic. Originea propusă este `https://actero-staging-ui.pages.dev`;
  numele nu este rezervat. Pages oferă HTTPS și origine/storage separate de site-ul public.
- În `index.html` sunt numai trei modificări la integrarea plății pentru flag-ul
  `ACTERO_CHECKOUT_ENABLED`. Motorul de decizie nu este modificat. Generatorul
  păstrează scripturile HTML, astfel încât actualizările motorului pot fi preluate
  prin regenerarea artifactului, fără o copie separată a motorului.
- Un singur ghid sintetic comun testelor și seed-ului. Seed-ul conține două INSERT-uri
  fără overwrite: script și aprobarea SHA-256 a fixture-ului. Nu există ghid premium.
- Testele staging folosesc schema exactă `0001-empty-staging.sql`, deja aplicată de
  proprietar. Nu este necesară o migrare nouă și migrarea aplicată nu a fost schimbată.
- Checkout rămâne `false` atât în configurația Worker, cât și în artifactul frontend.
  Activarea există numai în fixture-urile sintetice din memorie.

## Verificări locale la 16 octombrie

| Verificare | Rezultat |
|---|---|
| `node cloudflare/tests/environment-separation.test.mjs` | 15/15 PASS |
| `node cloudflare/tests/payment-security.test.mjs` | 17/17 PASS |
| `node cloudflare/tests/checkout-frontend.test.mjs` | 10/10 PASS |
| `node cloudflare/tests/recovery.test.mjs` | 15/15 PASS |
| `npm run check:staging` și validatorul fișierului local cu UUID producție | PASS, configurație închisă |
| `npm run check:public`, `git diff --check` | PASS |
| Generator frontend cu originile propuse | PASS, 7 fișiere, checkout oprit |
| `npm test` | 29/31 fișiere PASS; două eșecuri, detalii mai jos |
| `node cloudflare/tests/payment-journey.browser.mjs` | Blocat înainte de pornirea browserului: `listen EPERM 127.0.0.1` |

Suita completă nu este verde în acest executor: `staging-isolation.test.mjs` nu
poate porni Miniflare, iar `audit-d1-metadata.test.mjs` întâlnește stdout gol la
subprocesul CLI (JSON parse). Aceste limitări au fost observate și anterior;
testele nu au fost eliminate sau marcate artificial ca trecute. Testele browser
și cele nouă teste workerd de avarie trebuie executate pe Mac/CI. CI-ul verde al
commitului `2eafee2` nu validează modificările acestei ramuri.

Cele 15 teste de mediu includ: CORS și configurație separată; webhook de la shop
greșit/HMAC greșit/variantă greșită/comandă live; plată și refund cu checkout oprit;
anulare/dispută; lipsa tokenului, token fals, token în URL, token al altui caz sau
al altei baze; recuperare cu rotație și link nereutilizabil; renderer sintetic
personalizat din snapshot; revocare inclusiv după recuperare. CORS nu înlocuiește
autorizarea: testele de token funcționează și pe cereri fără header `Origin`.

## Configurări manuale și pasul următor

Instrucțiunile complete sunt în [SHOPIFY_TEST_SETUP.md](SHOPIFY_TEST_SETUP.md).
Nu repeta migrarea sau crearea Worker/D1 deja finalizate.

1. Pe Mac, preia ramura nouă după publicarea ei și păstrează fișierul local ignorat
   de Git. Rulează `npm ci`, `npx playwright install chromium webkit`, `npm test`,
   apoi `npm run test:staging`. Acesta este următorul pas înainte de testarea găzduită.
2. După aprobare, creează proiectul Pages **Direct Upload** separat, fără conectare
   Git pentru deploy automat; confirmă originea stabilă. Aceeași origine trebuie
   să apară în build, `APP_ORIGIN` și `RECOVERY_PAGE_URL`.
3. Creează/configurează exclusiv dev store Shopify separat și produsul sintetic de
   49 RON; configurează un gateway de test sau Shopify Payments în Test Mode.
   Verifică efectiv modul în Shopify: `SHOPIFY_PAYMENT_MODE=test` verifică webhook-ul,
   dar nu activează providerul. Nu utiliza un card real.
4. Configurează shop/variant staging și secrete noi: webhook, cei doi pepperi,
   Resend/sender și alerte de test. Nu reutiliza secrete sau conturi comerciale.
   Rulează validatorul cu `--require-ready`; checkout rămâne oprit.
5. După review și aprobare distinctă: expune API-ul staging, publică Worker-ul și
   frontend-ul separat, aplică numai seed-ul sintetic și configurează subscriptions
   Shopify/legătura de revenire. Validatorul actual respinge deliberat rute publice
   și checkout activ; orice schimbare a acestor protecții trebuie revizuită explicit.
6. Numai după verificarea separării și aprobarea activării temporare: parcurge
   chestionar → 49 lei → comandă de test → webhook → ghid sintetic → recuperare
   în alt browser → refund → revocare. Reînchide checkout-ul la final.

## Limite rămase

Nici frontend-ul, nici noul Worker nu sunt publicate. Dev store, Test Mode,
emailul, returul din Shopify și subscriptions nu au fost verificate găzduit.
Webhook-urile nu pot ajunge la Worker cât timp toate URL-urile/rutele sunt oprite.
Cloudflare Access trebuie proiectat astfel încât să nu blocheze Shopify pe endpoint-urile
webhook. `noindex` nu este control de acces. Refundurile fără linia produsului pot
necesita intervenție manuală; simularea disputelor nu dovedește suportul providerului.

Nicio resursă Cloudflare/Shopify nu a fost creată sau modificată în această sesiune.
Fără deploy, merge, migrare remote, secret real, tranzacție reală sau import premium.

## Publicarea Draft PR-ului: blocată în acest mediu

La 16 octombrie, `git push` pentru ramura nouă a eșuat deoarece proxy-ul GitHub
nu este accesibil (`Failed to connect to proxy port 8080`). Încercarea prin
conectorul GitHub de a crea ramura a fost refuzată: `MCP tool call requires approval,
but approval policy is never`. Noul Draft PR nu a fost creat; PR #16 rămâne la
`2eafee2`. Nu confunda commiturile locale cu o versiune publicată pe GitHub.

În workspace este pregătit un bundle incremental verificat, în
`/workspace/work/actero-audit/actero-staging-20261016.bundle`, cu baza `2eafee2`.
Nu conține configurația locală ignorată de Git sau exporturi D1. După transferul
bundle-ului pe Mac, din checkout-ul care conține deja baza:

```bash
git status --short --branch
git bundle verify /cale/catre/actero-staging-20261016.bundle
git fetch /cale/catre/actero-staging-20261016.bundle \
  refs/heads/draft/staging-shopify-environments-20261016:refs/heads/draft/staging-shopify-environments-20261016
git switch draft/staging-shopify-environments-20261016
```

Păstrează eventualele modificări locale înainte de switch. După testele de mai sus,
publicarea acestei ramuri și deschiderea unui PR Draft către ramura PR #16 sunt
autorizate de solicitare; blocajul curent este al instrumentelor, nu o aprobare
suplimentară necesară din partea proprietarului. Deploy-ul rămâne neautorizat.
