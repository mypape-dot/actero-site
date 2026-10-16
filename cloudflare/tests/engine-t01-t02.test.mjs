// T-01 and T-02 (report of 16 Oct 2026, evening), regression tests.
// T-01: at urgent travel, a document status answered "Nu știu" blocks payment and is checked once (Q035)
//       when its validity could still change the outcome; it is ignored when the outcome is already decided.
// T-02: a session saved by an older questionnaire, or resumed at the result, is completed with the answers
//       newer questions made mandatory (Q012, Q013, Q106) before any payment; its other answers are kept.
// Synthetic answers only; no premium guide code, no D1 export, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {run,evaluate,loadEngine,DEFAULTS} from './helpers/engine-harness.mjs';

const TO_RO={goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'ROMANIA'};
const TO_OTHER={goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'OTHER',travel_urgent_basis:'OBJECTIVE_URGENT',ever_crds:'NO'};
const noUnknownStatus=o=>!(o.allUnknowns||[]).some(u=>u.includes('mai este valabil'));

// ---------------- T-01 ----------------
test('T-01: a passport status "Nu știu" is checked once before the travel title is offered',()=>{
  const base={country:'DE',documents:['PASSPORT'],statuses:{PASSPORT:'UNKNOWN'}};
  const valid=run({...base,answers:{...TO_RO,doc_recheck_PASSPORT:'VALID'}});
  assert.equal(valid.visits.Q035,1,valid.seen.join('>'));
  assert.equal(valid.kind,'NOPAY');assert.deepEqual(valid.codes,['PASSPORT_STILL_VALID']);
  const expiring=run({...base,answers:{...TO_RO,doc_recheck_PASSPORT:'EXPIRING'}});
  assert.equal(expiring.kind,'NOPAY');assert.deepEqual(expiring.codes,['PASSPORT_STILL_VALID']);
  for(const v of ['EXPIRED','LOST']){
    const o=run({...base,answers:{...TO_RO,doc_recheck_PASSPORT:v}});
    assert.equal(o.kind,'PAYWALL',v);assert.equal(o.key,'TRAVEL_TITLE_RETURN_RO');assert.equal(o.decision.allowed,true);
  }
  const still=run({...base,answers:{...TO_RO,doc_recheck_PASSPORT:'UNKNOWN'}});
  assert.notEqual(still.kind,'PAYWALL');assert.equal(still.visits.Q035,1,'asked once, not in a loop');
  assert.ok(still.unknowns.some(u=>u.includes('pașaportul mai este valabil')),JSON.stringify(still.unknowns));
});

test('T-01: the same check applies to the temporary passport and to a CRDS passport',()=>{
  const o=run({country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'UNKNOWN'},answers:{...TO_OTHER,ever_crds:'YES',doc_recheck_CRDS_PASSPORT:'EXPIRED'}});
  assert.equal(o.visits.Q035,1,o.seen.join('>'));
  assert.equal(o.kind,'PAYWALL');assert.equal(o.key,'URGENT_OTHER_COUNTRY');
  const v=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'UNKNOWN'},answers:{...TO_OTHER,doc_recheck_PASSPORT:'VALID'}});
  assert.equal(v.kind,'NOPAY');assert.deepEqual(v.codes,['PASSPORT_EXPIRING_OTHER_DEST']);
});

test('T-01: the payment decision itself refuses an urgent case with an unchecked "Nu știu" status',()=>{
  const {decision}=evaluate({route:'TRAVEL_TITLE_RETURN_RO',docs:{PASSPORT:'UNKNOWN'},
    answers:{residence_country:'DE',documents:['PASSPORT'],physical:'NO',travel_dest:'ROMANIA',civil_change:'NO'}});
  assert.equal(decision.allowed,false);
  assert.ok(decision.unknowns.some(u=>u.includes('mai este valabil')));
});

test('T-01 relevance: from Romania the status is not asked, the outcome is already decided',()=>{
  const o=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'UNKNOWN'},answers:{...TO_OTHER,physical:'YES'}});
  assert.ok(!o.seen.includes('Q035'),o.seen.join('>'));
  assert.equal(o.kind,'NOPAY');assert.deepEqual(o.codes,['TEMP_PASSPORT_FROM_ROMANIA']);
  assert.ok(noUnknownStatus(o),JSON.stringify(o.allUnknowns));
});

