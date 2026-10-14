# ActeRO — auditul traseelor complete (13 octombrie 2026)

**Status:** testele automate de rutare trec in ramura `fix/engine-logic-audit-20261013`, **Draft / NOT DEPLOYED**.

## Ce au verificat testele

Testul `cloudflare/tests/engine-full-journeys.test.mjs` executa functiile reale din `index.html` printr-un simulator de raspunsuri si interfata minimalizata. Pentru fiecare scenariu porneste de la intrebarea Q001, trece prin alegerea tarii, documente, starea documentelor, conditii de domiciliu, intrebari suplimentare si ramificarea catre rezultat.

- **43/43** identificatori `guide_key`: cate un scenariu complet, cu ruta si cheia de ghid asteptate.
- **40 scenarii aditionale:** furt, deteriorare, schimbarea datelor si schimbarea tarii pe toate cele 10 tari, pentru cheile B5 comune.
- **30 scenarii aditionale de incertitudine:** certificat de nastere necunoscut, tara CRDS neconfirmata si dovada de domiciliu necunoscuta, in toate cele 10 tari; niciunul nu trebuie sa prezinte oferta de plata.
- Alte scenarii: permis elvetian necunoscut/G, cazuri cu certificat de nastere problematic, minori, lipsa cetateniei, CEI consular indisponibil, turism neeligibil pentru urgenta si calatorie urgenta din Romania spre alta tara.
- Regresiile independente `engine-logic-regression.test.mjs` testeaza navigarea rapida, starea documentelor, clarificarile, Back si logica destinatiei.

**ATENTIE:** simulatorul apeleaza functii reale, dar **nu este un browser real** si nu testeaza clickurile, scrollul, Safari, accesibilitatea, versiunea Cloudflare publicata sau continutul privat din D1.

## Limitele ramase

1. **Acoperire combinatoriala incompleta.** Cele 43 de chei nu reprezinta toate combinatiile posibile de raspunsuri. Testele verifica scenarii reprezentative, nu o demonstratie exhaustiva.
2. **Verificare juridica si editoriala nefacuta.** Registrul `cloudflare/guide-review-tracker.csv` mentine toate cele 43 de variante cu `sale_approved=NO`. Un traseu corect tehnic poate duce la un ghid incomplet sau inexact.
3. **Continut D1 / documente oficiale necunoscute.** Nu a fost comparat continutul privat real cu cheia/ruta si nu au fost revizuite oficial toate listele de documente, taxe, termene sau PDF-uri.
4. **Plati si recuperare:** nu s-a executat un test real cap-coada Shopify Test Mode -> webhook semnat -> ghid platit -> recuperare -> revocare.
5. **Arhitectura:** `hasValidatedPaidGuide()` este un filtru de eligibilitate pentru catalog, **nu o dovada ca ghidul a fost aprobat pentru vanzare**. Activarea checkout trebuie sa depinda si de aprobarea efectiva a continutului dintr-un registru de operare/DB validat pe server.

## Urmatorii pasi si praguri de acceptare

1. Intarirea testelor de state management: schimbarea tarii, schimbarea scopului, Back, refresh si revenire prin link de recuperare.
2. Teste browser reale pe Safari mobil si desktop pentru trasee reprezentative plus toate STOP/UNRESOLVED si plata dezactivata.
3. Audit metadata D1 **read-only** pe toate cele 43 de chei (fara export public de `script_js`).
4. Validare procedurala independenta pe fiecare ghid cu surse oficiale si data verificarii; aprobare individuala `sale_approved=YES` doar dupa verificare.
5. Autorizare checkout si continut strict server-side, inclusiv interdictia vanzarii unui ghid neaprobat sau inexistent.
6. Test Shopify/Cloudflare staging pe plata si revocare, fara bani reali.
7. Publicare numai dupa verificare si aprobare umana, fara merge automat in `main`.

Nu s-au efectuat migrari Cloudflare D1, publicari GitHub Pages sau activari de plata.
