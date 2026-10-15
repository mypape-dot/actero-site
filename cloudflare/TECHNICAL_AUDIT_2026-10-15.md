# ActeRO — audit tehnic Shopify, Worker, plăți și livrare

Data: 15 octombrie 2026. **Draft; produsul nu este pregătit pentru vânzare.**

Handoff-ul atașat a fost citit integral ca document de context. Domeniul lucrării
este cel cerut de proprietar: integrare, securitate, plăți și livrare. Nu au fost
modificate motorul de selecție a procedurilor sau textele celor 43 de ghiduri.

## Repository și ramuri

- Repository public: `mypape-dot/actero-site`.
- Referința solicitată există pe GitHub: `audit/private-12-procedural-qa-20261014`.
- Nu exista inițial în checkout-ul mediului; a fost adusă prin `git fetch`.
- Bază exactă: `b8c50092f2115fc8dd83ca39d34cc8d905c1ab9b`.
- Ramură separată: `draft/shopify-worker-security-20261015`.
- PR-ul este destinat ramurii de referință, în stare Draft, fără merge în `main`.

## Ce exista deja și a fost păstrat

| Componentă | Constatare în cod și teste locale |
|---|---|
| Chestionar și paywall | Frontend existent, preț afișat 49 lei, răspunsuri salvate local. Nicio reconstrucție. |
| Ownership | `/session` emite case ID și secret aleator, păstrează numai hashul și expiră după 48 h. |
| Checkout | `/checkout` cere ownership/token anterior, verifică cheia și aprobarea exactă SHA-256; shared B5 cere toate cele 10 aprobări. Creează intent și permalink Shopify. |
| Webhook | HMAC pe corpul brut, shop/topic validate, evenimente persistate, incidente `needs_review` și alertă cu retry. |
| Acces | Grant pentru exact o cheie, token în header, răspunsuri `no-store`; vechiul `/guide` răspunde 410. |
| Livrare | Frontend încarcă scriptul autorizat și aplică răspunsurile; accesul și aprobarea sunt verificate de Worker. |
| Recuperare | Email și număr de comandă, email hashuit, link 256 biți cu hash în D1, expirare 30 min, consum unic și rotație token. |
| Revocare | Refund pe produs, anulare și dispută; tombstone împiedică reactivarea prin eveniment paid întârziat. Refundul ambiguu al unui grant existent rămâne pentru operator. |
| Protecții | Quota per IP hashuit, CAS/loturi D1, registru editorial, guard pentru fișiere premium publice. |
| Configurație publică | `actero-config.js` rămâne gol: checkout dezactivat în versiunea publică Draft. |

Aceste constatări privesc ramura și testele locale. Nu atestă versiunea deployată,
schema D1 live sau starea curentă a Shopify. Valorile istorice din handoff nu au
fost transformate în afirmații despre infrastructura actuală.

## Probleme reproduse și corectate

| ID | Înainte | Corecție și dovadă |
|---|---|---|
| T01 | `Number(undefined)`/`Number('NaN')` evita comparația cu prețul minim; un corp semnat cu sume lipsă/nevalide putea acorda acces. Prețurile peste 49 și anumite discount allocations erau acceptate. | Parser monetar strict în bani; linia trebuie să coste exact 4.900 bani, totalul să fie valid și cel puțin 4.900, fără discount pe linia ActeRO. Payload neconform → `needs_review`, fără grant. |
| T02 | Nicio separare server între comenzi Shopify de test și reale. | `SHOPIFY_PAYMENT_MODE` implicit `test`, cere booleanul literal `test:true`; `live` cere `test:false`; configurație nevalidă blochează checkout. Acesta este un filtru de webhook, nu activarea Test Mode la Shopify. |
| T03 | Același order ID putea fi asociat mai multor case ID-uri în payload-uri semnate diferite; intent-ul putea deveni paid deși grantul nu fusese actualizat. | Verificare owner, condiție SQL în tranzacție și index unic propus în migrarea 010. Intent-ul este paid numai dacă există grantul corespunzător. Test de concurență și test de migrare cu duplicate. |
| T04 | Limita de 3 emailuri/comandă/oră era verificată prin SELECT separat; 7 cereri simultane au produs 7 emailuri în testul de regresie. | Rezervare atomică prin `INSERT ... SELECT ... WHERE count<3`. Aceleași 7 cereri produc cel mult 3 emailuri; toate răspunsurile rămân generice. |
| T05 | Scriptul încărcat anterior putea fi redeschis din cache fără revalidarea tokenului, revocării sau aprobării. | Fiecare deschidere trece prin endpoint-ul protejat. Testul workerd/browser retrage aprobarea și apoi revocă plata, verificând blocarea redeschiderii. Conținutul deja descărcat nu poate fi șters de la client. |
| T06 | Linkul de recuperare deschis în pagina deja afișată schimba doar fragmentul; handlerul de inițializare nu mai rula. | Handler `hashchange`, eliminarea imediată a secretului din URL și pornirea recuperării. Reprodus în browser real; regresie suplimentară în testul paginii. |
| T07 | Confirmarea unei comenzi revocate continua să afișeze așteptarea plății. | Stare explicită „Accesul la ghid a fost retras”, buton blocat și mesaj să nu se repete plata. Testată după refund în browser. |

