# ActeRO Shopify 0.5 — staging (nu publica încă)

## Confirmat pe 9 octombrie 2026
- Produsul „ActeRO — Ghid personalizat pentru situația ta” este Active, listat pe Online Store la **49 RON**, cu **Variant ID `67640764400007`**.
- Magazinul `gyfu4v-5q.myshopify.com` este protejat cu parolă; proprietarul a deschis checkout-ul direct `/cart/67640764400007:1` și a verificat suma de 49 RON.
- Shopify Payments **Test Mode = ON**, confirmat de proprietar. Nu folosi carduri reale în test.
- Worker 0.5.0 este deja deployat separat în Cloudflare, cu `SHOPIFY_CHECKOUT_ENABLED=false`, `SHOPIFY_WEBHOOK_SECRET` criptat și D1 `DB` conectat.
- Testul semnăturii webhook a returnat 401 pentru cerere nesemnată și 200 pentru testul semnat. Aceasta **nu** demonstrează că plata unei comenzi a acordat acces.
- Codul Worker 0.5.0 a fost sincronizat în `cloudflare/worker.js` pe această ramură. Nicio valoare secretă nu se află în repository.
- Testele locale pentru Worker 0.5.0: **23 verificări PASS** (checkout, HMAC, drepturi de acces, retry/duplicate și checkout disabled).

## Ce rămâne înainte de publicarea PR-ului
1. Verifică că versiunea Cloudflare deployată și Worker-ul din această ramură sunt identice; nu deploya fișierul fără revizuire.
2. Testează **din frontend-ul ActeRO**, nu dintr-un permalink manual fără `_actero_checkout_id`. Numai `POST /checkout` generează sesiunea de plată legată de cazul utilizatorului.
3. Publică/configurează legătura din Shopify Thank-you/Order-status către `confirmare.html`, după ce verifici integrarea Shopify Checkout Blocks.
4. Activează temporar `SHOPIFY_CHECKOUT_ENABLED=true` numai pentru testul controlat, cu parola magazinului păstrată și Test Mode ON.
5. Parcurge: chestionar → buton 49 lei → checkout Shopify test → webhook signed → /access paid → ghid corect. Verifică și acces neplătit, caz greșit, refresh și reîncercare fără dublă plată. Dezactivează checkout-ul după test dacă nu e lansarea oficială.
6. Rezolvă recuperarea accesului între dispozitive, politicile comerciale și de rambursare, conformitatea comerciantului și expunerea istorică a ghidurilor în GitHub.

**Nu face merge / deploy pe site-ul public înainte de testul end-to-end.** Butonul din frontend-ul actual (`main`) nu este încă integrat cu Worker-ul. `main` nu a fost modificat prin această pregătire.
