# ActeRO — matrice de verificare oficială pentru ghidurile B5 (14.10.2026)

**STADIU: surse generale consultate; scripturile comerciale efective din D1 NU au fost comparate element cu element. Nu este aprobare pentru vânzare.**

## Bază comună (CRDS pașaport simplu electronic pentru majori)

Din pagina de **acte necesare eConsulat** rezultă, pentru procedura consulată, următoarele categorii de verificat, în funcție de caz:
- Pașaportul anterior, dacă există; documentele de stare civilă românești aplicabile; cartea de identitate sau buletinul dacă există.
- Dovada dreptului de ședere/domiciliului în statul declarat; tipul documentului și eventuala traducere autorizată diferă după situație.
- Documentele sunt prezentate în original, conform paginii eConsulat; certificatul de stare civilă plastifiat sau modificat fără drept poate fi nul.
- Taxa menționată pentru cererea consulară este **53 EUR sau echivalentul în moneda locală** pe pagina eConsulat; plata concretă și eventuale cerințe locale se verifică la consulat.
- Nu presupune că un document de rezidență este acceptat doar pentru că utilizatorul a răspuns «Da, îl am».

Surse: [eConsulat — acte necesare](https://www.econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/ActeNecesare/203000002), [eConsulat — taxe](https://econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/TaxeConsulareDescriere/203000002), [DGP — CRDS](https://pasapoarte.mai.gov.ro/cetateni-romani-cu-domiciliul-in-strainatate/).

## Diferențe obligatoriu de verificat în ghid

| Cheie | Caz | Regulă de bază din sursa oficială | Verificare în script și UI |
|---|---|---|---|
| `B5_LOST_<COUNTRY>` | Pașaport pierdut | eConsulat: pierderea pașaportului se declară la depunerea cererii pentru un nou document. | Nu prezenta automat declarația la poliție ca obligație universală pentru pierdere; verifică cerințele postului consular. |
| `B5_STOLEN` | Pașaport furat | eConsulat: dovadă eliberată de poliție, însoțită de traducere autorizată în română. | Rând propriu pentru dovada furtului și traducere; nu confunda cu procedura de pierdere. |
| `B5_DAMAGED` | Pașaport deteriorat/distrus | eConsulat: se prezintă pașaportul deteriorat/distrus, dacă mai are elemente care permit identificarea. | Afișează starea ca problemă, nu «valabil/OK»; explicația să fie condițională și să nu garanteze utilizabilitatea pentru călătorie. |
| `B5_DATA_CHANGE` | Nume/date schimbate | eConsulat: în caz de modificări de nume sau prenume în străinătate, trebuie înscrisă mențiunea corespunzătoare în actele românești înainte ca cererea să fie acceptată. DGP avertizează să nu fie folosit pașaportul CRDS după schimbarea datelor de identificare. | Cerințe românești de stare civilă separate, avertisment înainte de depunere, fără promisiunea că pașaportul vechi rămâne valid. |
| `B5_MOVED` | Domiciliu mutat în alt stat | DGP/eConsulat cer dovada actuală din statul de domiciliu, după condițiile aplicabile. | Verifică expres statul nou, documentul nou și regula de traducere. Nu reutiliza automat dovada din țara veche. |

**Important:** pentru cele patru chei B5 comune (`STOLEN`, `DAMAGED`, `DATA_CHANGE`, `MOVED`) există un singur identificator de ghid per scenariu, dar textul și sursele trebuie să se adapteze țării selectate. Refolosirea aceluiași script pentru două chei este acceptabilă tehnic numai dacă ambele incidente sunt diferențiate corect în interiorul lui.

## Rolul documentelor și al linkurilor

- Pagina eConsulat **Acte necesare** este o pagină oficială de informare, nu un PDF/formular descărcabil. Nu o eticheta ca «PDF oficial» sau «formular de completat».
- PDF-ul DGP pentru Marea Britanie este o **listă de condiții și dovezi**, nu un formular standard. Documentul este datat 2022; pentru eVisa și cerințe actuale trebuie reconfirmate condițiile consulare.
- Fiecare card de document din ghid trebuie să separe: **ce pregătesc**, **de unde obțin**, **pentru ce se folosește**, **linkul exact** și **ce nu poate confirma ActeRO automat**.

Surse suplimentare: [DGP — Marea Britanie, PDF 2022](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Marea-Britanie.pdf), [GOV.UK — eVisa](https://www.gov.uk/evisa).

## Statut pentru lansare

Fiecare afirmație de mai sus este un **criteriu de comparație**, nu o confirmare că textul din D1 îl respectă. Până la inspecția privată a scripturilor, testarea deschiderii linkurilor/PDF-urilor pe dispozitiv și verificarea fiecărei țări, `official_sources_checked`, `documents_checked`, `sale_approved` rămân `NO` în registru.

Nu s-a efectuat niciun `UPDATE` D1, schimbare în Shopify, publicare, aprobare editorială sau modificare a ghidurilor private.