Primele 15 regresii noi au eșuat pe codul inițial și au trecut după corecții.
Alte două teste verifică tranzacțiile concurente și oprirea migrării la duplicate.

## Staging local reproductibil

A fost adăugat un harness care folosește Worker-ul real în workerd/Miniflare și D1
local temporar. Se aplică baseline-ul sintetic și migrațiile 001–010, apoi se
introduce numai un ghid de test minimal. Nu se citește D1 remote și nu se copiază
niciun ghid premium în GitHub. Aprobările din fixture nu afectează registrele reale.

Browserul parcurge interfața existentă:

`Chestionar → Paywall 49 lei → Checkout Shopify SIMULAT → Webhook HMAC → Grant → Confirmare → Ghid sintetic personalizat → Recuperare în alt context → Revocare`.

Worker-ul nu poate ieși în rețea: mail și alerte sunt colectate în memorie, iar
celelalte destinații sunt respinse. Toate cererile browserului sunt interceptate.
Permalink-ul real este verificat ca format, dar navigarea sa este înlocuită cu o
pagină care spune explicit că este simulare. Nu este o tranzacție Shopify Test Mode.

Instrucțiuni: [LOCAL_PAYMENT_STAGING.md](LOCAL_PAYMENT_STAGING.md).

## Verificări efectuate

| Verificare | Rezultat local |
|---|---|
| `npm test` | **160/160** intrări Node PASS, zero skipped. Include regresiile existente și cele 17 noi de securitate. Unele fișiere rulează intern mai multe scenarii sintetice. |
| Flux integrat Chromium + workerd/D1 | **6/6 grupuri PASS**: paywall/checkout; acces neplătit/HMAC; livrare/refresh/cheie; aprobare retrasă; recuperare/rotație/replay; refund/revocare/eveniment întârziat. |
| Guard suprafață publică | PASS; nu dovedește eliminarea conținutului din istoricul Git sau `main`. |
| Sintaxă Worker/recovery și `git diff --check` | PASS. |
| `npm audit` | Zero vulnerabilități raportate la data auditului, inclusiv dependențele de test. |
| WebKit local | **Nerulat**: descărcarea browserului a fost refuzată de politica de rețea. CI este configurat să ruleze Chromium și WebKit. |
| Shopify/Cloudflare/email găzduite | **Nerulat**: lipsesc accesul și configurația izolată; nu s-a activat Shopify și nu s-au folosit credențiale reale. |

Comanda inițială generică `node --test cloudflare/tests/*.test.mjs` a inclus și
validatorul CLI `b5-review-draft.test.mjs`, care necesită un fișier de intrare;
acel apel a eșuat din lipsa argumentului. Runnerul `npm test` exclude explicit
acest CLI; jobul browser existent continuă să-i genereze fixture-ul și să-l execute.
Nu a fost eliminată nicio verificare din CI.

Dependențele sunt fixate prin lockfile. Miniflare stabil necesita actualizări ale
dependențelor `sharp` și `undici`; override-urile sunt documentate și fluxul local
a fost retestat cu ele. Acestea sunt unelte de dezvoltare, nu dependențe ale Worker-ului livrat.

## Fișiere modificate sau adăugate

- Runtime: `cloudflare/worker.js`, `cloudflare/recovery.js`, `index.html`,
  `confirmare.html`, `recuperare.html`.
