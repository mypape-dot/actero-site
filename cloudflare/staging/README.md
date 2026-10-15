# Propunere de staging separat — neaprobată, neexecutată

Proprietarul a confirmat existența unui Worker ActeRO și a bazei `actero-db`,
dar nu a confirmat un mediu separat de staging. **Resursele existente sunt
protejate: nu le clasificăm drept staging și nu le modificăm.** În această etapă
se rulează numai teste locale, cu date sintetice și fără acces Cloudflare remote.

## Configurația pregătită

`wrangler.json.example` este un șablon nelegat de vreun cont sau bază de date,
nu o configurație deployabilă. Nu este încărcat de testele locale și nu există
un script de deploy în `package.json` sau un job de deploy în CI.

| Element | Propunere / stare |
|---|---|
| Worker | `actero-staging-synthetic-proposed`, nume provizoriu; existență neverificată |
| D1 | `actero-staging-synthetic-proposed`, bază separată și numai sintetică |
| Account ID / database ID | Placeholder nevalid; nu se copiază ID-ul bazei `actero-db` |
| Mediu Wrangler | `staging`, binding `DB` definit numai în acest mediu |
| Checkout | `false` |
| Payment mode | `test`; nu activează Shopify Test Mode |
| Recovery | Obligatorie, dar URL-ul `.invalid` este intenționat nefuncțional |
| Publicare | `workers_dev=false`, `preview_urls=false`, fără routes |
| Secrete | Niciun secret sau credential real în fișier |

Dezactivarea routes nu este o barieră împotriva unui deploy: un operator cu
permisiuni ar putea crea un Worker fără rută. De aceea, înainte de aprobarea
proprietarului **nu se execută nici deploy, nici upload de versiune, nici creare
D1, nici `d1 execute --remote`, nici `secret put`**, chiar dacă checkout este oprit.

## Informații de confirmat de proprietar

Nu sunt necesare chei sau parole în chat. Sunt suficiente denumirile și URL-urile
nesensibile, plus confirmarea că resursele sunt separate:

- Dacă există deja un Worker de staging și care este numele lui exact.
- Dacă binding-ul său `DB` indică o bază diferită de `actero-db` și dacă acea bază
  conține numai date de test. Un nume cu „staging” nu dovedește izolarea.
- Dacă există un frontend de staging și ce origine HTTPS folosește.
- Dacă există un magazin Shopify de dezvoltare/test separat; dacă se folosește
  magazinul existent, orice modificare a acestuia necesită aprobare distinctă.
- Dacă există un sender și o căsuță de email dedicate testelor.

Nu se presupune că resursele cu numele propuse sunt libere și nu se suprascrie
nimic dacă există deja. Dacă izolarea nu este confirmată, pregătirea rămâne locală.

## Pași după o eventuală aprobare explicită

1. **Confirmarea țintei.** Consemnează numele/ID-urile exacte și ce operații sunt
   aprobate: creare de resurse noi sau utilizarea unui staging deja existent.
   Compară binding-ul D1 cu baza protejată; oprire la orice ambiguitate. Aprobarea
   acestui plan nu este presupusă din existența unui Worker sau a `actero-db`.
2. **Origine separată.** Alege frontend-ul HTTPS dedicat. Înainte de deploy,
   pregătește și testează o schimbare coerentă în `worker.js`, `recovery.js` și
   `evaluation-session.js`: toate trei fixează în prezent originea GitHub Pages.
   Simpla adăugare a unei variabile `APP_ORIGIN` în șablon nu ar schimba codul.
   Aliniază și URL-ul de recuperare, configurația publică a copiei frontend și
   linkul de revenire Shopify. Nu modifica frontend-ul public existent.
3. **Worker și D1 izolate.** Numai pentru resursele aprobate, completează o copie
   locală a șablonului cu identificatorii reali. Numele Worker-ului și binding-ul
   trebuie reverificate înaintea oricărei operații; folosește explicit mediul
   `staging`. Păstrează checkout oprit și nu prelua routes de producție.
4. **Schema.** Dacă D1 este demonstrat nouă și goală, schema pentru acest staging
   sintetic poate porni de la `tests/fixtures/local-baseline.sql`, urmată în ordine
   de migrațiile 001–010. Acestea au fost aplicate numai local până acum. Dacă baza
   nu este goală, se oprește bootstrap-ul: inventar de schemă, backup și plan de
   diferențe separat, fără aplicare oarbă a `ALTER TABLE`. Migrarea 010 se oprește
   la duplicate de order ID; nu se șterg granturi pentru a o forța să treacă.
5. **Date.** Numai renderer-ul sintetic din testele existente și o aprobare exclusiv
   pentru acel fixture. Nicio clonare/exportare a `actero-db`, nicio copiere a
   ghidurilor premium și nicio aprobare editorială reală.
6. **Secrete separate.** Pregătește în mediul aprobat valori noi pentru
   `SHOPIFY_WEBHOOK_SECRET`, `ABUSE_HASH_PEPPER`, `PAYMENT_ALERT_WEBHOOK_URL`,
   `RECOVERY_EMAIL_PEPPER`, `RECOVERY_EMAIL_API_KEY`, `RECOVERY_EMAIL_FROM`.
   Nu reutiliza secretele de producție. Stabilirea lor în Cloudflare este o mutație
   și intră în aprobarea de staging, nu în etapa curentă.
7. **Expunere controlată.** Stabilește endpoint-ul API și accesul testerilor;
   configurează numai adresa staging aprobată. Verifică politica CORS, TLS,
   endpoint-urile protejate și accesul webhook-urilor. O pagină de autentificare
   Cloudflare Access pe webhook fără o integrare corespunzătoare ar bloca Shopify;
   nu presupune că o protecție generică rezolvă această configurație.
8. **Shopify și email.** Verifică explicit Test Mode actual, varianta de 49 RON,
   valuta, proprietatea `_actero_checkout_id`, cele patru subscriptions și linkul
   Thank-you/Order-status. Codul are încă shop și variantă fixe: un magazin de test
   diferit necesită o schimbare de configurație în cod și regresii înainte de
   utilizare. Activarea checkout-ului sau schimbarea Shopify necesită aprobarea
   proprietarului. `SHOPIFY_PAYMENT_MODE=test` filtrează webhook-uri, dar nu poate
   împiedica debitarea unui card dacă magazinul nu este în Test Mode.
9. **Acceptanță.** Rulează cu tester/adresă deținute: plată de test → acces → ghid
   sintetic → recuperare → refund/anulare/dispută → acces revocat, plus retry la
   email/alerte indisponibile. Înregistrează numai rezultate și identificatori de
   test, fără tokenuri, secrete sau exporturi de date.
10. **Închidere.** După test, oprește checkout-ul în staging conform planului
    aprobat. Nu modifica producția și nu șterge automat resurse. Planifică separat
    retenția datelor sintetice și orice eliminare a infrastructurii.

## Ce se poate executa acum

Din rădăcina repository-ului, fără Cloudflare CLI sau credențiale:

```bash
npm test
npm run test:staging:failures
ACTERO_TEST_BROWSERS=chromium ACTERO_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:staging
npm run check:public
```

`test:staging:failures` verifică indisponibilitatea emailului și alertelor,
reîncercarea fără pierderea incidentului, consumul/expirarea linkurilor, concurența
și revocarea înaintea plății, în workerd/D1 locale. Emailurile și alertele sunt
colectate în memorie; niciun webhook nu este trimis unui serviciu extern.

Planul nu este o aprobare de creare, deploy, migrare, activare Shopify sau vânzare.
