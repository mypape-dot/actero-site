# ActeRO F-03 — recuperarea ghidului prin email (STAGING / DRAFT ONLY)

**Nu publica acest PR pe main și nu activa plățile reale.** Continuă exclusiv cu Worker-ul existent din PR #2, extins de PR #3. Nu se creează o a doua bază D1.

## Cum funcționează
1. `POST /checkout` primește un `case_state` limitat (route, answers, docs, status, clarified) și îl salvează în `access_grants.evaluation_json`. Nu stochează istoricul browserului sau tokenurile. Când `RECOVERY_REQUIRED=true`, respinge checkout-urile fără snapshot și configurația incompletă (503).
2. Webhook-ul HMAC `orders/paid` salvează **HMAC(email normalizat, RECOVERY_EMAIL_PEPPER)** din emailul confirmat de Shopify. Nu se stochează emailul în clar în D1.
3. Clientul deschide `recuperare.html`, introduce emailul și numărul comenzii Shopify (de ex. `#1001`). `POST /recover/request` răspunde generic 202 indiferent dacă există comanda. Emailul ajunge numai la cumpărătorul verificat.
4. Mesajul trimis prin Resend conține un token aleator de 256 biți în fragmentul URL, expirat după 30 de minute. În D1 există numai hashul tokenului. Maxim 3 linkuri/comandă/oră (fără a dezvălui dacă o comandă există).
5. `POST /recover/consume` consumă linkul o singură dată, rotește tokenul de acces și returnează snapshotul. `recuperare.html` verifică stocarea browserului **înainte** de consum, apoi salvează cazul și tokenul și trimite clientul în aplicație. Accesul la ghid este reverificat de Worker.
6. Comenzile revocate/rambursate nu pot solicita sau consuma un link de recuperare.

## D1 și ordine de aplicare
- Verifică schema și fă backup la D1 **înaintea migrării**.
- Aplică în mediu staging migrațiile 003, 004, apoi `005-recovery.sql` (001/002 există deja). 005 adaugă `evaluation_json`, `recovery_email_hash`, `recovery_links`.
- Nu publica Worker-ul F-03 înainte de migrația 005: `/checkout` și webhook-ul ar încerca să folosească noile coloane.
- Nu aplica 005 de două ori, deoarece include `ALTER TABLE`. Nu îl lansa pe D1 de producție fără verificarea schemei reale.

## Important: Worker-ul are acum un modul separat
Fișierul `cloudflare/worker.js` importă `./recovery.js`. Pentru testarea pe Cloudflare trebuie publicate **ambele** fișiere folosind o configurare Wrangler/ES module care rezolvă importul. Nu copia doar conținutul `worker.js` în editorul single-file Cloudflare: importul ar lipsi și Worker-ul nu ar porni.

Pentru staging, folosește o configurație cu binding-ul `DB` către **baza existentă de test**, după verificarea schemei și aplicarea migrațiilor, nu spre baza live. Ține `SHOPIFY_CHECKOUT_ENABLED=false` până la testul controlat.

## Configurare Cloudflare — numai secrete și variabile de mediu
- `RECOVERY_REQUIRED=true`: **obligatoriu înainte de a permite cumpărături reale**; refuză checkout dacă lipsește starea evaluării sau configurația email.
- `RECOVERY_EMAIL_PEPPER`: secret generat aleator, cel puțin 32 caractere. Păstrează-l, pentru că schimbarea lui face inutilizabile hashurile vechi până la reimport/recuperare manuală.
- `RECOVERY_EMAIL_API_KEY`: cheie secretă Resend.
- `RECOVERY_EMAIL_FROM`: adresă simplă, de exemplu `suport@domeniul-tau.ro`, pe un domeniu verificat la furnizor.
- `RECOVERY_PAGE_URL`: adresă HTTPS, pentru versiunea actuală `https://mypape-dot.github.io/actero-site/recuperare.html`; backend-ul o acceptă doar pe originea curentă. Pentru domeniu propriu, actualizează explicit atât regulile Worker-ului, cât și pagina.
- Păstrează `SHOPIFY_WEBHOOK_SECRET`, `PAYMENT_ALERT_WEBHOOK_URL` și `SHOPIFY_CHECKOUT_ENABLED` conform configurării anterioare, cu checkout dezactivat până la QA complet.
- **Nu pune niciuna dintre chei sau variabilele secrete în GitHub ori în chat.**

## Shopify
- Verifică în Test Mode că `orders/paid` conține `email` sau `contact_email` ori `customer.email`, și `name` (numărul comenzii).
- Configurează checkout-ul să solicite **email**, nu doar număr de telefon, dacă promiți recuperare prin email.
- O comandă veche fără `evaluation_json` sau `recovery_email_hash` nu poate fi recuperată automat: e necesar suport manual documentat.

## Teste
```bash
node --no-warnings cloudflare/tests/recovery.test.mjs
node --no-warnings cloudflare/tests/audit-payment.test.mjs
node --test cloudflare/tests/checkout-frontend.test.mjs
node --test cloudflare/tests/swiss-loop.test.mjs
node --no-warnings cloudflare/tests/recovery-page.test.mjs
```
- Local: **61/61** verificări extinse (F-02/F-04/F-05/F-03), **15/15** verificări dedicate F-03 pe Worker/D1, **6/6** teste browser-simulat pentru pagina de recuperare.
- Acestea sunt simulări locale, **nu** confirmări că emailurile sau D1 și Shopify în producție funcționează. Fă un test real în staging cu un email deținut de comerciant înainte de lansare.

## Riscuri rămase
- **F-01:** ghidurile premium sunt încă publice pe `main` și în istoricul Git, inclusiv fișiere QA. Curăță înainte de a vinde.
- **F-06:** nu există protecție completă la abuz pentru cereri de checkout sau `/recover/request`. Configurează Cloudflare WAF/Rate Limiting și testează încărcarea înainte de producție.
- **F-15:** GitHub Pages folosește o origine comună cu alte proiecte ale contului. Recomandat domeniu propriu și CSP.
- **F-16:** lipsesc testul real Shopify Test Mode -> webhook semnat -> D1 -> recovery email -> ghid pe alt dispozitiv, cu erori și retry.
- **GDPR:** evaluările includ răspunsuri despre acte și domiciliu. Sunt stocate în D1 numai pentru recuperare. Stabilește temeiul, informarea, retenția, ștergerea și accesul la date înainte de lansare. Furnizorul de email prelucrează adresa la trimitere; monitorizează ratele de eșec și bounces.
- **Livrare email:** providerul poate accepta API-ul fără ca mesajul să ajungă. Monitorizare și suport manual obligatorii; erorile providerului sunt înregistrate și se încearcă trimiterea unei alerte prin canalul existent. Verifică în staging și livrarea alertelor; în cazul unui eșec al ambelor canale este necesar suport manual.
- Dacă pagina de recuperare primește răspuns pozitiv dar stocarea clientului eșuează după consum, utilizatorul trebuie să ceară un link nou; verificarea preventivă reduce, nu elimină complet, riscul.
- Linkul permite recuperarea oricărei persoane care are acces la mailbox; protecția contului de email rămâne responsabilitatea cumpărătorului.
