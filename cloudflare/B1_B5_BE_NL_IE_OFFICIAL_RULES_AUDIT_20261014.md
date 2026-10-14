# ActeRO — reguli de revizuire B1/B5 pentru Belgia, Țările de Jos și Irlanda

**Data auditului:** 14 octombrie 2026  
**Stare:** analiză a surselor oficiale; *nu* este o aprobare editorială sau comercială.  
**Acoperire:** B1 (primul CRDS), B5_RENEWAL (reînnoire), B5_LOST (pașaport pierdut) × BE/NL/IE = 9 ghiduri private.

## Distincția obligatorie

Dovada unui statut în țara străină **nu** este automat dovada acceptării documentului pentru emiterea pașaportului CRDS românesc. Un act poate fi autentic, în termen și totuși insuficient pentru situația particulară a solicitantului. Pentru CRDS, [DGP (actualizare iulie 2025)](https://pasapoarte.mai.gov.ro/documente-necesare-pentru-pasaport-simplu-electronic-simplu-temporar-cu-mentionarea-statului-de-domiciliu-c-r-d-s/) solicită documente oficiale de ședere/domiciliu în original, împreună cu traducere autorizată după caz, și alte acte conform situației. Pentru depuneri în străinătate, taxele și procedurile se confirmă la oficiul consular/eConsulat; nu se copiază automat suma aplicabilă depunerilor în România.

## Belgia — B1_BE / B5_RENEWAL_BE / B5_LOST_BE

**Surse oficiale:**
1. [Oficiul Belgian pentru Străini (IBZ), schimbări înregistrare UE](https://dofi.ibz.be/en/news/changes-residence-applications-eu-citizens), 30.07.2025: începând din 01.09.2025, solicitantul UE prezintă de la prima vizită la municipalitate toate documentele pentru categoria de ședere invocată; dosarul incomplet nu este luat în considerare.
2. [Primăria Bruxelles, înregistrare cetățean UE](https://www.brussels.be/eu-citizen-registration-sufficient-means-existence-holder): Anexa 19 este asociată depunerii cererii; ulterior se verifică adresa, se decide asupra dreptului de ședere și se solicită cardul UE. Pagina este specifică unei categorii de solicitant; nu se generalizează documentele sau taxele locale.

**Nu promite:** „Anexa 19 este echivalentă cu dreptul de rezidență final aprobat” sau „Anexa 19 este acceptată automat pentru CRDS”. Verifică actul exact, stadiul cererii, dovada de domiciliu și cerințele DGP/eConsulat.

## Țările de Jos — B1_NL / B5_RENEWAL_NL / B5_LOST_NL

**Surse oficiale:**
1. [Government.nl, înregistrare BRP](https://www.government.nl/documents/question-and-answer/when-should-i-register-with-the-personal-records-database-as-a-resident): pentru ședere de peste 4 luni, înregistrare ca rezident BRP la municipalitate; pentru nerezidenți/șederi scurte există RNI. Ambele situații pot genera număr BSN.
2. [IND, formular 8004](https://ind.nl/en/forms/8004.pdf): cerere pentru document de rezidență permanentă pentru persoanele eligibile, de regulă după cinci ani de ședere legală; **nu este formular CRDS universal**.

**Nu promite:** „BSN singur dovedește domiciliul”, „RNI = înregistrare ca rezident” sau „IND 8004 se completează pentru primul CRDS”. Cere dovezi actuale de rezidență/adresă și confirmă separat acceptarea românească.

## Irlanda — B1_IE / B5_RENEWAL_IE / B5_LOST_IE

**Surse oficiale:**
1. [Gov.ie, număr PPS](https://www.gov.ie/en/department-of-social-protection/services/get-a-personal-public-service-pps-number/): PPS este număr pentru accesul la servicii și poate fi solicitat inclusiv de rezidenți în afara Irlandei.
2. [Irish Immigration, înregistrarea permisiunii](https://www.irishimmigration.ie/registering-your-immigration-permission/): înregistrarea IRP vizează în principal persoane din afara UE/UK/Elveției, nu este o cerință universală pentru cetățeni români UE.
3. [Irish Immigration, explicații EUTR2](https://www.irishimmigration.ie/wp-content/uploads/2026/05/Explanatory-leaflet-for-Form-EUTR2.pdf): solicitare separată de certificat de rezidență permanentă pentru cetățenii eligibili SEE/UK, în general după cinci ani calificați sau în situații de excepție.

**Nu promite:** „PPS = domiciliu”, „românul trebuie obligatoriu să dețină IRP”, „EUTR2 este formularul cerut pentru CRDS”. Confirmă dovada rezidenței și acceptarea acesteia pentru solicitarea românească.

## Reguli comune B1 / B5

- **B1 (primul CRDS):** niciun pașaport CRDS anterior nu este presupus; tipul documentului străin trebuie verificat înainte de a afirma că solicitantul este eligibil.
- **B5 reînnoire:** confirmă țara de domiciliu înscrisă în pașaportul anterior și dovada actuală; documentul anterior nu garantează singur acceptarea unui nou act de domiciliu.
- **B5 pierdere:** distinge declarația **pierderii** (titularul declară la autoritatea de pașapoarte/misiunea română) de **furt** (se sesizează poliția), potrivit [DGP CRDS](https://pasapoarte.mai.gov.ro/cetateni-romani-cu-domiciliul-in-strainatate/). Nu trata raportarea incidentului ca dovadă a domiciliului.

## Controlul tehnic deja introdus

`BE_NL_IE_EVIDENCE_GATES_20261014.json` conține cele nouă cazuri negative și criteriile de verificare, iar `cloudflare/tests/be-nl-ie-evidence-gates.test.mjs` controlează catalogul de ghiduri, traseele, sursele de referință și interdicția aprobării automate.

**Atenție:** testele validează consistența matricei publice de control, nu conținutul premium real din D1. Nu am inspectat textul efectiv al celor nouă ghiduri în această etapă. Toate rămân `editorial_clearance=NO`, `consular_acceptance_confirmed=false` și `sale_approved=NO`. Pentru aprobare sunt necesare comparația ghidului exact cu sursele oficiale valabile și teste Safari/Shopify de la cap la coadă.

**Niciun UPDATE D1, Shopify, deploy, merge sau aprobare pentru vânzare.**
