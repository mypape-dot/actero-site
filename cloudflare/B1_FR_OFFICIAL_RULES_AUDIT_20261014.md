# ActeRO — audit oficial B1_FR, prima solicitare CRDS (14 octombrie 2026)

**Stare: criterii de revizuire, nu verdict PASS. Nu sunt incluse scripturi premium din D1.** Rezultatele vizuale și corecțiile etichetelor sunt PASS numai în simularea offline; instrucțiunile juridice efective din ghid nu au fost comparate integral cu sursele de mai jos.

## Surse oficiale verificabile
- Direcția Generală de Pașapoarte (DGP), [Cetățeni români cu domiciliul în străinătate](https://pasapoarte.mai.gov.ro/cetateni-romani-cu-domiciliul-in-strainatate/).
- DGP, [Condiții Franța — PDF oficial](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Franta.pdf) (document publicat în 2022; trebuie verificată aplicabilitatea la data cererii).
- DGP, [Comunicat din 16.07.2025](https://pasapoarte.mai.gov.ro/comunicat-de-presa-nr-18-din-16-07-2025/).

## Condiții pentru prima solicitare — acceptare individuală PENDING

| Regulă testabilă | Criteriu / dovadă necesară | Stare |
|---|---|---|
| Dovada domiciliului | Unul dintre actele din lista **principală** a fișei Franța: acte franceze de identitate pentru cetățeni cu dublă cetățenie; titre de séjour ori recipisa solicitării; certificat de școlarizare; atestat de la primărie conform condițiilor; adeverința alegerii domiciliului etc. | REVIEW_PRIVATE_B1_FR |
| Acte subsidiare | **Carte Vitale, permisul de conducere, ultimul aviz de impunere, numărul de asigurare medicală** etc. sunt prevăzute în fișa DGP numai pentru titularul care **deține deja un pașaport CRDS pentru Franța** și **nu poate prezenta documente din lista principală**. Nu se recomandă automat clientului care solicită primul CRDS. | REVIEW_PRIVATE_B1_FR |
| Documente originale | DGP precizează prezentarea în original a documentelor de ședere/domiciliu străine. | REVIEW_PRIVATE_B1_FR |
| Identitatea titularului | Numele și datele din documentele românești și străine trebuie să corespundă; incompatibilitatea poate duce la respingerea cererii. | REVIEW_PRIVATE_B1_FR |
| Stare civilă | Acte de stare civilă în original; actele străine necesită transcriere/înregistrare în registrele românești, după caz, cu CNP. | REVIEW_PRIVATE_B1_FR |
| Pașaport anterior | Se solicită pașaportul anterior dacă acesta există. | REVIEW_PRIVATE_B1_FR |
| Prima trecere la CRDS | La prima obținere CRDS se predă cartea de identitate care atestă domiciliul în România; verifică posibilitatea documentului FDR în condițiile actuale. | REVIEW_PRIVATE_B1_FR |
| Cost și loc de depunere | Taxele/achitarea se stabilesc de misiunea consulară pentru cererile depuse în străinătate; suma din România nu trebuie prezentată drept preț unic pentru un consulat francez. Cererea se depune personal; serviciile consulare se verifică prin eConsulat. | REVIEW_PRIVATE_B1_FR |
| Traducere | Fișa franceză DGP 2022 afirmă că nu este necesară traducerea autorizată pentru documentele de dovadă menționate în fișă. Verifică dacă această excepție continuă să se aplice și nu o generaliza la orice act străin de stare civilă. | REVIEW_CURRENT_CONSULAR_ACCEPTANCE |
| Linkuri PDF | Actul/fișa PDF și domeniul oficial să corespundă exact titlului și scopului afișat; test Safari iPhone pentru deschidere/descărcare. | REVIEW_SAFARI |

## Teste negative obligatorii în logica ActeRO
1. Prima solicitare CRDS în Franța, fără dovadă principală, dar cu Carte Vitale: sistemul **nu** trebuie să promită că aceasta este suficientă pentru primul CRDS.
2. Titular cu CRDS deja emis pentru Franța, dar fără dovadă principală: poate afișa documentele subsidiare numai cu condițiile explicite.
3. Nume diferit între documentul românesc și dovada franceză: se semnalează necesitatea regularizării înainte de depunere.
4. Acte românești expirate: nu se exclude automat CRDS; DGP menționează posibilitatea pe baza actelor de stare civilă și a dreptului de ședere, cu verificările legale.
5. Taxa: pentru depunerea la consulat nu se afișează automat cuantumul aplicabil cererilor depuse în România.

**Aprobare B1_FR: NO.** Revizuirea se încheie doar după verificarea conținutului privat efectiv al ghidului pe fiecare regulă și confirmarea actualității informațiilor de la DGP/consulat. Nu modifica D1 sau Shopify automat.