test('T-01 relevance: a tourism-only trip goes to its own screen without document or card questions',()=>{
  const o=run({country:'NL',documents:['PASSPORT','ROMANIAN_ID'],statuses:{PASSPORT:'UNKNOWN',ROMANIAN_ID:'VALID'},
    answers:{...TO_OTHER,travel_urgent_basis:'TOURISM',id_card_type:'UNKNOWN'}});
  assert.ok(!o.seen.some(x=>['Q033','Q034','Q035'].includes(x)),o.seen.join('>'));
  assert.equal(o.kind,'TOURISM',o.kind);
  assert.ok(!o.html.includes('O condiție nu este îndeplinită'));
});

test('T-01 relevance: a valid travel card already settles the case, the passport status is not asked',()=>{
  const o=run({country:'FR',documents:['PASSPORT','CEI'],statuses:{PASSPORT:'UNKNOWN',CEI:'VALID'},answers:{...TO_RO,id_card_area:'YES'}});
  assert.ok(!o.seen.includes('Q035'),o.seen.join('>'));
  assert.equal(o.kind,'NOPAY');assert.deepEqual(o.codes,['ID_CARD_IS_TRAVEL_DOC']);
});

test('T-01 relevance: an identity card with status "Nu știu" matters only if it could be used on this trip',()=>{
  const card={country:'ES',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'UNKNOWN'}};
  for(const id_card_type of ['CIS','CIP']){
    const o=run({...card,answers:{...TO_RO,id_card_type}});
    assert.equal(o.visits.Q033,1);assert.ok(!o.seen.includes('Q034')&&!o.seen.includes('Q035'),o.seen.join('>'));
    assert.equal(o.kind,'PAYWALL',id_card_type);assert.ok(noUnknownStatus(o));
  }
  const outside=run({...card,answers:{...TO_RO,id_card_type:'OLD_MODEL',id_card_area:'NO'}});
  assert.ok(!outside.seen.includes('Q035'),outside.seen.join('>'));assert.equal(outside.kind,'PAYWALL');
  const inside=run({...card,answers:{...TO_RO,id_card_type:'OLD_MODEL',id_card_area:'YES',doc_recheck_ROMANIAN_ID:'VALID'}});
  assert.equal(inside.visits.Q035,1,inside.seen.join('>'));
  assert.equal(inside.kind,'NOPAY');assert.deepEqual(inside.codes,['ID_CARD_IS_TRAVEL_DOC']);
  const expired=run({...card,answers:{...TO_RO,id_card_type:'OLD_MODEL',id_card_area:'YES',doc_recheck_ROMANIAN_ID:'EXPIRED'}});
  assert.equal(expired.kind,'PAYWALL');
  const unsure=run({...card,answers:{...TO_RO,id_card_type:'OLD_MODEL',id_card_area:'YES',doc_recheck_ROMANIAN_ID:'UNKNOWN'}});
  assert.notEqual(unsure.kind,'PAYWALL');assert.equal(unsure.visits.Q035,1);
});

test('T-01: a CEI with status "Nu știu" inside the EU, EEA or Switzerland is checked before any sale',()=>{
  const base={country:'BE',documents:['CEI'],statuses:{CEI:'UNKNOWN'}};
  const lost=run({...base,answers:{...TO_OTHER,id_card_area:'YES',doc_recheck_CEI:'LOST'}});
  assert.equal(lost.visits.Q034,1);assert.equal(lost.visits.Q035,1,lost.seen.join('>'));
  assert.equal(lost.kind,'PAYWALL');assert.equal(lost.key,'URGENT_OTHER_COUNTRY');
  const valid=run({...base,answers:{...TO_OTHER,id_card_area:'YES',doc_recheck_CEI:'VALID'}});
  assert.equal(valid.kind,'NOPAY');assert.deepEqual(valid.codes,['ID_CARD_IS_TRAVEL_DOC_OTHER']);
  const outside=run({...base,answers:{...TO_OTHER,id_card_area:'NO'}});
  assert.ok(!outside.seen.includes('Q035'));assert.equal(outside.kind,'PAYWALL');
});

