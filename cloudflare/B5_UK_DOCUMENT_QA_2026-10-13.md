# ActeRO — auditul documentelor UK pentru pașaport CRDS (13 octombrie 2026)

**Rute analizate:** `B5_DAMAGED` și `B5_DATA_CHANGE`, condițional când `residence_country=GB`.

**Verdict:** documente și reguli oficiale identificate; **conținutul NU este aprobat pentru vânzare**. Cele 43 de `sale_approved` rămân `NO`.

Această verificare citește doar surse **publice**, generatorul istoric `main` și evidența operatorului. Scripturile private actuale nu au fost exportate aici și nu s-a efectuat niciun `UPDATE` în Cloudflare.

## 1. Documentele de bază la cererea CRDS pentru un adult

Sursa primară, [eConsulat — acte necesare pentru pașaport electronic adult CRDS](https://econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/ActeNecesare/203000002), precizează că **toate documentele se prezintă în original**, apoi se restituie, și enumeră:

| Componenta dosarului | Condiția oficială | Recomandare de UX în ActeRO |
| --- | --- | --- |
| Pașaportul anterior | Dacă există. La deteriorare, eConsulat cere prezentarea pașaportului deteriorat/distrus dacă încă poate fi identificat. | Checklist separat cu stare „deteriorat”, fără etichetă verde de „document valabil”. |
| Certificatul românesc de naștere | Act românesc de stare civilă relevant, în original; verificarea datelor rămâne obligatorie. | Rând propriu în checklist, nu doar „starea civilă” generic. |
| Certificat căsătorie / documente de divorț / deces | **Numai după caz**, cu numele actualizat, în condițiile publicate. | Arată doar dacă utilizatorul indică situația relevantă. |
| Act de identitate românesc | Dacă există: CI/CIP/buletin. | Rând separat „Dacă îl ai”, nu afirmat obligatoriu pentru toți titularii CRDS. |
| Dovadă a domiciliului/dreptului de ședere în UK | Document emis de autoritatea statului de domiciliu, cu traducere autorizată **după caz**. | Întreabă tipul documentului; „am dovadă” nu dovedește automat acceptabilitatea. |
| Dovadă achitare contravaloare | DGP [documente CRDS](https://pasapoarte.mai.gov.ro/documente-necesare-pentru-pasaport-simplu-electronic-simplu-temporar-cu-mentionarea-statului-de-domiciliu-c-r-d-s/) indică dovada plății, pe hârtie sau electronic, conform condițiilor. | Checklist „Confirmă modalitatea de plată la consulat” și dovada aferentă, după instrucțiunile consulatului. |
| Schimbare nume/prenume în străinătate | eConsulat precizează că **înaintea** cererii cu numele schimbat trebuie înscrisă schimbarea în actele românești de stare civilă. | Blocher vizibil pentru `DATA_CHANGE`; nu promite finalizarea dosarului înainte de transcriere/mențiune. |

Sursa separată [DGP — cetățeni CRDS](https://pasapoarte.mai.gov.ro/cetateni-romani-cu-domiciliul-in-strainatate/) explică faptul că uneori un pașaport anterior valabil poate rămâne în uz până la ridicarea noului document. **Această regulă nu înseamnă că un pașaport deteriorat sau cu date care nu mai corespund este în continuare utilizabil pentru călătorie.**

## 2. Dovada domiciliului UK — lista DGP, cu perioade și traduceri

Sursa: [DGP — Condiții Marea Britanie, PDF din 2022, o pagină](https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Marea-Britanie.pdf), încă accesibilă pe domeniul DGP la data verificării.

| Tip document | Condiție din fișa DGP | Traducere autorizată după fișa 2022 |
| --- | --- | --- |
| Pașaport britanic sau certificat de cetățenie/naturalizare | În condițiile fișei | Nu |
| NINo (document/card cu numărul) | Documentul specific din fișă, nu simpla tastare a numărului | Nu |
| Adeverință școlarizare | Pentru anul curent sau acoperind cel puțin un an, **incluzând ziua depunerii** | Nu |
| Council tax | Factura aferentă **anului curent** | Nu |
| P60 | Pentru **anul fiscal anterior** | Nu |
| P45 | Emis **în anul curent sau cel anterior** | Nu |
| Documente contribuții self-employed | Dovada contribuțiilor | **Da** |
| Contract închiriere | Încheiat pentru cel puțin **un an**, inclusiv prin prelungire/succesiune, **plus dovada plății chiriei** | **Da** |
| Settled/pre-settled, dovadă electronică | Confirmare generată după verificarea de la consulatele române menționate în fișă, **la depunere ori cu maximum 30 zile înainte** | Nu, pentru acele documente descrise |

**Atenție la vechimea fișei:** aceasta menționează și **BRP fizic**, însă [GOV.UK — BRP](https://www.gov.uk/biometric-residence-permits) confirmă că BRP-urile au expirat și sunt înlocuite de eVisa. Nu trata un BRP fizic ca dovadă universal valabilă de ședere în 2026. Înainte de a promite acceptarea unui document la ghișeu, verifică actualizarea listelor și condițiilor DGP/eConsulat pentru oficiul ales.

## 3. UKVI eVisa, share code și schimbarea numelui

- [GOV.UK — eVisa](https://www.gov.uk/evisa): evidență digitală a statutului de imigrare.
- [GOV.UK — share code](https://www.gov.uk/evisa/view-evisa-get-share-code-prove-immigration-status): codul poate fi folosit pentru a verifica statutul și este valabil **90 de zile**. Acest termen **nu înlocuiește** condiția de 30 zile a confirmării *consulare* descrise de DGP în 2022.
- [GOV.UK — actualizează contul UKVI](https://www.gov.uk/evisa/update-ukvi-account): după schimbarea **numelui** sau a **pașaportului/documentului de călătorie**, actualizează datele contului UKVI conform procedurii britanice. Această etapă este **separată** de actualizarea actelor românești de stare civilă și depinde de cazul concret.

**Formulare sigură pentru ghid (înainte de aprobare, doar recomandare):**
„Dacă ai settled/pre-settled status, consultă eVisa în contul UKVI și verifică împreună cu consulatul român ce document sau confirmare electronică este acceptată pentru pașaportul CRDS. Codul de verificare UKVI este valabil 90 de zile în sistemul britanic; fișa DGP din 2022 menționează separat o confirmare obținută prin verificare consulară, de cel mult 30 de zile. Nu presupune că cele două dovezi sunt echivalente.”

## 4. Taxe, termene și depunerea cererii

- [eConsulat — taxe CRDS electronic](https://www.econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/TaxeConsulareDescriere/203000002) afișează **53 EUR sau echivalentul local** la consulat.
- [eConsulat — mod soluționare](https://www.econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/ModSolutionare/203000002) indică termen maxim general de **60 de zile lucrătoare** pentru pașapoarte electronice cerute la consulate din state **din afara UE**, inclusiv UK; sunt detalii separate pentru locul ridicării.
- [eConsulat — descriere serviciu](https://econsulat.ro/PasaportSimpluElectronicRomaniMajoriCRDS/DescriereServiciu/203000002) indică formularul pentru pașaportul CRDS. Utilizatorul trebuie să verifice detaliile oficiului consular ales. O „Cerere completă” permite încărcarea documentelor pentru verificare înainte de prezentare, dar verificarea online nu garantează acceptarea la ghișeu.

## 5. Diferențe față de generatorul istoric (nu presupune că sunt identice cu draftul privat)

Analiza sursei `showB5VariantGuide(mode)` din `main`:
- Checklist-ul din dreapta are **trei blocuri agregate**: pașaport, dovadă de domiciliu, stare civilă. Nu distinge vizual naștere/căsătorie/divorț, CI dacă există, documente de plată; acestea apar doar agregate sau în pași.
- Pentru blocul „Pașaport CRDS actual”, proprietatea `ok:true` este setată **necondiționat**, inclusiv când `oldStatus='DAMAGED'`. Asta poate colora drept „OK” un pașaport deteriorat. **Defect UX confirmat în codul istoric; neconfirmat în scriptul privat revizuit.**
- Regula `DATA_CHANGE` din generator menționează actualizarea actelor românești, dar **nu explică explicit actualizarea contului UKVI** după schimbarea numelui ori pașaportului. Recomandare: pas UKVI numai pentru UK și numai după rezolvarea actelor românești.
- `b5CountryConfig.GB` include dovada de domiciliu fără perioadele și traducerile concrete din fișa 2022; draftul local este mai prudent, însă înainte de vânzare trebuie verificată lista exactă și actualitatea ei.

## 6. Ce blochează încă aprobarea

1. Confirmare curentă DGP/consulat pentru acceptarea eVisa/share code și aplicarea regulii de 30 zile în 2026.
2. Audit manual al documentelor, traducerilor și intervalelor din cazul `DAMAGED` vs `DATA_CHANGE` și al rezultatelor pe iPhone Safari.
3. Clarificarea etichetei verde pentru pașaport deteriorat și afișarea checklist-ului granular după situație.
4. Test complet în staging al serviciului plătit: starea salvată, cheie/rută, identitate, acces, plată de test, recuperare și refund.
5. `sale_approved=NO` pentru ambele ghiduri până la verificarea individuală și acceptare editorială.

**Fără update D1, fără transfer de scripturi premium, fără schimbare checkout, fără merge/deploy.**
