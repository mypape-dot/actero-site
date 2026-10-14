# ActeRO — audit local privat al celor 43 de ghiduri (14.10.2026)

**DRAFT, STAGING ONLY. Acest audit NU reprezintă aprobarea conținutului și nu schimbă D1/Shopify.**

## Motiv

Testele de rutare au atins cele 43 de identificatoare. Conform metadatelor D1 verificate anterior de operator, toate cele 43 de chei au rute corecte și scripturi nenule. **Nu știm încă dacă fiecare ghid privat conține toți pașii, taxele, actele și PDF-urile oficiale corecte.**

Instrumentul de lucru este **cloudflare/audit-private-guides.mjs**. Este strict offline, numai citire, nu execută JavaScript-ul privat și nu publică niciun fragment comercial.

## Pregătire și intrare

Doar operatorul autorizat, într-un mediu de test D1 controlat, poate face o interogare read-only de conținut:

~~~sql
SELECT guide_key, route, script_js
FROM guide_scripts
ORDER BY guide_key;
~~~

**Această interogare returnează întreg codul privat comercial.** Nu copia rezultatul în GitHub, chat, issue-uri, PR-uri, capturi distribuite, ori în directorul actero-site. Păstrează JSON-ul doar pe dispozitivul controlat de operator, într-un director privat. Nu include date despre clienți, checkout, tokenuri, webhook-uri sau acces.

Sunt acceptate obiecte JSON cu câmpurile guide_key, route și script_js, sub forma listă directă, {"results":[...]} ori [{"results":[...]}].

Din rădăcina repository-ului, presupunând că exportul privat există deja la calea dată:

~~~bash
node cloudflare/audit-private-guides.mjs "$HOME/actero-private/d1-guides-staging.json"
~~~

Instrumentul **refuză** fișierele de intrare din interiorul repository-ului. Nu conectează automat Cloudflare și nu modifică D1.

## Raportul

- **structurally_valid:** cele 43 de chei distincte, rutele corecte, scripturi nenule și sintaxă JavaScript validă; se compilează fără execuție.
- **errors:** codul erorii și cheia publică sau poziția rândului; nu sunt afișate mesaje de eroare care pot conține fragmente comerciale.
- **warnings:** doar coduri de examinare manuală: afirmații „procedură verificată”, TODO/FIXME, taxe, BRP, permise elvețiene, lipsa de linkuri statice, scripturi identice pentru mai multe chei.
- **legal_review_completed:false și sale_approved:0:** rămân negative chiar când structurally_valid=true.

Scriptul nu afișează textul, titlul, linkurile, hashurile sau conținutul privat și nu scrie un raport pe disc. Lipsa linkurilor statice poate fi o alarmă falsă dacă generatorul construiește dinamic URL-urile.

Pentru CI și testare locală fără ghiduri reale:

~~~bash
node --test cloudflare/tests/private-guide-audit.test.mjs
~~~

Acest test folosește exclusiv scripturi sintetice. CI nu accesează D1 real.

## Verificare manuală per ghid, înainte de vânzare

1. Identitate: guide_key, route, țară, variantă și hashul exact al scriptului verificat calculat în spațiul privat.
2. Eligibilitate, domiciliu oficial, instituția competentă și sursa oficială precisă cu data consultării.
3. Acte originale, dovadă de ședere, certificate românești și condițiile pentru traduceri, legalizări sau schimbarea stării civile.
4. Taxe și termene specifice serviciului, consulatului și modului de depunere/ridicare, cu linkuri oficiale.
5. Verificarea tuturor PDF-urilor și butoanelor reale pe telefon Safari; informație oficială ≠ formular de depus.
6. Corelarea întrebărilor motorului cu condițiile din ghid, inclusiv cazurile STOP/UNRESOLVED.
7. Staging Shopify + Worker + D1: plata de test, webhook semnat, cheia corectă, recuperare și revocare.
8. Abia după control editorial independent se poate solicita aprobarea exactei versiuni de script; scannerul nu o acordă.

## Status

La data raportului, registrul conține **43/43 sale_approved=NO**. Existența scripturilor a fost verificată prin metadatele furnizate de operator, dar conținutul real al tuturor celor 43 de scripturi nu a fost inspectat. Auditul surselor oficiale rămâne parțial; pentru UK și Elveția există condiții ce necesită atenție specială.

**Fără merge în main, publicare, aprobări în D1 sau activare checkout pe baza scannerului.**
