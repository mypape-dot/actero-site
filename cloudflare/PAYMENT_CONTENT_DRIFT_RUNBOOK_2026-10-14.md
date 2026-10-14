# ActeRO — ghid retras / conținut modificat între checkout și plată

**Draft / staging only — 14 octombrie 2026. Nu activează plăți și nu modifică Cloudflare D1.**

## Incidentul prevenit

Un client poate deschide checkout-ul Shopify când ghidul său are aprobarea editorială `approved`, iar apoi, înainte ca `orders/paid` să ajungă în Worker, cineva poate revoca aprobarea sau modifica scriptul din D1. Fără reverificare, se poate marca o comandă drept plătită și se poate încerca livrarea unui ghid neaprobat.

Worker-ul din ramura de audit verifică acum cheia, ruta, aprobarea și SHA-256 al scriptului *și la confirmarea unei comenzi achitate*. Dacă varianta exactă nu mai este eligibilă:

1. **Nu** transformă `access_grants.status` în `paid`.
2. Înregistrează evenimentul `payment_events.result='needs_review'`, `reason='guide_unavailable_after_checkout'`, incluzând Shopify order ID și checkout ID.
3. Solicită expedierea unei alerte către operator prin webhook-ul privat configurat. Dacă alerta nu poate fi trimisă, răspunde 503, permițând reîncercarea Shopify. Dacă alerta reușește, confirmă evenimentul ca primit și urmărit pentru intervenție.
4. **Nu** rambursează, nu aprobă ghidul și nu livrează automat conținutul. Comanda Shopify poate fi deja efectiv achitată.

## Investigație în STAGING — citire, fără copierea codului privat

```sql
SELECT event_id,shopify_order_id,checkout_id,case_id,result,reason,updated_at
FROM payment_events
WHERE reason='guide_unavailable_after_checkout'
ORDER BY updated_at DESC
LIMIT 25;
```

Operatorul verifică separat în Shopify (numai din contul autorizat) suma și starea efectivă a comenzii, apoi confirmă corespondența cu evenimentul și cu un singur `checkout_intents.checkout_id`. Nu considera o plată „neefectuată” doar fiindcă accesul nu s-a acordat.

## Rezolvare manuală necesară

- **Prioritatea 1:** dacă plata este confirmată, gestionează prompt cazul cu comerciantul / titularul contului: verificare, comunicare cu cumpărătorul și rambursare dacă ghidul nu poate fi livrat.
- **Prioritatea 2:** investighează motivul retragerii aprobării sau al modificării conținutului. Nu modifica `guide_approvals` în `approved` doar ca să închizi incidentul.
- **Prioritatea 3:** dacă livrarea după remediere este legal posibilă și convenită, este nevoie de un **mecanism auditat de reconciliere** a plății și a grantului, cu verificări noi. Un asemenea flux manual securizat **nu este implementat**. Nu injecta manual `paid` printr-un `UPDATE` ad-hoc.

## Teste realizate

În `cloudflare/tests/audit-payment.test.mjs`, se simulează:

- Ghida aprobat inițial, apoi `guide_approvals.status='revoked'` înainte de `orders/paid`: rezultatul este `needs_review` și grantul rămâne `pending`.
- Scriptul D1 modificat după checkout, fără un SHA nou aprobat: aceeași respingere.
- Plata obișnuită cu un ghid stabil aprobat: grantul continuă să fie acordat.
- Evenimentul de revizuire este păstrat și operatorul este alertat.

Testele rulează pe o bază **SQLite simulând D1**, cu plăți și webhook-uri simulate, nu sunt o tranzacție Shopify reală.

## Limitări și blocaje pentru lansare

- Un cumpărător **deja** plătit poate pierde accesul dacă ulterior aprobarea ghidului este retrasă sau scriptul se modifică. Endpoint-ul `/guide-script` refuză intenționat livrarea conținutului neaprobat. Sistemul nu păstrează încă versiunile achiziționate și nu automatizează notificarea sau rambursarea acestor cazuri.
- `/access` raportează statusul grantului, nu garantează că scriptul este încă livrabil. Acest decalaj necesită rezolvare UX și operațională înainte de lansare.
- Verificarea în webhook reduce intervalul de risc, dar nu înlocuiește o strategie de **versionare imutabilă**, audit editorial pe hash și reconciliere de plată.
- `sale_approved=NO` pentru toate cele 43 de variante; migrarea 008 și plățile în producție nu trebuie activate pe baza acestor teste.

**Fără modificare pe site-ul public, în Cloudflare D1 sau în Shopify.**