test('T-01: statuses that are known keep their previous behaviour (no extra question)',()=>{
  for(const [st,kind] of [['LOST','PAYWALL'],['EXPIRED','PAYWALL'],['MISSING','PAYWALL'],['EXPIRING','NOPAY']]){
    const o=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:st},answers:{...TO_RO}});
    assert.ok(!o.seen.includes('Q035'),st);assert.equal(o.kind,kind,st);
  }
});

// ---------------- T-02 ----------------
function restoreFrom(saved,{viaUrl=false}={}){
  const eng=loadEngine({realPersistence:true});
  const id=viaUrl?'AR-test-url':'AR-test-active';
  eng.store.set('actero_case_'+id,JSON.stringify({caseId:id,status:'GREEN',blockers:[],unknowns:[],clarified:{},history:[],
    docQueue:[],docIndex:0,autoSkip:false,skipTarget:null,current:'RESULT',...saved}));
  if(viaUrl){eng.ctx.window.location.search='?case_id='+id;vm.runInContext('restoreCaseFromUrl()',eng.ctx)}
  else{eng.store.set('actero_active_case',id);vm.runInContext('restoreActiveCase()',eng.ctx)}
  return eng;
}
// Continues the questionnaire from the current screen with synthetic answers (same rules as run()).
function finish(eng,answers){
  const S=vm.runInContext('S',eng.ctx),H=()=>vm.runInContext('__H',eng.ctx),seen=[];
  const all={...DEFAULTS,...answers};
  for(let i=0;i<40;i++){
    const cur=S.current;
    if(cur==='RESULT'||cur.startsWith('STOP_'))return {cur,seen,html:eng.$el('screen').innerHTML,S,renderId:H().renderId};
    seen.push(cur);
    const spec=H().spec;assert.ok(spec,'no question at '+cur);
    const v=all[spec.key];assert.notEqual(v,undefined,'no answer for '+spec.key+' at '+cur);
    H().opt(v,{classList:{add(){}}});
  }
  assert.fail('too long: '+seen.join('>'));
}
const B1_OLD={route:'B1_FIRST_CRDS',docs:{CRDS_PASSPORT:'EXPIRED',PASSPORT:'VALID'},answers:{age:'YES',citizenship:'YES',residence_country:'IT',
  residence_country_name:'Italia',goal:'ESTABLISH_FOREIGN_DOMICILE',documents:['CRDS_PASSPORT','PASSPORT'],passport_domicile:'ROMANIA',
  foreign_basis:'RESIDENCE',foreign_proof:'YES',birth_cert:'READY',civil_change:'NO'}};

test('T-02: an old session at the result with a CRDS passport and the latest passport in Romania resumes at Q012, not at the paywall',()=>{
  for(const viaUrl of [false,true]){
    const eng=restoreFrom(B1_OLD,{viaUrl});
    const S=vm.runInContext('S',eng.ctx);
    assert.equal(S.current,'Q012',(viaUrl?'url':'active')+' restore');
    assert.ok(!eng.$el('screen').innerHTML.includes('id="unlockResult"'));
    assert.equal(S.answers.residence_country,'IT','answers are kept');assert.equal(S.answers.foreign_proof,'YES');
    const end=finish(eng,{crds_history:'RETURNED'});
    assert.equal(end.renderId,'STOP_CRDS_RETURNED');
  }
});

test('T-02: the same old session is refused by the payment decision itself',()=>{
  const {decision}=evaluate(B1_OLD);
  assert.equal(decision.allowed,false);
  assert.ok(decision.unknowns.some(u=>u.includes('domiciliul tău din străinătate')),JSON.stringify(decision.unknowns));
});

