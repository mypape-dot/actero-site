# T-03 — testele pentru eligibilitatea pe server

**Stare (16.10.2026):** doar analiză și teste pregătitoare. Worker-ul nu este modificat. Implementarea
pentru server este a lui Codex (commitul local `e172cf9`, nepublicat și neverificat de noi). Nimic de
aici nu activează checkout-ul, nu atinge D1, Shopify sau producția și nu aprobă vreun ghid.

## 1. Problema

Pe ramura PR #17, `paymentDecisionFor({answers, docs, route})` primește ruta de la apelant și nu
verifică dacă răspunsurile o permit. În pagină nu contează, pentru că întrebările aleg ruta. Pe server
contează: un browser modificat poate trimite o rută imposibilă.

Corpusul `cloudflare/tests/fixtures/server-eligibility-cases.json` are 7 astfel de cazuri (`forged:*`).
Decizia din pagină le acceptă azi (`client_decision_today.allowed = true`). De exemplu:

- A2 (procură) cu doar un pașaport: ruta derivată ar fi A3, care nu se vinde;
- titlul de călătorie cu clientul aflat în România;
- carte de identitate provizorie (D1) fără domiciliu în străinătate;
- CEI în România (C1) cu domiciliul în străinătate;
- A1 pentru un minor, un necetățean sau o țară nesuportată.

`ELIGIBILITY_SERVER_CONTRACT.md` presupune un câmp `decision.route` „derivat de motor”. Acest câmp
**nu există**: motorul nu derivă ruta, ea se alege în funcțiile întrebărilor. Worker-ul are nevoie de una
dintre:

1. **O funcție pură `deriveRoute(answers, docs)`**, comună paginii și Worker-ului, extrasă din
   `routeCommon` și din funcțiile `next` ale întrebărilor. Este varianta recomandată.
2. **Condițiile fiecărei rute (`routePreconditionsOf`)**, verificate în `contradictionsOf`: domiciliu,
   acte anterioare, locație, scop, vârstă, cetățenie, țară.

## 2. Principiul

Datele canonice ale cazului sunt `case_state.answers` și `case_state.docs`. După crearea checkout-ului,
ele sunt copia salvată în `evaluation_json`.

- **Decizia se calculează doar din ele.** Câmpurile `route`, `guide_key`, `status`, `blockers`,
  `unknowns` și `clarified` din cerere nu decid nimic.
- **`route` și `guide_key` din cerere se compară cu cele derivate de server.** Orice diferență înseamnă
  refuz.

Ordinea la `POST /checkout`:

1. `SHOPIFY_CHECKOUT_ENABLED` setat, altfel `503 checkout_disabled` (regula există deja).
2. Format, origine și cotă (există deja).
3. Ruta și cheia derivate din datele canonice.
4. `paymentDecisionFor` pe datele canonice. Include `missingRequiredOf` (T-02) și starea „Nu știu” la urgențe (T-01).
5. `legalBasisConfirmed`.
6. Poarta editorială D1 (există deja).

Pașii 3–5 sunt noi și sunt toți cumulativi.

## 3. Testele cerute integrării

Fiecare refuz trebuie verificat pe trei niveluri:

- statusul HTTP și codul de eroare;
- **niciun rând** nou în `access_grants` sau `checkout_intents`;
- **niciun apel** către Shopify (stub-ul de `fetch` nu e apelat).

| ID | Ce verifică | Fixturi | Rezultat cerut |
| --- | --- | --- | --- |
| T3-01 | Toate cele 43 de chei: cazul curat trece de eligibilitate cu cheia derivată | `clean:*` (42 de chei) și `blocked:A3_FIRST_ID_CONSULAR` (a 43-a) | `allowed`, `guide_key` și `route` egale cu `expected`; A3 refuzat cu `not_eligible` |
| T3-02 | Baza juridică neconfirmată nu se vinde | `clean:*_BE`, `*_NL`, `*_IE` (9 cazuri), `clean:B5_RENEWAL_FR_alternative_proof` | 409 `legal_basis_unconfirmed` |
| T3-03 | Blocajele nerezolvate nu se vând | `blocked:no_foreign_proof`, `blocked:local_proof_NL_BRP`, `blocked:urgent_from_romania`, `blocked:d1_expired_crds` | 409 `not_eligible` |
| T3-04 | Ruta trimisă de browser nu e crezută | cele 7 `forged:*` cu `route_not_derivable` | 409: `case_route_changed` dacă ruta derivată diferă, `not_eligible` dacă nu se poate deriva nicio rută |
| T3-05 | Cheia trimisă de browser nu e crezută | `forged:guide_key_other_country` (cerere `B1_FR` pentru un caz din Italia) | 409 `case_route_changed`; cheia derivată este `B1_IT` |
| T3-06 | Câmpurile de stare din cerere sunt ignorate | `forged:status_and_blockers_cleared` | 409 `not_eligible`, deși cererea spune `status: GREEN` și `blockers: []` |
| T3-07 | Sesiunile vechi (T-02) | `stale:B1_crds_history_missing`, `stale:B1_reacquired_without_Q106`, `stale:B5_never_crds_without_Q013` | 409 `not_eligible` |
| T3-08 | Starea „Nu știu” la urgențe (T-01) | `unknown:urgent_passport_status_unchecked` | 409 `not_eligible` |
| T3-09 | Paritate pagină ↔ server | toate cazurile `journey`, `stale_or_unknown` | aceleași `allowed`, `guide_key`, `route` și `legalBasisConfirmed`; la cazurile `forged:*`, serverul e mai strict decât pagina |
| T3-10 | Accesul plătit urmează cheia derivată de server | un caz `clean:*`: checkout, apoi webhook sau recuperare care cer altă cheie | acces doar la cheia din `checkout_intents` |
| T3-11 | Checkout-ul rămâne oprit implicit | orice caz `clean:*`, fără `SHOPIFY_CHECKOUT_ENABLED` | 503 `checkout_disabled`, înaintea oricărei evaluări |
| T3-12 | Răspunsurile de refuz nu dezvăluie motivele detaliate | orice refuz | corpul conține doar `ok:false` și codul; fără liste de blocaje sau texte |

## 4. Cum se rulează

- **Corpusul:** `cloudflare/tests/fixtures/server-eligibility-cases.json`, cu 61 de stări sintetice.
  Se regenerează cu `node cloudflare/tests/fixtures/build-server-eligibility-cases.mjs cloudflare/tests/fixtures/server-eligibility-cases.json`.
  Regenerarea e reproductibilă.
- **Ce rulează azi:** `node --test cloudflare/tests/server-eligibility-spec.test.mjs`. Verifică:
  - corpusul e complet (toate cele 43 de chei);
  - corpusul e sincron cu decizia din pagină;
  - fiecare verificare de server are un `todo` cu numele ei.
- **La integrarea lui Codex:** fiecare `todo` devine un test real, folosind Worker-ul local din #18
  (`cloudflare/tests/helpers/local-worker.mjs`). Fixturile nu se schimbă. Un `todo` se șterge doar
  când testul real trece.

## 5. Ce nu acoperă

- Corectitudinea juridică a regulilor: e în raportul din documentul de audit.
- Conținutul ghidurilor din D1.
- Plata reală.
- Patch-ul lui Codex: până nu e publicat, integrarea cu el **nu este verificată**.
