# ActeRO — audit preliminar al conținutului oficial (13.10.2026)

**Statut: verificare PARȚIALĂ, NU aprobare pentru vânzare.**
**Nu au fost citite scripturile private din Cloudflare D1.**
Analiza compară surse oficiale consultate la 13.10.2026, catalogul celor 43 de chei și fragmente selectate din `main` (o versiune publică *istorică*, NU dovada conținutului efectiv accesibil după plată).
Nicio schimbare în `sale_approved` sau în baza de date.

## Rezultatele verificării unor afirmații generale

| Ref | Temă | Constatare din sursă oficială | Implicație pentru ActeRO | Stadiu |
|---|---|---|---|---|
| OS-01 | Taxă pașaport depus în România | DGP indică **265 lei**, în vigoare din 01.08.2025, pentru pașaport simplu electronic/temporar depus la serviciile publice comunitare. | Nu prezentați această sumă ca tarif universal pentru depuneri consulare: pentru consulate, taxele și modalitatea sunt stabilite separat. | Regula confirmată; ghidurile individuale NEVERIFICATE |
| OS-02 | Termen pașaport simplu electronic | DGP indică **15 zile lucrătoare** pentru cereri depuse în România, **45 zile** la consulate în state UE, **60 zile** la consulate din state terțe UE. În anumite combinații depunere/ridicare se aplică și alte particularități explicate de DGP. | Referirea istorică la **60 zile** pentru CH/GB nu trebuie ștearsă automat: regula generală DGP o susține pentru pașaportul electronic; verificați scenariul complet și locul ridicării. | Regula confirmată; scenarii individuale NEVERIFICATE |
| OS-03 | CEI – taxă | DGEP indică prima CEI gratuită **după vârsta de 13 ani și 11 luni** și **70 lei** pentru emiterea unei noi CEI sau sub pragul respectiv. | Formula generică „prima CEI gratuită de la 14 ani” trebuie aliniată exact regulii publicate (deși V1 deservește doar adulți). Nu confundați taxele CEI cu taxele pentru CIS. | Regula confirmată; ghidurile individuale NEVERIFICATE |
| OS-04 | CEI prin consulat / domiciliu străin | DGEP indică în continuare că mecanismele pentru CEI cu domiciliu în străinătate și pentru persoanele cu domiciliu în România aflate temporar în străinătate sunt în curs de implementare. | Traseele care NU solicită plată pentru aceste proceduri sunt justificate de statusul DGEP; reverificare înainte de lansare. | Regula confirmată la data consultării |
| OS-05 | CRDS și drept de ședere | DGP enumeră multiple baze posibile: drept de ședere cu durata potrivită; reunificare; ședere permanentă; cetățenia țării; drept de muncă / studii; certificat de înregistrare sau rezidență UE/SEE/CH. Documentele, traducerile și condițiile concrete se verifică pe caz. | O simplă bifă „Am document” nu dovedește automat acceptabilitatea juridică a documentului exact; ghidul trebuie să explice condițiile, nu să garanteze succesul. | Regula confirmată; dovezi țară/cu țară NEVERIFICATE |
| OS-06 | Permis elvețian G | SEM definește permisul G EU/EFTA pentru navetiști care locuiesc în UE/EFTA și lucrează în CH, revenind periodic la domiciliul principal în afara Elveției. | Oprirea rutei care ar interpreta permisul G ca dovadă a domiciliului principal în Elveția este prudentă. B/C/L și alte documente necesită examinare distinctă. | Regula confirmată; probele CRDS CH NEVERIFICATE |
| OS-07 | UK eVisa | GOV.UK explică eVisa ca evidență digitală a statutului, înlocuind documentele fizice; statutul se poate arăta prin serviciul de verificare/partajare adecvat. | Revizuiți ghidurile B1_GB, B5_RENEWAL_GB, B5_LOST_GB și orice ghid B5 comun folosit în GB: nu presupuneți că orice solicitant deține un BRP fizic valabil; documentele acceptate de DGP/consulat trebuie confirmate separat. | Regula UK confirmată; acceptarea documentului la CRDS NEVERIFICATĂ |
| OS-08 | Turism și pașaport temporar | DGP exclude solicitările bazate exclusiv pe scopuri turistice. | Traseul care nu oferă un ghid plătit pentru această situație este justificat ca principiu; verificați și documentele doveditoare ale urgenței pentru celelalte cazuri. | Regula confirmată; ghid complet NEVERIFICAT |

