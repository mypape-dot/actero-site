// T-03 (16 Oct 2026): builds server-eligibility-cases.json from synthetic journeys through the real questionnaire.
// Usage: node cloudflare/tests/fixtures/build-server-eligibility-cases.mjs cloudflare/tests/fixtures/server-eligibility-cases.json
import {run,evaluate} from '../helpers/engine-harness.mjs';
import {writeFileSync} from 'node:fs';
const C=['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH'];
const B1={goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO'};
const journeys=[];
for(const c of C){
  journeys.push(['clean:B1_'+c,{country:c,documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1}}]);
  journeys.push(['clean:B5_RENEWAL_'+c,{country:c,documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT'}}]);
  journeys.push(['clean:B5_LOST_'+c,{country:c,documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'LOST'},answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT'}}]);
}
const B5={goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT'};
journeys.push(['clean:B5_STOLEN',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'STOLEN'},answers:{...B5}}]);
journeys.push(['clean:B5_DAMAGED',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'DAMAGED'},answers:{...B5}}]);
journeys.push(['clean:B5_DATA_CHANGE',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},answers:{...B5,b5case:'DATA_CHANGE'}}]);
journeys.push(['clean:B5_MOVED',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},answers:{...B5,passport_domicile:'OTHER'}}]);
journeys.push(['clean:A1_PERSONAL_ROMANIA',{country:'IT',documents:['ROMANIAN_ID','PASSPORT'],statuses:{ROMANIAN_ID:'EXPIRED',PASSPORT:'VALID'},answers:{goal:'ID_PROBLEM',passport_domicile:'ROMANIA',can_come:'YES'}}]);
journeys.push(['clean:A2_PROXY',{country:'IT',documents:['ROMANIAN_ID','PASSPORT'],statuses:{ROMANIAN_ID:'EXPIRED',PASSPORT:'VALID'},answers:{goal:'ID_PROBLEM',passport_domicile:'ROMANIA',can_come:'NO'}}]);
journeys.push(['blocked:A3_FIRST_ID_CONSULAR',{country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},answers:{goal:'ID_PROBLEM',passport_domicile:'ROMANIA',can_come:'NO'}}]);
journeys.push(['clean:C1_CEI_ROMANIA',{country:'IT',documents:['ROMANIAN_ID','PASSPORT'],statuses:{ROMANIAN_ID:'EXPIRED',PASSPORT:'VALID'},answers:{goal:'CEI',passport_domicile:'ROMANIA',physical:'YES'}}]);
journeys.push(['clean:C5_CEI_REPLACEMENT',{country:'IT',documents:['CEI','PASSPORT'],statuses:{CEI:'EXPIRED',PASSPORT:'VALID'},answers:{goal:'CEI',passport_domicile:'ROMANIA',physical:'YES'}}]);
journeys.push(['clean:D1_TEMPORARY',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},answers:{goal:'KEEP_FOREIGN_DOMICILE',passport_domicile:'CURRENT'}}]);
journeys.push(['clean:D2_PERMANENT_RETURN',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},answers:{goal:'MOVE_DOMICILE_TO_RO',passport_domicile:'CURRENT'}}]);
journeys.push(['clean:TRAVEL_TITLE_RETURN_RO',{country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'LOST'},answers:{goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'ROMANIA'}}]);
journeys.push(['clean:URGENT_OTHER_COUNTRY',{country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'LOST'},answers:{goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'OTHER',travel_urgent_basis:'OBJECTIVE_URGENT',ever_crds:'NO'}}]);
journeys.push(['clean:B5_RENEWAL_FR_alternative_proof',{country:'FR',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT',current_foreign_proof:'NO'}}]);
// blocked journeys, one per family of reasons
journeys.push(['blocked:no_foreign_proof',{country:'FR',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,foreign_proof:'NO'}}]);
journeys.push(['blocked:local_proof_NL_BRP',{country:'NL',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,local_proof_type:'BRP'}}]);
journeys.push(['blocked:urgent_from_romania',{country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'LOST'},answers:{goal:'URGENT_TRAVEL',physical:'YES',travel_dest:'OTHER',travel_urgent_basis:'OBJECTIVE_URGENT',ever_crds:'NO'}}]);
journeys.push(['blocked:d1_expired_crds',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},answers:{goal:'KEEP_FOREIGN_DOMICILE',passport_domicile:'CURRENT'}}]);
const canon=o=>({route:o.S.route,answers:JSON.parse(JSON.stringify(o.S.answers)),docs:JSON.parse(JSON.stringify(o.S.docs))});
const cases=[];
for(const [id,j] of journeys){
  const o=run(j);
  if(!['PAYWALL','NOPAY'].includes(o.kind))throw new Error(id+' ended '+o.kind+' '+o.seen.join('>'));
  const cs=canon(o),d=evaluate(cs).decision;
  cases.push({id,source:'journey',case_state:cs,expected:{allowed:d.allowed,route:cs.route,guide_key:d.key,legalBasisConfirmed:d.legalBasisConfirmed,
    refuse_reason:d.allowed?(d.legalBasisConfirmed===false?'legal_basis_unconfirmed':null):'not_eligible'}});
}
// Forged or stale inputs: what a modified browser could send. The server must recompute and refuse.
const base={age:'YES',citizenship:'YES',residence_country:'IT',residence_country_name:'Italia',civil_change:'NO'};
const forged=[
 ['forged:A2_with_passport_only','A2_PROXY',{...base,goal:'ID_PROBLEM',documents:['PASSPORT'],passport_domicile:'ROMANIA',can_come:'NO',representative:'YES',poa:'YES',ro_address:'OWN'},{PASSPORT:'VALID'},'A3_FIRST_ID_CONSULAR is the derived route; a first identity card is never sold'],
 ['forged:travel_title_while_in_romania','TRAVEL_TITLE_RETURN_RO',{...base,goal:'URGENT_TRAVEL',documents:['PASSPORT'],physical:'YES',travel_dest:'ROMANIA'},{PASSPORT:'LOST'},'the questionnaire stops at STOP_TRAVEL_ALREADY_RO'],
 ['forged:D1_without_foreign_domicile','D1_TEMPORARY',{...base,goal:'KEEP_FOREIGN_DOMICILE',documents:['BIRTH_CERT'],ever_crds:'NO',d1_crds:'VALID',ro_residence:'OWN',ro_residence_proof:'YES'},{},'domicile is Romania; KEEP_FOREIGN_DOMICILE stops'],
 ['forged:C1_with_domicile_abroad','C1_CEI_ROMANIA',{...base,goal:'CEI',documents:['ROMANIAN_ID','CRDS_PASSPORT'],passport_domicile:'CURRENT',physical:'YES',ro_address:'OWN'},{ROMANIAN_ID:'EXPIRED',CRDS_PASSPORT:'VALID'},'C3_CEI_NO_RO_DOMICILE is the derived route (not operational)'],
 ['forged:minor_on_A1','A1_PERSONAL_ROMANIA',{...base,age:'NO',goal:'ID_PROBLEM',documents:['ROMANIAN_ID','PASSPORT'],passport_domicile:'ROMANIA',can_come:'YES',ro_address:'OWN'},{ROMANIAN_ID:'EXPIRED',PASSPORT:'VALID'},'STOP_MINOR'],
 ['forged:noncitizen_on_A1','A1_PERSONAL_ROMANIA',{...base,citizenship:'NO',goal:'ID_PROBLEM',documents:['ROMANIAN_ID','PASSPORT'],passport_domicile:'ROMANIA',can_come:'YES',ro_address:'OWN'},{ROMANIAN_ID:'EXPIRED',PASSPORT:'VALID'},'STOP_NONCITIZEN'],
 ['forged:unsupported_country_on_A1','A1_PERSONAL_ROMANIA',{...base,residence_country:'OTHER',goal:'ID_PROBLEM',documents:['ROMANIAN_ID','PASSPORT'],passport_domicile:'ROMANIA',can_come:'YES',ro_address:'OWN'},{ROMANIAN_ID:'EXPIRED',PASSPORT:'VALID'},'unsupported country stops'],
];
for(const [id,route,answers,docs,why] of forged){
  const cs={route,answers,docs},d=evaluate(cs).decision;
  cases.push({id,source:'forged',case_state:cs,why,client_decision_today:{allowed:d.allowed,guide_key:d.key},expected:{allowed:false,refuse_reason:'route_not_derivable'}});
}
// Request fields the server must ignore: a guide_key, status and blockers chosen by the browser.
cases.push({id:'forged:guide_key_other_country',source:'forged_request',case_state:cases.find(c=>c.id==='clean:B1_IT').case_state,
  request:{route:'B1_FIRST_CRDS',guide_key:'B1_FR'},expected:{allowed:false,refuse_reason:'case_route_changed',derived_guide_key:'B1_IT'}});