test('T-02: re-acquired citizenship saved before Q106 is asked about documents after citizenship, keeping the rest',()=>{
  const saved={route:'B1_FIRST_CRDS',docs:{},answers:{age:'YES',citizenship:'REACQUIRED',residence_country:'ES',residence_country_name:'Spania',
    goal:'EXISTING_CRDS_PROBLEM',documents:['BIRTH_CERT'],ever_crds:'NO',crds_clarify:'LOCAL_RESIDENCE',foreign_basis:'RESIDENCE',
    foreign_proof:'YES',birth_cert:'READY',civil_change:'NO',identity_detail:'HAS_PHOTO_DOC'}};
  assert.equal(evaluate(saved).decision.allowed,false);
  const eng=restoreFrom(saved);
  assert.equal(vm.runInContext('S.current',eng.ctx),'Q106');
  const end=finish(eng,{post_citizenship_romanian_id:'NO',citizenship_cert_available:'NO'});
  assert.equal(end.cur,'RESULT');
  assert.ok(end.html.includes('data-code="CITIZENSHIP_CERT_MISSING"'),'explained without payment');
  assert.ok(!end.seen.includes('Q101')&&!end.seen.includes('Q103'),'answered questions are not asked again: '+end.seen.join('>'));
  const ok=restoreFrom(saved);
  const paid=finish(ok,{post_citizenship_romanian_id:'YES'});
  assert.ok(paid.html.includes('id="unlockResult"'),'with the answer completed, the clean case reaches the paywall');
});

test('T-02: an existing-CRDS session saved with "never had a foreign domicile" is confirmed at Q013',()=>{
  const saved={route:'B5_EXISTING_CRDS',docs:{},answers:{age:'YES',citizenship:'YES',residence_country:'ES',residence_country_name:'Spania',
    goal:'EXISTING_CRDS_PROBLEM',documents:['BIRTH_CERT'],ever_crds:'NO',crds_clarify:'CRDS',b5case:'RENEWAL',same_country:'YES',
    current_foreign_proof:'YES',civil_change:'NO',identity_detail:'HAS_PHOTO_DOC'}};
  assert.equal(evaluate(saved).decision.allowed,false);
  const eng=restoreFrom(saved);
  assert.equal(vm.runInContext('S.current',eng.ctx),'Q013');
  const end=finish(eng,{crds_confirm:'HAD_CRDS'});
  assert.equal(end.cur,'RESULT');assert.equal(end.S.answers.ever_crds,'YES');
  assert.ok(end.html.includes('id="unlockResult"'),'confirmed, the clean renewal is payable again');
});

test('T-02: complete sessions are not disturbed, whatever their version',()=>{
  const clean={route:'B1_FIRST_CRDS',docs:{ROMANIAN_ID:'VALID'},answers:{age:'YES',citizenship:'YES',residence_country:'IT',residence_country_name:'Italia',
    goal:'ESTABLISH_FOREIGN_DOMICILE',documents:['ROMANIAN_ID'],ever_crds:'NO',foreign_basis:'RESIDENCE',foreign_proof:'YES',birth_cert:'READY',civil_change:'NO'}};
  for(const questionnaireVersion of [undefined,vm.runInContext('QUESTIONNAIRE_VERSION',loadEngine().ctx)]){
    const eng=restoreFrom({...clean,questionnaireVersion});
    assert.equal(vm.runInContext('S.current',eng.ctx),'RESULT');
    assert.ok(eng.$el('screen').innerHTML.includes('id="unlockResult"'),String(questionnaireVersion));
  }
});

test('T-02: an old session saved mid-questionnaire resumes at the missing question, a current one where it stopped',()=>{
  const mid={...B1_OLD,current:'Q103',answers:{...B1_OLD.answers,birth_cert:undefined}};
  const old=restoreFrom(mid);
  assert.equal(vm.runInContext('S.current',old.ctx),'Q012');
  const current=restoreFrom({...mid,answers:{...mid.answers,crds_history:'NEVER'},questionnaireVersion:vm.runInContext('QUESTIONNAIRE_VERSION',old.ctx)});
  assert.equal(vm.runInContext('S.current',current.ctx),'Q103','a current session is never moved');
});

test('T-02: every save records the questionnaire version',()=>{
  const eng=restoreFrom(B1_OLD);
  finish(eng,{crds_history:'RETURNED'});
  const saved=JSON.parse(eng.store.get('actero_case_AR-test-active'));
  assert.equal(saved.questionnaireVersion,vm.runInContext('QUESTIONNAIRE_VERSION',eng.ctx));
});
