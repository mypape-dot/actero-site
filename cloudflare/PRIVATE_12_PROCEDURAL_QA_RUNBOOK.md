# ActeRO — audit procedural privat pe ghidurile afișate (14 octombrie 2026)

**Stare:** instrument de diagnostic, fără aprobare juridică sau pentru vânzare. PR Draft; nu se publică, nu se aplică scripturi noi în D1 și nu se modifică plățile Shopify.

## De ce avem nevoie de această verificare

Cele 12 ghiduri B1/B5 pentru Franța, Belgia, Țările de Jos și Irlanda au trecut 24/24 randări offline ale draftului editorial, fără avertizări automate de design. Asta **nu** confirmă corectitudinea procedurilor. Ghidurile reale rămân în Cloudflare D1.

Documentele de audit publice sunt:
- `B1_FR_OFFICIAL_RULES_AUDIT_20261014.md`: condițiile dovezilor subsidiare pentru CRDS Franța.
- `B1_B5_BE_NL_IE_OFFICIAL_RULES_AUDIT_20261014.md`: diferențele Anexa 19, BRP/RNI/BSN, PPS/IRP/EUTR2.
- `BE_NL_IE_EVIDENCE_GATES_20261014.json`: 9 cazuri negative pentru care ghidul nu trebuie să garanteze eligibilitatea.

## Ce face

`audit-private-12-procedure-signals-on-mac.sh` citește **numai** cele 12 rânduri D1 prin `SELECT`, transmise direct către Node, fără export pe disc, apoi folosește Chromium desktop și WebKit cu viewport mobil pentru a reda textul afișat utilizatorului în stări *sintetice* ale chestionarului.

Rezultatul afișează câte o linie `EVIDENCE_REVIEW` pentru fiecare ghid: identificatorul public, **categorii predefinite** de expresii găsite (`markers`), semnale de risc (`flags`) și dacă rezultatele celor două browsere coincid (`mobile_match`). Nu se afișează propozițiile originale, linkuri, scripturi, capturi sau date de client. Nu se salvează PDF-uri.

Semnalele sunt doar indicii de căutat **manual în context**; sunt posibile rezultate fals pozitive și fals negative. Cuvintele-cheie nu pot demonstra că o condiție este prezentată juridic corect. Toate rezultatele au în continuare `HUMAN_LEGAL_REVIEW_REQUIRED`.

## Comandă pentru proprietar, numai după CI verde

```bash
cd ~/Desktop/actero-site
git fetch origin
git switch audit/private-12-procedural-qa-20261014 || git switch --track origin/audit/private-12-procedural-qa-20261014
git pull --ff-only
bash cloudflare/audit-private-12-procedure-signals-on-mac.sh
```

Dacă Git refuză operațiunea din cauza modificărilor locale, nu șterge fișiere. Wrapperul rulează Wrangler *înainte* de pipe, ca să nu ascundă un prompt de autentificare sau instalare.

În chat se poate trimite **doar** rezultatul textual `PRIVATE PROCEDURE SIGNALS` și liniile `EVIDENCE_REVIEW`. Nu trimite conținutul premium, tokenuri sau exporturi din D1.

## Criteriile de analiză manuală

1. **Franța:** clientul care solicită *prima dată* CRDS nu trebuie direcționat automat către Carte Vitale, permis sau aviz fiscal ca dovezi subsidiare. Verifică exact condițiile fișei DGP și actualitatea la consulat.
2. **Belgia:** Anexa 19 este un document din procesul de înregistrare, nu o aprobare garantată a rezidenței. Confirmă stadiul și acceptarea dovezii la autoritatea română.
3. **Țările de Jos:** BSN/RNI nu sunt echivalente cu înregistrarea de rezident BRP. IND 8004 este condițional, nu formular standard CRDS.
4. **Irlanda:** PPS nu dovedește singur domiciliul, iar IRP/EUTR2 nu trebuie cerute automat tuturor cetățenilor români.
5. **Toate țările:** primul CRDS, reînnoirea și pierderea pașaportului au condiții diferite. Verifică sursele oficiale, actele civile, traducreile, taxele, pașaportul anterior și dovada concretă de domiciliu. Doar autoritatea competentă poate confirma acceptarea unei dovezi într-un caz real.

## Etapele ulterioare

După semnalele private, revizuire editorială ghid-cu-ghid în mediul privat, comparând **fiecare propoziție procedurală** cu DGP și cu sursele locale. Apoi QA real pe Safari/PDF și fluxul postplată Shopify–Worker. Nu există aprobare automată: `editorial_clearance=NO`, `consular_acceptance_verified=false`, `sale_approved=NO` pentru toate.

**Interdicție:** niciun `UPDATE` D1, merge, deploy, activare cumpărare sau încărcare de scripturi private în GitHub ca efect al acestui test.
