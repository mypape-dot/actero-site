# Contract de integrare — validarea pe server a eligibilității pentru plată

**Stare: DRAFT pentru coordonare cu Codex. Nu implementează Worker-ul.**
Acest document descrie ce trebuie să valideze Worker-ul (`cloudflare/worker.js`, PR #16)
înainte de a emite un checkout. Implementarea codului Worker se face separat, de către
Codex, pentru a evita conflictele. Fișierul de față nu modifică Worker-ul, D1, Shopify sau
producția. Ramura PR #17 rămâne Draft; niciun ghid nu este aprobat pentru vânzare.

## 1. Cele două porți sunt INDEPENDENTE

Un checkout este permis numai dacă **ambele** porți trec, fiecare verificată **pe server**
(niciodată pe baza declarației clientului):

| Poartă | Întrebarea la care răspunde | Sursa de adevăr | Unde este aplicată azi |
|--------|------------------------------|-----------------|------------------------|
| **A. Eligibilitate pentru plată** (motor) | „Pentru acest caz concret, motorul oferă o procedură utilizabilă, fără documente lipsă, contradicții sau necunoscute?" | `paymentDecisionFor({answers,docs,route})` din `index.html` | **Doar pe client.** Worker-ul NU o reproduce. |
| **B. Aprobare editorială / de vânzare** (D1) | „Ghidul pentru acest `guide_key`+`route` a fost verificat editorial și aprobat pentru vânzare, inclusiv pentru toate țările acolo unde e partajat?" | `guide_approvals` + `guide_country_approvals` în D1 | **Pe server**, în `/checkout` (`worker.js:169-177`, `hasAllCountryApprovals`). |

**Problema pe care o închide acest contract (item 5):** azi Worker-ul verifică doar
poarta **B**. `serializeCaseState` (`recovery.js`) stochează `answers`/`docs` trimise de
client, dar comentariul său spune explicit „The frontend recalculates blockers" — deci
poarta **A** nu este reprodusă pe server. Un client modificat ar putea trimite un
`guide_key` aprobat în D1 pentru un caz pe care motorul l-ar bloca (document lipsă,
contradicție). Astăzi este inofensiv pentru că `/checkout` este dezactivat implicit
(`SHOPIFY_CHECKOUT_ENABLED!=='true'` → `503 checkout_disabled`) și niciun ghid nu este
aprobat, dar este un gol structural: eligibilitatea nu trebuie să depindă de client.

## 2. Ce trebuie să adauge Worker-ul (poarta A, pe server)

La `POST /checkout`, după validările de format existente și ÎNAINTE de a emite
`checkoutUrl`, Worker-ul trebuie să:

1. Reconstruiască decizia motorului pe server din `case_state` deja primit
   (`{answers, docs, route}` — vezi `serializeCaseState`), prin algoritmul canonic
   **`paymentDecisionFor`** (secțiunea 3).
2. Respingă checkout-ul dacă `decision.allowed !== true`
   → `{ok:false,error:'not_eligible'}`, 409. (Documente lipsă, contradicții sau
   necunoscute = fără vânzare, exact ca pe client.)
3. Respingă checkout-ul dacă `decision.key !== guide_key` sau `decision.route !== route`
   (clientul nu alege ghidul; motorul îl derivă) → `{ok:false,error:'case_route_changed'}`, 409.
4. Respingă checkout-ul dacă `decision.legalBasisConfirmed !== true`
   → `{ok:false,error:'legal_basis_unconfirmed'}`, 409. Aceasta este poarta care
   oprește vânzarea cazurilor BE/NL/IE și a remediului Franța până la validarea umană
   (vezi secțiunea 4). Nu o relaxa fără o decizie umană consemnată.

Toate cele patru verificări sunt **în plus** față de poarta B (aprobarea D1), nu în locul ei.
Ordinea nu contează; checkout-ul trece doar dacă toate trec.

## 3. Algoritmul canonic (poarta A)

Sursa unică de adevăr este `paymentDecisionFor` din `index.html`. Pentru a evita
divergența între client și server, ținta este un **modul comun** importat de ambele
părți; până atunci, serverul reproduce exact aceeași funcție.

Intrare: `{ answers: object, docs: object, route: string }` (din `case_state`).
Ieșire (câmpurile relevante pentru contract):

```
{
  allowed: boolean,              // ruta rezolvată && ghid validat && fără contradicții
                                 // && fără necunoscute && fără blocaj neremediabil
  key: string|null,              // guide_key derivat de motor (NU cel trimis de client)
  route: string,                 // ruta derivată de motor
  legalBasisConfirmed: boolean,  // false pentru BE/NL/IE B1/B5 și pentru remediul FR
  unremedied: [{code,...}],      // blocajele care opresc plata (explicație gratuită)
  unknowns: [string],            // ce mai trebuie clarificat
  contradictions: [{code,fix}]   // răspunsuri care se contrazic
}
```

Reguli (toate deja implementate în `index.html`, de oglindit pe server):
- `allowed = routeResolved && validated && !contradictions.length && !unknowns.length && !unremedied.length`
- `validated = !!key && validatedGuideFor(route, answers, domicile)`
- `unremedied` = blocajele pentru care `remedyInGuide(code,key,answers)` este fals
  (registrul de remedii este deliberat minimal).
- `legalBasisConfirmed = false` când `residence_country ∈ {BE,NL,IE}` și
  `route ∈ {B1_FIRST_CRDS, B5_EXISTING_CRDS}`, SAU când există un blocaj
  `CURRENT_PROOF_MISSING` remediat pentru Franța; `true` altfel.

**Cerință de paritate (obligatorie):** un test trebuie să ruleze aceleași fixture-uri
pe ambele implementări și să verifice că `allowed`, `key`, `route` și
`legalBasisConfirmed` coincid. Fixturile din `cloudflare/tests/engine-full-journeys.test.mjs`
(cele 43 de chei de catalog + cazurile de blocare) sunt punctul de pornire. Fără acest
test, cele două implementări vor diverge tăcut.

## 4. Relația cu `legalBasisConfirmed`

Motorul marchează deja (fără a schimba `allowed`) deciziile fără bază oficială confirmată
de autoritățile române: listele de documente acceptate pentru BE/NL/IE (`localProofRule`)
și remediul Franța (`remedyInGuide`). Vezi `BE_NL_IE_EVIDENCE_GATES_20261014.json`
(`overall_sale_approval: "NO"`, `romanian_consular_acceptance_confirmed: false`).

Poarta A.4 de mai sus transformă acest semnal într-un refuz de vânzare pe server.
Nu echivala „există în legea țării respective" cu „acceptat de autoritățile române":
`legalBasisConfirmed` rămâne `false` până când un om validează fiecare decizie și
consemnează decizia. Abia atunci se poate rafina regula din secțiunea 3.

## 5. Ce NU schimbă acest contract

- Nu activează checkout-ul: `SHOPIFY_CHECKOUT_ENABLED` rămâne nesetat.
- Nu aprobă niciun ghid: toate cele 43 rămân `sale_approved=NO`.
- Nu atinge D1, Shopify, secretele sau producția.
- Nu modifică `worker.js` — implementarea este a lui Codex, pe baza acestui contract.

## 6. Checklist pentru implementarea Worker (Codex)

- [ ] Modul comun cu `paymentDecisionFor` (sau oglindă + test de paritate).
- [ ] `/checkout` respinge `allowed!==true` (`not_eligible`).
- [ ] `/checkout` respinge `key`/`route` nepotrivite față de decizia motorului.
- [ ] `/checkout` respinge `legalBasisConfirmed!==true` (`legal_basis_unconfirmed`).
- [ ] Poarta B (aprobarea D1) rămâne neatinsă și cumulativă.
- [ ] Test de paritate client ↔ server pe fixturile de catalog și pe cazurile de blocare.
- [ ] Niciun checkout real până la aprobarea editorială + validarea juridică + E2E.