- Migrare propusă: `cloudflare/010-order-uniqueness.sql`.
- Teste: `cloudflare/tests/payment-security.test.mjs`,
  `cloudflare/tests/payment-journey.browser.mjs`,
  `cloudflare/tests/helpers/payment-harness.mjs`,
  `cloudflare/tests/helpers/local-worker.mjs`,
  `cloudflare/tests/fixtures/local-baseline.sql`.
- Fixture-uri și regresii existente: `cloudflare/tests/audit-payment.test.mjs`,
  `cloudflare/tests/recovery.test.mjs`, `cloudflare/tests/recovery-page.test.mjs`.
- Tooling/CI: `package.json`, `package-lock.json`, `.gitignore`,
  `scripts/test-unit.mjs`, `.github/workflows/actero-release-guard.yml`.
- Documentație: `README.md`, `cloudflare/README.md`, `CONFIRMARE_FLUX.md`,
  `cloudflare/LOCAL_PAYMENT_STAGING.md`, acest raport.

## Blocaje și limite rămase

1. **Expunerea istorică a ghidurilor.** Arborele `origin/main` încă enumeră vechile
   fișiere HTML/QA și backend-ul anterior. Curățarea istoriei, repo nou, domeniu
   dedicat și retragerea vechiului Pages necesită decizia proprietarului; nu au fost făcute.
2. **Niciun ghid aprobat comercial.** Registrul public rămâne 43/43 `sale_approved=NO`,
   iar cele 40 subrevizuiri shared B5 rămân `NO`. Claude/reviewerul autorizat verifică
   motorul și conținutul privat. Scripturile reale D1 nu au fost accesate aici.
3. **Staging găzduit absent din acest mediu.** Starea Worker live, schema și migrațiile
   reale D1, backup/restore și identitățile de acces nu sunt verificate. Baseline-ul
   local nu trebuie aplicat unei baze existente. Migrarea 010 nu a fost aplicată remote.
4. **Shopify real neverificat.** Test Mode actual, parola magazinului, varianta,
   moneda/prețul, proprietățile din permalink și webhook subscriptions trebuie
   confruntate cu o comandă de test autorizată. Filtrarea `order.test` nu împiedică
   magazinul să debiteze un card dacă operatorul l-a configurat greșit.
5. **Revenirea după Shopify.** `return_url` trimis de frontend nu este folosit de
   Worker și nu produce redirect automat. Linkul Thank-you/Order-status trebuie
   configurat separat. Simulatorul navighează controlat către confirmare.
6. **Email și operațiuni.** Sender verificat, livrare/bounces, alerte, incident response,
   reinstalarea manuală a accesului după dispute și tratarea refundurilor ambigue
   sunt încă de verificat în staging real. Nu există automatizare de suport/refund.
7. **Date și domeniu.** CORS și URL-urile rămân pe originea comună GitHub Pages;
   izolarea localStorage prin domeniu propriu și CSP sunt nerezolvate. Retenția,
   ștergerea evaluărilor și curățarea cotelor/sesiunilor necesită o politică operațională.
8. **Versiunea cumpărată.** Nu există arhivare/versionare per achiziție a ghidului.
   Retragerea aprobării sau schimbarea scriptului blochează livrarea până la o nouă
   aprobare; suportul pentru cumpărător trebuie stabilit înainte de producție.
9. **Identitatea pentru recuperare.** Comenzile fără email verificabil, număr compatibil
   sau snapshot nu sunt recuperabile automat. Obligația de email la checkout trebuie
   verificată la Shopify; `RECOVERY_REQUIRED=true` este folosit în staging-ul local.
10. **Operațiuni și conformitate comercială.** Merchant identity, facturare, politica
    de retragere pentru conținut digital și informarea GDPR nu sunt validate de aceste teste.

| Domeniu | Stare la finalul lucrării locale |
|---|---|
| Engine | Nemodificat; regresii existente PASS; corectitudinea procedurală rămâne la Claude. |
| Render | Flux sintetic Chromium PASS; nu reprezintă auditul ghidurilor private. |
| Legal/editorial | BLOCKED pentru vânzare; toate aprobările reale rămân NO. |
| Official documents | Nerevalidate în această lucrare; responsabilitate editorială. |
| Checkout/security | Corecții și flux local PASS; integrare externă încă nevalidată. |
| Deployment | Niciun deploy, nicio migrare remote, nicio activare Shopify, nicio tranzacție reală. |

Rezultatul este un candidat tehnic reviewabil, cu teste locale reproductibile,
nu o autorizare de lansare sau de publicare a ghidurilor premium.
