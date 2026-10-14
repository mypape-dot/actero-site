# ActeRO — auditul aplicabilității documentelor, 14 octombrie 2026

**Draft, NU publicat.** 24/24 randări izolate pentru 12 ghiduri FR/BE/NL/IE pe Chromium și WebKit mobil simulat au afișat conținut, dar toate au eticheta vizibilă „Procedură verificată”, în timp ce verificarea editorială individuală nu este finalizată. Randarea nu demonstrează nici corectitudinea procedurii, nici funcționalitatea PDF-urilor.

## Probleme identificate și verificate din sursele proprii ale instituțiilor

- **Franța:** fișa [DGP Franța 2022](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Franta.pdf) este despre dovada domiciliului pentru CRDS, dar nu poate fi tratată ca dovadă suficientă a condițiilor de astăzi. Anumite dovezi subsidiare se aplică doar persoanelor care au deja CRDS pentru Franța, în condiții speciale.
- **Belgia:** [catalogul Comisiei Europene de documente de ședere (2021)](https://home-affairs.ec.europa.eu/system/files/2021-09/list-of-residence-permits-issued-by-member-states.pdf) este material de referință, **nu** o dovadă personală a domiciliului și **nu** o listă de documente CRDS acceptate de autoritățile române.
- **Țările de Jos:** [IND 8004](https://ind.nl/en/forms/8004.pdf) este cererea pentru un document de rezidență permanentă al persoanelor eligibile (în mod obișnuit cinci ani de reședință), **nu** un formular obligatoriu de CRDS și nici extrasul de rezidență BRP.
- **Irlanda:** [EUTR2](https://www.irishimmigration.ie/wp-content/uploads/2026/05/Form-EUTR2.pdf) este pentru o cerere cu condiții proprii legate de certificatul de rezidență permanentă, **nu** un act obligatoriu tuturor românilor care solicită CRDS. Numărul PPS, separat, poate fi emis și persoanelor care locuiesc în afara Irlandei: [gov.ie](https://www.gov.ie/en/department-of-social-protection/services/get-a-personal-public-service-pps-number/).
- **România:** lista generală de documente pentru CRDS se află la [Direcția Generală de Pașapoarte](https://pasapoarte.mai.gov.ro/cetateni-romani-cu-domiciliul-in-strainatate/); acceptarea unui document străin concret se confirmă la autoritatea română competentă.

## Schimbări publice propuse pe această ramură

1. Pentru BE, NL și IE cardul este marcat **„Sursă oficială conexă”** / **„Document de referință, cu aplicabilitate limitată”**, nu „dovadă necesară pentru CRDS”.
2. Descrierile din card explică expres că documentul nu este obligatoriu pentru orice solicitant.
3. Funcția `miniFormPreview`, care produce HTML ilustrativ, este etichetată **„ILUSTRAȚIE — NU DOCUMENT OFICIAL”**, iar afirmația falsă „Pagina 1 a documentului oficial se încarcă automat” este eliminată din această ilustrație.
4. Linkurile la sursele oficiale rămân prezente; documentele și scripturile comerciale din D1 nu au fost modificate.
5. Testul din `cloudflare/tests/official-doc-applicability.test.mjs` protejează URL-urile clasificate și avertismentele editoriale, dar **nu** verifică rețeaua sau consulatul.

## Ce nu este rezolvat

- Toate cele **12 ghiduri private** încă afișează o afirmație de verificare neaprobată. Aceasta se corectează separat prin modificare editorială **privată**, după examinarea exactă a codului.
- Nu s-a verificat că fiecare preview este realmente pagina corectă a PDF-ului oficial (imagini locale, `image.thum.io`, funcții de download, CORS și linkuri directe).
- Nu s-au verificat acceptarea documentelor la consulat, condițiile CRDS pentru cazuri speciale, actualitatea surselor/taxelor, Safari real sau plata și recuperarea ghidului după Shopify.
- Nu se aprobă nicio vânzare și nu se execută niciun UPDATE D1 / deploy / merge automat.

**Criteriul pentru eliminarea blocajului:** documentul este relevant situației individuale, preview-ul vine din PDF-ul oficial corect, linkul se deschide/descarcă pe mobil, iar declarațiile de verificare corespund dovezilor editoriale revizuite pentru versiunea exactă.
