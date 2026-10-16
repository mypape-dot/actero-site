// ActeRO engine audit regression tests (15 Oct 2026; repo copy 16 Oct 2026).
// The 29 cases of the 15.10 audit encode the CORRECT behaviour; on PR #15 (b8c5009) the cases tagged
// failsOnPR15 fail by design. They drive the REAL questionnaire from index.html with synthetic answers
// through helpers/engine-harness.mjs, whose DEFAULTS answer the questions added on 16.10
// (Q012, Q013, Q033, Q034, Q126) with the clean value. No premium guide code, no D1 export, no network.
//   node --test cloudflare/tests/engine-audit-2026-10-15.test.mjs
//   INDEX=/path/to/index.html node --test cloudflare/tests/engine-audit-2026-10-15.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './helpers/engine-harness.mjs';

const noPay=o=>o.kind!=='PAYWALL';
const CASES=[
 // E-01 — passport shows another country, client answers "same country" -> renewal guide of the residence country is sold.
 {id:'E01_passport_other_country_must_not_sell_same_country_renewal',failsOnPR15:true,country:'FR',documents:['PASSPORT'],statuses:{PASSPORT:'EXPIRED'},
  answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'OTHER',same_country:'YES',foreign_proof:'YES'},
  expect:o=>!(o.kind==='PAYWALL'&&o.key==='B5_RENEWAL_FR')},
 {id:'E01_control_passport_other_country_moved',country:'FR',documents:['PASSPORT'],statuses:{PASSPORT:'EXPIRED'},
  answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'OTHER',same_country:'NO',foreign_proof:'YES'},
  expect:o=>o.kind==='PAYWALL'&&o.key==='B5_MOVED'},
 // E-02 — passport shows the current country, client answers "moved" -> B5_MOVED sold on a contradiction.
 {id:'E02_passport_current_country_contradicts_moved',failsOnPR15:true,country:'FR',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},
  answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT',same_country:'NO',foreign_proof:'YES'},
  expect:o=>!(o.kind==='PAYWALL'&&o.key==='B5_MOVED')},
 // E-03 — latest passport shows Romania, client picks "CRDS passport" at Q011 -> existing-CRDS guide sold.
 {id:'E03_latest_passport_romania_no_existing_crds_guide',failsOnPR15:true,country:'FR',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},
  answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'ROMANIA',crds_clarify:'CRDS',b5case:'RENEWAL',same_country:'YES'},
  expect:o=>!(o.kind==='PAYWALL'&&o.route==='B5_EXISTING_CRDS')},
 {id:'E03_crds_doc_but_latest_passport_romania',failsOnPR15:true,country:'FR',documents:['CRDS_PASSPORT','PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED',PASSPORT:'VALID'},
  answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'ROMANIA',same_country:'YES'},
  expect:o=>!(o.kind==='PAYWALL'&&o.route==='B5_EXISTING_CRDS')},
 // E-04 — valid ID card is a travel document in the EU (Law 248/2005 art. 6^1) -> travel title must not be sold.
 {id:'E04_valid_id_card_no_travel_title',failsOnPR15:true,country:'FR',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},
  answers:{goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'ROMANIA'},expect:noPay},
 {id:'E04_expiring_passport_still_valid_no_travel_title',failsOnPR15:true,country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'EXPIRING'},
  answers:{goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'ROMANIA'},expect:noPay},
 {id:'E04_control_lost_passport_travel_title',country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'LOST'},
  answers:{goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'ROMANIA'},expect:o=>o.kind==='PAYWALL'&&o.key==='TRAVEL_TITLE_RETURN_RO'},
 // E-05 — client physically in Romania routed to the consular temporary-passport guide.
 {id:'E05_urgent_other_from_romania_not_consular_guide',failsOnPR15:true,country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'LOST'},
  answers:{goal:'URGENT_TRAVEL',physical:'YES',travel_dest:'OTHER',travel_urgent_basis:'OBJECTIVE_URGENT',ever_crds:'NO'},expect:noPay},
 // E-06 — "Nu sunt sigur" at Q010 must not loop back to Q010 forever.
 {id:'E06_q010_unknown_does_not_loop',failsOnPR15:true,country:'FR',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},
  answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',passport_domicile:'CURRENT',goal_conflict:'UNKNOWN',ever_crds:'NO'},
  expect:o=>o.kind!=='LOOP'&&!((o.visits||{}).Q010>1)},
 // E-07 — re-acquired citizenship routed to first CRDS via Q011 must be asked about the citizenship certificate.
 {id:'E07_reacquired_via_q011_asks_certificate',failsOnPR15:true,country:'ES',documents:['BIRTH_CERT'],
  answers:{citizenship:'REACQUIRED',goal:'EXISTING_CRDS_PROBLEM',ever_crds:'NO',crds_clarify:'LOCAL_RESIDENCE',identity_detail:'HAS_PHOTO_DOC'},
  expect:o=>o.seen.includes('Q106')||noPay(o)},
 // E-08 — "aproape de expirare" is still valid.
 {id:'E08_d1_expiring_crds_is_not_a_blocker',failsOnPR15:true,country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRING'},
  answers:{goal:'KEEP_FOREIGN_DOMICILE',passport_domicile:'CURRENT'},
  expect:o=>o.kind==='PAYWALL'&&!o.blockers.some(b=>/nu este în starea necesară/.test(b))},
 {id:'E08_expiring_passport_counts_for_identity',failsOnPR15:true,country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'EXPIRING'},
  answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',passport_domicile:'ROMANIA'},
  expect:o=>!o.seen.includes('Q060')&&o.status==='GREEN'},
 // E-09 — checkout blocked when the client lacks a required document and the guide offers no concrete remedy.
 {id:'E09_b1_without_foreign_proof_no_checkout',failsOnPR15:true,country:'FR',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},
  answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',passport_domicile:'ROMANIA',ever_crds:'NO',foreign_proof:'NO'},expect:noPay},
 {id:'E09_b1_birth_certificate_missing_no_checkout',failsOnPR15:true,country:'DE',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},
  answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO',birth_cert:'MISSING'},expect:noPay},
 {id:'E09_b1_citizenship_certificate_missing_no_checkout',failsOnPR15:true,country:'IT',documents:['BIRTH_CERT'],
  answers:{citizenship:'REACQUIRED',goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO',post_citizenship_romanian_id:'NO',citizenship_cert_available:'NO',identity_detail:'NO_PHOTO_DOC'},expect:noPay},
 {id:'E09_a2_proxy_without_representative_no_checkout',failsOnPR15:true,country:'IT',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'EXPIRED'},
  answers:{goal:'ID_PROBLEM',ever_crds:'NO',can_come:'NO',representative:'NO'},expect:noPay},
 {id:'E09_a2_proxy_without_power_of_attorney_no_checkout',failsOnPR15:true,country:'IT',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'EXPIRED'},
  answers:{goal:'ID_PROBLEM',ever_crds:'NO',can_come:'NO',representative:'YES',poa:'NO'},expect:noPay},
 {id:'E09_d1_with_expired_crds_no_checkout',failsOnPR15:true,country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},
  answers:{goal:'KEEP_FOREIGN_DOMICILE',passport_domicile:'CURRENT'},expect:noPay},
 {id:'E09_d1_without_residence_in_romania_no_checkout',failsOnPR15:true,country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},
  answers:{goal:'KEEP_FOREIGN_DOMICILE',passport_domicile:'CURRENT',ro_residence:'NONE'},expect:noPay},
 {id:'E09_host_refuses_consent_no_checkout',failsOnPR15:true,country:'ES',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},
  answers:{goal:'MOVE_DOMICILE_TO_RO',passport_domicile:'CURRENT',ro_address:'HOST',host_consent:'NO'},expect:noPay},
 {id:'E09_b5_without_current_residence_proof_no_checkout',failsOnPR15:true,country:'DE',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},
  answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT',same_country:'YES',current_foreign_proof:'NO'},expect:noPay},
 // E-10 — "Altă situație" + "Nu" must not be told it has a relevant document.
 {id:'E10_no_document_message',failsOnPR15:true,country:'FR',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},
  answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO',foreign_basis:'OTHER',foreign_document_generic:'NO'},
  expect:o=>!(o.allUnknowns||[]).some(u=>u.startsWith('Ai un document relevant'))},
 // E-11 — the travel-title identity note is information, not a blocker shown before payment.
 {id:'E11_travel_note_not_a_blocker',failsOnPR15:true,country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'LOST'},
  answers:{goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'ROMANIA'},expect:o=>o.kind==='PAYWALL'&&o.status==='GREEN'},
 // E-12 — moved country without proof: explanation, not "ghid în verificare".
 {id:'E12_moved_without_proof_is_explained',failsOnPR15:true,country:'BE',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},
  answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'OTHER',same_country:'NO',foreign_proof:'NO'},
  expect:o=>o.kind!=='PENDING'&&noPay(o)},
 // Controls that must keep working after the fixes.
 {id:'CTRL_b1_fr_green',country:'FR',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},
  answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO'},expect:o=>o.kind==='PAYWALL'&&o.key==='B1_FR'&&o.status==='GREEN'},
 {id:'CTRL_b5_renewal_it_green',country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},
  answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT',same_country:'YES'},expect:o=>o.kind==='PAYWALL'&&o.key==='B5_RENEWAL_IT'},
 {id:'CTRL_minor_stops',country:'IT',documents:['ROMANIAN_ID'],answers:{age:'NO',goal:'ID_PROBLEM'},expect:o=>o.kind==='STOP'},
 {id:'CTRL_other_country_stops',country:'OTHER',documents:['ROMANIAN_ID'],answers:{goal:'ID_PROBLEM'},expect:o=>o.kind==='STOP'},
];

for(const c of CASES){
  test(c.id+(c.failsOnPR15?' [audit: failed on PR #15]':''),()=>{
    const o=run(c);
    assert.ok(c.expect(o),`${c.id}: got ${o.kind} route=${o.route} key=${o.key} status=${o.status} codes=${JSON.stringify(o.codes||[])} path=${(o.seen||[]).join('>')}`);
  });
}