## Probleme de conținut și prezentare: surse de audit

| Ref | Evidență | Acțiunea corectă | Stadiu |
|---|---|---|---|
| G-01 | În `main` istoric apar numeroase marcaje „Verificat la 5 octombrie 2026”. Aceste etichete sunt **afirmații comerciale de verificare**, nu dovezi ale unei verificări individuale. | Pentru ghidul actual D1: înlocuiți cu data verificării editoriale consemnate pentru acel `guide_key`, ori eliminați eticheta. | PENDING D1 |
| G-04 | În funcția istorică `showA1ValidatedGuide`, un comentariu de tip editorial despre verificarea taxei de către „ghidul comercial” apare în câmpul `note` adresat clientului. | Rescrieți în limbaj pentru client: „Verifică taxa actuală pe portalul oficial înainte de plată.” | Confirmat istoric; PENDING D1 |
| G-05 | În funcția istorică `showC5ValidatedGuide`, titlul folosește un `label` care cade pe „de înlocuit” când statusul este necunoscut. | Verificați că această stare nu ajunge cumpărabilă fără un tip valid al incidentului; corectați fallback-ul doar dacă testele de stare îl reproduc. | Risc de fallback, nu eroare dovedită în D1 |
| G-09 | Pentru UK, pagina oficială GOV.UK despre eVisa trebuie corelată cu documentele acceptate de DGP. | Verificați fiecare instrucțiune privind BRP/eVisa, inclusiv dovada prin portal, download, share code și acceptarea consulară. | PENDING |
| G-11 | Materialele SEM despre B/C/L/G sunt surse de informare privind statutul; nu automat formulare oficiale de completat pentru CRDS. | Marcați-le „sursă de informare”, nu „formular de depus”, în ghidurile relevante. | PENDING D1 |
| G-12 | Afirmația istorică „maximum 60 zile lucrătoare” pentru pașaport electronic depus la consulat în CH/UK are suport în regula generală DGP. | Corectați auditul vechi: nu o tratați drept falsă doar pentru că nu fusese încă verificată. Verificați totuși în fiecare ghid *tipul pașaportului* și combinația depunere/ridicare. | GENERAL RULE CONFIRMED; PENDING D1 |

## Surse oficiale consultate la 13.10.2026
- [DGP – Cetățeni români cu domiciliul în străinătate](https://pasapoarte.mai.gov.ro/cetateni-romani-cu-domiciliul-in-strainatate/)
- [DGP – Documente CRDS](https://pasapoarte.mai.gov.ro/documente-necesare-pentru-pasaport-simplu-electronic-simplu-temporar-cu-mentionarea-statului-de-domiciliu-c-r-d-s/)
- [DGP – Tarife pașaport](https://pasapoarte.mai.gov.ro/tarife-2/)
- [DGP – Termen pașaport electronic](https://pasapoarte.mai.gov.ro/termen-de-eliberare-a-pasaportului-simplu-electronic/)
- [DGEP – Întrebări CEI](https://dgep.mai.gov.ro/in-domeniul-evidentei-persoanelor-cartea-electronica-de-identitate/)
- [SEM – G EU/EFTA](https://www.sem.admin.ch/sem/en/home/themen/aufenthalt/eu_efta/ausweis_g_eu_efta.html)
- [GOV.UK – eVisa](https://www.gov.uk/evisa)
- [DGP – Pașaport simplu temporar](https://pasapoarte.mai.gov.ro/documente-necesare-pentru-pasaport-simplu-temporar/)

## Concluzie de lansare

- **43 de identificatori** există în catalog, iar registrul editorial are **43/43 `sale_approved=NO`**.
- **0 variante au fost confirmate ca scripturi reale și complete în D1** de acest audit; această frază NU înseamnă că scripturile lipsesc, ci că încă nu le-am inspectat.
- Pentru revizia fiecărui ghid este necesară vizualizarea **privată** a conținutului său efectiv, fără expunerea `script_js` într-un GitHub public, plus lista surselor, documentelor, taxelor, termenelor și condițiilor.
- Verificarea surselor comune **nu poate** transforma automat cele 43 de rânduri în aprobări editoriale.
- Pentru o garanție de blocare a vânzărilor, verificarea aprobării trebuie făcută **la server**; testul CSV adăugat în CI este doar o protecție a registrului, nu o verificare runtime Shopify.

**Fără modificări de prețuri, checkout, D1, merge în `main` sau publicare.**