cases.push({id:'forged:status_and_blockers_cleared',source:'forged_request',case_state:{...cases.find(c=>c.id==='blocked:no_foreign_proof').case_state,status:'GREEN',blockers:[],unknowns:[]},
  expected:{allowed:false,refuse_reason:'not_eligible'}});
// Stale sessions (T-02) and unchecked unknown status (T-01): the client decision already refuses them.
const stale=[
 ['stale:B1_crds_history_missing',{route:'B1_FIRST_CRDS',docs:{CRDS_PASSPORT:'EXPIRED',PASSPORT:'VALID'},answers:{...base,goal:'ESTABLISH_FOREIGN_DOMICILE',documents:['CRDS_PASSPORT','PASSPORT'],passport_domicile:'ROMANIA',foreign_basis:'RESIDENCE',foreign_proof:'YES',birth_cert:'READY'}}],
 ['stale:B1_reacquired_without_Q106',{route:'B1_FIRST_CRDS',docs:{},answers:{...base,citizenship:'REACQUIRED',goal:'ESTABLISH_FOREIGN_DOMICILE',documents:['BIRTH_CERT'],ever_crds:'NO',foreign_basis:'RESIDENCE',foreign_proof:'YES',birth_cert:'READY',identity_detail:'HAS_PHOTO_DOC'}}],
 ['stale:B5_never_crds_without_Q013',{route:'B5_EXISTING_CRDS',docs:{},answers:{...base,goal:'EXISTING_CRDS_PROBLEM',documents:['BIRTH_CERT'],ever_crds:'NO',crds_clarify:'CRDS',b5case:'RENEWAL',same_country:'YES',current_foreign_proof:'YES',identity_detail:'HAS_PHOTO_DOC'}}],
 ['unknown:urgent_passport_status_unchecked',{route:'TRAVEL_TITLE_RETURN_RO',docs:{PASSPORT:'UNKNOWN'},answers:{...base,goal:'URGENT_TRAVEL',documents:['PASSPORT'],physical:'NO',travel_dest:'ROMANIA'}}],
];
for(const [id,cs] of stale){const d=evaluate(cs).decision;cases.push({id,source:'stale_or_unknown',case_state:cs,expected:{allowed:false,refuse_reason:'not_eligible'},client_decision_today:{allowed:d.allowed}})}
writeFileSync(process.argv[2],JSON.stringify({schema_version:1,generated:'2026-10-16',questionnaire_version:'2026-10-16',
  note:'Synthetic case states only. expected = what the SERVER must decide after recomputing route, guide key and eligibility from case_state.answers and case_state.docs. client_decision_today records the browser decision on this branch, for comparison.',cases},null,1)+'\n');
console.log(cases.length,'cases');
for(const c of cases)console.log(c.id.padEnd(46),JSON.stringify(c.expected),c.client_decision_today?JSON.stringify(c.client_decision_today):'');
