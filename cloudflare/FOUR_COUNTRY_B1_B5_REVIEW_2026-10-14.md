# ActeRO — FR / BE / NL / IE: review pentru 12 ghiduri individuale (14.10.2026)

**Stadiu: surse publice confirmate la nivel de principiu; toate cele 12 ghiduri rămân neaprobate.** Nu am avut acces la conținutul privat din D1 și nu am efectuat testul cu plata.

## Ce acoperă acest audit

- Cele 4 țări × 3 cazuri = 12 chei reale: `B1_XX` (prima solicitare CRDS), `B5_RENEWAL_XX` (reînnoire), `B5_LOST_XX` (pașaport pierdut).
- Matricea `four-country-b1-b5-editorial-matrix.json` păstrează sursele oficiale și întrebările de verificare specifice fiecărui scenariu.
- Nu este un ghid juridic automat, o aprobare editorială ori o dovadă a acceptării consulare.

## Reguli confirmate din surse, cu limite

1. **FR:** Fișa românească de țară din **2022** diferențiază dovezile principale de dovezile subsidiare (ex. Carte Vitale/permis auto). Dovezile subsidiare sunt limitate la cine deține deja CRDS pentru Franța și nu are dovezi principale. Fișa este veche; nu poate fi declarată automat practica consulară actuală. [DGP Franța, PDF](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Franta.pdf)
2. **BE:** Documentele pentru înregistrarea în Belgia se depun la solicitare din 1 septembrie 2025; **Annex 19** este cererea de înregistrare, iar cardul/dreptul de ședere poate fi acordat ulterior, după verificări. Nu afirma că simpla anexă este CRDS-eligibilă. [IBZ Belgia](https://dofi.ibz.be/en/news/changes-residence-applications-eu-citizens)
3. **NL:** BRP cuprinde rezidenți și nerezidenți (RNI), iar BSN se acordă și nerezidenților. Nu echivala BSN/RNI cu domiciliu olandez. [Government.nl](https://www.government.nl/documents/question-and-answer/when-should-i-register-with-the-personal-records-database-as-a-resident)
4. **IE:** PPS poate fi solicitat și de cineva care locuiește în afara Irlandei. Documentul IRP privește în mod obișnuit imigrația persoanelor din afara UE/Elveției, nu documentul pe care îl deține obligatoriu un cetățean român. [Gov.ie PPS](https://www.gov.ie/en/department-of-social-protection/services/get-a-personal-public-service-pps-number/) / [Irish Immigration IRP](https://www.irishimmigration.ie/registering-your-immigration-permission/information-on-registering/irish-residence-permit/)
5. **Toate:** DGP cere dovezi potrivite situației de domiciliu, acte de stare civilă corespunzătoare și traduceri **după caz**. Sursa românească generală nu certifică automat un anumit document BE/NL/IE/FR ca acceptat la fiecare oficiu. [DGP CRDS](https://pasapoarte.mai.gov.ro/documente-necesare-pentru-pasaport-simplu-electronic-simplu-temporar-cu-mentionarea-statului-de-domiciliu-c-r-d-s/)

## Verificarea necesară pentru fiecare cheie în privat

1. Rulează chestionarul real până la rezultat pentru scenariul corespunzător (nu doar injectarea unei chei de ghid în router).
2. Din mediul privat, verifică pașii și toate documentele efectiv afișate pentru *țara + scopul + statusul actului*, comparând cu sursele; marchează separat orice nevoie de confirmare consulară actuală.
3. Controlează original/copie, traducere, actualitatea datelor, comision/taxă, valabilitate, loc de depunere și ridicare. Nu promite un termen ori o acceptare fără sursă.
4. Verifică manual linkurile: pagina informativă nu este „PDF de completat”; formularul PDF trebuie să deschidă fișierul oficial corect.
5. Controlează Safari real, apoi Shopify Test Mode + webhook + ghidul pentru `guide_key` exact + recuperare/revocare.
6. Păstrează dovada editorială în mediu privat și marchează fiecare `sale_approved` numai după toate verificările; **aceste 12 intrări sunt NO**.

## Limite / controlul lansării

Matricea și testul automat verifică **inventarul și sursele declarate**, nu adevărul procedurii din `script_js`. Nu copia exporturi sau ghiduri premium în GitHub. Niciuna dintre cele 12 chei nu primește aprobare prin acest audit. Nu executa migrarea D1, nu modifica Shopify și nu activa checkout.

În plus, cele 4 variante B5 partajate au **40 de obligații separate** (4 incidente × 10 țări), urmărite în PR #6. Întregul produs rămâne în stare Draft până la review editorial, QA Safari real și plăți în staging.