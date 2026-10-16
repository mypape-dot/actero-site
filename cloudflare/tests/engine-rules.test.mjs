// ActeRO engine rules (16 Oct 2026): validity, derivations, contradictions, payment gates.
// Drives the REAL questionnaire from index.html with synthetic answers (see helpers/engine-harness.mjs).
// No premium guide code, no D1 export, no network. Run: node --test cloudflare/tests/engine-rules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {run,loadEngine,evaluate} from './helpers/engine-harness.mjs';

// ---------- (a) one validity model ----------
test('docState: "aproape de expirare" is valid; expired, lost, stolen, damaged and missing are not',()=>{
  const {ctx}=loadEngine();
  const m=JSON.parse(vm.runInContext("JSON.stringify(['VALID','EXPIRING','EXPIRED','LOST','STOLEN','DAMAGED','MISSING','UNKNOWN',undefined].map(docState))",ctx));
  assert.deepEqual(m,['VALID','VALID','INVALID','INVALID','INVALID','INVALID','INVALID','UNKNOWN','UNKNOWN']);
});

test('M-07: an expiring passport establishes identity without the old-document question',()=>{
  const o=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'EXPIRING'},
    answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',passport_domicile:'ROMANIA'}});
  assert.ok(!o.seen.includes('Q060'),o.seen.join('>'));
  assert.equal(o.status,'GREEN');
});

test('M-07: an expiring CRDS passport counts as valid for the temporary identity card',()=>{
  const o=run({country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRING'},
    answers:{goal:'KEEP_FOREIGN_DOMICILE',passport_domicile:'CURRENT'}});
  assert.equal(o.S.answers.d1_crds,'VALID');
  assert.ok(!o.blockers.some(b=>/nu este în starea necesară/.test(b)),JSON.stringify(o.blockers));
});

test('R14: keeping the foreign domicile does not ask again for a passport status already declared',()=>{
  const o=run({country:'ES',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},
    answers:{goal:'ID_PROBLEM',passport_domicile:'CURRENT',domicile_intent:'KEEP'}});
  assert.ok(o.seen.includes('Q401'),o.seen.join('>'));
  assert.ok(!o.seen.includes('Q410'),o.seen.join('>'));
  assert.equal(o.route,'D1_TEMPORARY');
});

// ---------- (b) derivations instead of questions ----------
test('M-02: a passport showing another country is a move, whatever the same-country answer would be',()=>{
  const o=run({country:'FR',documents:['PASSPORT'],statuses:{PASSPORT:'EXPIRED'},
    answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'OTHER',same_country:'YES'}});
  assert.ok(!o.seen.includes('Q121'),o.seen.join('>'));
  assert.equal(o.S.answers.same_country,'NO');
  assert.equal(o.key,'B5_MOVED');
});

test('M-02: a passport showing the current country keeps the same-country guide and skips Q121',()=>{
  const o=run({country:'FR',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},
    answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT',same_country:'NO'}});
  assert.ok(!o.seen.includes('Q121'),o.seen.join('>'));
  assert.equal(o.key,'B5_RENEWAL_FR');
});

test('M-11: a passport declared valid cannot be reported lost or stolen at Q120',()=>{
  for(const b5case of ['LOST','STOLEN']){
    const o=run({country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},
      answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT',b5case}});
    assert.equal(o.kind,'OPTION_MISSING',b5case+' must not be offered: '+o.kind);
    assert.equal(o.at,'Q120');
    assert.ok(o.options.includes('DATA_CHANGE')&&o.options.includes('DAMAGED'));
  }
});

test('M-11: "Locuiesc acum în altă țară" is not offered when the passport shows the current country',()=>{
  const o=run({country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},
    answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT',b5case:'COUNTRY_CHANGE'}});
  assert.equal(o.kind,'OPTION_MISSING');
  assert.ok(!o.options.includes('COUNTRY_CHANGE'));
});

test('M-14: "Am răspuns greșit" without a declared passport goes back to Q008, not to the passport question',()=>{
  const o=run({country:'ES',documents:['BIRTH_CERT'],
    answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:['YES','NO'],goal_conflict:'WRONG',identity_detail:'HAS_PHOTO_DOC'}});
  assert.ok(o.seen.includes('Q010'),o.seen.join('>'));
  assert.ok(!o.seen.includes('Q007'),o.seen.join('>'));
  assert.equal(o.seen.filter(x=>x==='Q008').length,2);
  assert.equal(o.route,'B1_FIRST_CRDS');
});

test('R15: without a Swiss document the permit type is not asked',()=>{
  const o=run({country:'CH',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},
    answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',passport_domicile:'ROMANIA',foreign_proof:'NO'}});
  assert.ok(!o.seen.includes('Q109'),o.seen.join('>'));
  assert.ok(!o.allUnknowns.some(u=>/documentului elvețian/.test(u)),JSON.stringify(o.allUnknowns));
});

// ---------- (c) contradictions stop without payment and without loops ----------
test('M-03: the latest passport shows Romania, so no existing-CRDS guide is offered',()=>{
  const base={country:'FR',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'ROMANIA'}};
  const returned=run({...base,answers:{...base.answers,crds_history:'RETURNED'}});
  assert.equal(returned.kind,'STOP');assert.equal(returned.stopId,'STOP_CRDS_RETURNED');
  assert.ok(returned.seen.includes('Q012')&&!returned.seen.includes('Q011'),returned.seen.join('>'));
  const never=run({...base,answers:{...base.answers,crds_history:'NEVER'}});
  assert.equal(never.route,'B1_FIRST_CRDS');assert.equal(never.key,'B1_FR');
  const wrong=run({...base,answers:{...base.answers,crds_history:'WRONG',passport_domicile:['ROMANIA','CURRENT'],b5case:'DATA_CHANGE'}});
  assert.equal(wrong.seen.filter(x=>x==='Q007').length,2,wrong.seen.join('>'));
  assert.equal(wrong.route,'B5_EXISTING_CRDS');
});

test('M-03: with a CRDS passport declared, Q012 does not offer "never had a foreign domicile"',()=>{
  const o=run({country:'FR',documents:['CRDS_PASSPORT','PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED',PASSPORT:'VALID'},
    answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'ROMANIA',crds_history:'NEVER'}});
  assert.equal(o.kind,'OPTION_MISSING');assert.equal(o.at,'Q012');
  assert.deepEqual([...o.options],['RETURNED','WRONG','UNKNOWN']);
});

test('decision 2: a CRDS passport plus a latest passport with domicile in Romania stops before B1 payment',()=>{
  const o=run({country:'DE',documents:['CRDS_PASSPORT','PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED',PASSPORT:'VALID'},
    answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',passport_domicile:'ROMANIA',crds_history:'RETURNED'}});
  assert.equal(o.kind,'STOP');assert.equal(o.stopId,'STOP_CRDS_RETURNED');
  assert.equal(o.route,null);
});

test('M-11: "never had a foreign domicile" followed by "I have a CRDS passport" is clarified at Q013',()=>{
  const base={country:'ES',documents:['BIRTH_CERT'],answers:{goal:'EXISTING_CRDS_PROBLEM',ever_crds:'NO',crds_clarify:'CRDS',identity_detail:'HAS_PHOTO_DOC'}};
  const had=run({...base,answers:{...base.answers,crds_confirm:'HAD_CRDS',b5case:'RENEWAL',same_country:'YES'}});
  assert.ok(had.seen.includes('Q013'),had.seen.join('>'));
  assert.equal(had.route,'B5_EXISTING_CRDS');assert.equal(had.S.answers.ever_crds,'YES');
  const never=run({...base,answers:{...base.answers,crds_confirm:'NEVER'}});
  assert.equal(never.route,'B1_FIRST_CRDS');
});

test('M-08: "Nu sunt sigur" at Q010 stops once instead of looping through Q008',()=>{
  const o=run({country:'FR',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},
    answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',passport_domicile:'CURRENT',goal_conflict:'UNKNOWN',ever_crds:'NO'}});
  assert.equal(o.kind,'STOP');assert.equal(o.stopId,'STOP_CRDS_STATUS_UNCLEAR');
  assert.equal(o.visits.Q010,1);assert.ok(!o.seen.includes('Q008'));
});

test('safety net: a declared CRDS passport with "never abroad" ends on a contradiction screen, not on payment',()=>{
  const o=run({country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'LOST'},
    answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',passport_domicile:'UNKNOWN',ever_crds:'NO'}});
  assert.equal(o.kind,'CONTRADICTION',o.kind+' '+o.seen.join('>'));
  assert.ok(o.html.includes('id="fixAnswer"'));
});

// ---------- (d) every way into the first-CRDS journey asks the same questions ----------
test('M-06/R07: re-acquired citizenship reaching B1 through Q011 is asked about documents after citizenship',()=>{
  const o=run({country:'ES',documents:['BIRTH_CERT'],
    answers:{citizenship:'REACQUIRED',goal:'EXISTING_CRDS_PROBLEM',ever_crds:'NO',crds_clarify:'LOCAL_RESIDENCE',identity_detail:'HAS_PHOTO_DOC'}});
  assert.ok(o.seen.includes('Q011')&&o.seen.includes('Q106'),o.seen.join('>'));
  assert.equal(o.route,'B1_FIRST_CRDS');
  const born=run({country:'ES',documents:['BIRTH_CERT'],
    answers:{goal:'EXISTING_CRDS_PROBLEM',ever_crds:'NO',crds_clarify:'LOCAL_RESIDENCE',identity_detail:'HAS_PHOTO_DOC'}});
  assert.ok(!born.seen.includes('Q106')&&born.seen.includes('Q101'),born.seen.join('>'));
});

test('R07: an expired Romanian document does not prove a document issued after re-acquiring citizenship',()=>{
  const expired=run({country:'IT',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'EXPIRED'},
    answers:{citizenship:'REACQUIRED',goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO'}});
  assert.equal(expired.visits.Q106,1,expired.seen.join('>'));
  const valid=run({country:'IT',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},
    answers:{citizenship:'REACQUIRED',goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO'}});
  assert.ok(!valid.seen.includes('Q106'),valid.seen.join('>'));
  assert.equal(valid.key,'B1_IT');
});

test('R07: the certificate answer is not asked twice when the journey re-enters B1',()=>{
  const o=run({country:'FR',documents:['BIRTH_CERT'],
    answers:{citizenship:'REACQUIRED',goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:['YES','NO'],goal_conflict:'WRONG',identity_detail:'HAS_PHOTO_DOC'}});
  assert.ok((o.visits.Q106||0)<=1,o.seen.join('>'));
  assert.equal(o.route,'B1_FIRST_CRDS');
});

test('M-10: "Altă situație" without any foreign document is explained as missing proof, not as an unknown type',()=>{
  const o=run({country:'FR',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},
    answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO',foreign_basis:'OTHER',foreign_document_generic:'NO'}});
  assert.ok(!o.seen.includes('Q108'),o.seen.join('>'));
  assert.ok(!o.allUnknowns.some(u=>/tipul exact|baza pentru domiciliul/.test(u)),JSON.stringify(o.allUnknowns));
  assert.ok(o.blockers.some(b=>/dovadă pentru situația ta de ședere/.test(b)),JSON.stringify(o.blockers));
});

test('M-10: "Nu știu" about the basis and "Nu" about any document does not ask the basis again',()=>{
  const o=run({country:'DE',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},
    answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO',foreign_basis:'UNKNOWN',foreign_document_generic:'NO'}});
  assert.equal(o.visits.Q101,1,o.seen.join('>'));
  assert.ok(o.blockers.some(b=>/dovadă pentru situația ta de ședere/.test(b)),JSON.stringify(o.blockers));
  assert.deepEqual(o.unknowns,[]);
});

test('M-10: an uncertain answer about any foreign document is clarified at Q105 once and never sold',()=>{
  const o=run({country:'DE',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},
    answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO',foreign_basis:'UNKNOWN',foreign_document_generic:'UNKNOWN'}});
  assert.equal(o.visits.Q105,1,o.seen.join('>'));
  assert.equal(o.visits.Q101,1,o.seen.join('>'));
  assert.ok(o.unknowns.some(u=>/documentul care dovedește/.test(u)),JSON.stringify(o.unknowns));
  assert.notEqual(o.kind,'PAYWALL');
});

test('M-10: a declared basis with an uncertain document keeps Q102 as the place to fix it, without payment',()=>{
  const o=run({country:'DE',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},
    answers:{goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO',foreign_proof:'UNKNOWN'}});
  assert.equal(o.visits.Q102,1,o.seen.join('>'));
  assert.equal(o.kind,'CLARIFY');
  const {ctx}=o;assert.equal(vm.runInContext("clarificationTargetFor(['Trebuie clarificat documentul care dovedește situația ta în țara de rezidență.'])",ctx),'Q102');
});

// ---------- (e) payment policy: no payment without a usable procedure (M-01, M-09, M-12, GN-03, Q126) ----------
const B1={goal:'ESTABLISH_FOREIGN_DOMICILE',ever_crds:'NO'};
const NOPAY_CASES=[
  ['FOREIGN_PROOF_MISSING',{country:'FR',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,foreign_proof:'NO'}}],
  ['BIRTH_CERT_PLASTIFIED',{country:'DE',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,birth_cert:'PLASTIFIED'}}],
  ['BIRTH_CERT_MISSING',{country:'DE',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,birth_cert:'MISSING'}}],
  ['CITIZENSHIP_CERT_MISSING',{country:'IT',documents:['BIRTH_CERT'],answers:{...B1,citizenship:'REACQUIRED',post_citizenship_romanian_id:'NO',citizenship_cert_available:'NO'}}],
  ['CIVIL_NOT_TRANSCRIBED',{country:'ES',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,civil_change:'MARRIAGE',civil_sync:'NO'}}],
  ['NO_PHOTO_ID',{country:'IT',documents:['BIRTH_CERT'],answers:{...B1,identity_detail:'NO_PHOTO_DOC'}}],
  ['LOCAL_PROOF_UNCONFIRMED',{country:'NL',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,local_proof_type:'BRP'}}],
  ['CURRENT_PROOF_MISSING',{country:'DE',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT',current_foreign_proof:'NO'}}],
  ['NEW_COUNTRY_PROOF_MISSING',{country:'BE',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'OTHER',foreign_proof:'NO'}}],
  ['THEFT_PROOF_MISSING',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'STOLEN'},answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'OTHER',theft_proof:'NO'}}],
  ['RO_ADDRESS_NOT_READY',{country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},answers:{goal:'ID_PROBLEM',passport_domicile:'ROMANIA',can_come:'YES',ro_address:'NONE'}}],
  ['HOST_REFUSES',{country:'ES',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},answers:{goal:'MOVE_DOMICILE_TO_RO',passport_domicile:'CURRENT',ro_address:'HOST',host_consent:'NO'}}],
  ['NO_REPRESENTATIVE',{country:'IT',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'EXPIRED'},answers:{goal:'ID_PROBLEM',ever_crds:'NO',can_come:'NO',representative:'NO'}}],
  ['NO_POA',{country:'IT',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'EXPIRED'},answers:{goal:'ID_PROBLEM',ever_crds:'NO',can_come:'NO',representative:'YES',poa:'NO'}}],
  ['CRDS_NOT_VALID',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},answers:{goal:'KEEP_FOREIGN_DOMICILE',passport_domicile:'CURRENT'}}],
  ['RO_RESIDENCE_NOT_READY',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},answers:{goal:'KEEP_FOREIGN_DOMICILE',passport_domicile:'CURRENT',ro_residence:'NONE'}}],
  ['RO_RESIDENCE_PROOF_MISSING',{country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},answers:{goal:'KEEP_FOREIGN_DOMICILE',passport_domicile:'CURRENT',ro_residence_proof:'NO'}}],
  ['FIRST_ID_AFTER_CITIZENSHIP',{country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},answers:{goal:'ID_PROBLEM',citizenship:'REACQUIRED',passport_domicile:'ROMANIA',can_come:'YES'}}]
];
for(const [code,c] of NOPAY_CASES){
  test('M-01: '+code+' closes checkout and explains the missing step for free',()=>{
    const o=run(c);
    assert.equal(o.kind,'NOPAY',code+': '+o.kind+' '+o.seen.join('>')+' '+JSON.stringify(o.unknowns||[]));
    assert.ok(o.codes.includes(code),JSON.stringify(o.codes));
    assert.ok(o.html.includes(`data-code="${code}"`),'explanation for '+code);
    assert.ok(!o.html.includes('id="unlockResult"'));
    assert.equal(o.decision.allowed,false);
  });
}

test('M-01: the free explanation speaks plainly, without internal terms',()=>{
  for(const [,c] of NOPAY_CASES){
    const text=run(c).html.replace(/<[^>]+>/g,' ');
    assert.ok(!/\b(ruta|rută|gate|checkout|blocker|route|guide_key|B1_|B5_|undefined|null)\b/i.test(text),text.slice(0,300));
  }
});

test('M-01: the remedy registry only accepts what the exact guide solves',()=>{
  const b5=(country,b5case,extra)=>({route:'B5_EXISTING_CRDS',docs:{CRDS_PASSPORT:'EXPIRED'},
    answers:{residence_country:country,passport_domicile:'CURRENT',ever_crds:'YES',same_country:'YES',b5case,current_foreign_proof:'YES',theft_proof:'YES',
      civil_change:'NO',local_proof_type:'PERMANENT',swiss_current_permit:'B',identity_detail:'HAS_PHOTO_DOC',...extra}});
  const d=x=>evaluate(x).decision;
  assert.equal(d(b5('IT','STOLEN',{theft_proof:'NO'})).allowed,true,'B5_STOLEN explains how to obtain the police proof');
  assert.equal(d(b5('IT','STOLEN',{theft_proof:'NO',same_country:'NO',passport_domicile:'OTHER',foreign_proof:'YES'})).allowed,false,'B5_MOVED does not');
  assert.equal(d(b5('FR','RENEWAL',{current_foreign_proof:'NO'})).allowed,true,'French CRDS holders: alternative list in the guide');
  assert.equal(d(b5('FR','LOST',{current_foreign_proof:'NO'})).allowed,true);
  assert.equal(d(b5('FR','DAMAGED',{current_foreign_proof:'NO'})).allowed,false);
  assert.equal(d(b5('DE','RENEWAL',{current_foreign_proof:'NO'})).allowed,false);
  const fr=d(b5('FR','RENEWAL',{current_foreign_proof:'NO'}));
  assert.deepEqual(fr.remedied.map(b=>b.code),['CURRENT_PROOF_MISSING']);
  assert.deepEqual(fr.unremedied,[]);
});

test('M-01: a remedied blocker keeps the paywall and says what the guide solves',()=>{
  const o=run({country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'STOLEN'},
    answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT',theft_proof:'NO'}});
  assert.equal(o.kind,'PAYWALL');assert.equal(o.key,'B5_STOLEN');
  assert.ok(o.html.includes('Ghidul îți arată cum o obții'),'remedy copy');
});

test('safety codes that have their own screens are still coded for the policy',()=>{
  const base={civil_change:'NO',residence_country:'IT'};
  assert.ok(evaluate({route:'B1_FIRST_CRDS',docs:{PASSPORT:'VALID'},answers:{...base,passport_domicile:'ROMANIA',foreign_basis:'RESIDENCE',foreign_proof:'YES',birth_cert:'READY',crds_history:'RETURNED'}})
    .decision.unremedied.some(b=>b.code==='CRDS_RETURNED_TO_RO'));
  assert.ok(evaluate({route:'C3_CEI_NO_RO_DOMICILE',docs:{},answers:{...base,ever_crds:'YES'}}).decision.unremedied.some(b=>b.code==='CEI_NOT_OPERATIONAL'));
  assert.ok(evaluate({route:'URGENT_OTHER_COUNTRY',docs:{},answers:{...base,ever_crds:'NO',travel_urgent_basis:'TOURISM'}}).decision.unremedied.some(b=>b.code==='TOURISM_ONLY'));
});

test('decision of 15.10: an old photo document is a note in a normal paid case, not a blocker',()=>{
  const o=run({country:'IT',documents:['BIRTH_CERT'],answers:{...B1,identity_detail:'HAS_PHOTO_DOC'}});
  assert.equal(o.kind,'PAYWALL');assert.equal(o.status,'GREEN');assert.deepEqual(o.codes,[]);
  assert.deepEqual(o.notes.map(n=>n.code),['IDENTITY_OLD_DOC']);
  assert.ok(o.html.includes('ia-l cu tine la depunere'));
});

test('M-12: the identity check on the travel title is a note; the case stays green and payable',()=>{
  const o=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'LOST'},answers:{goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'ROMANIA'}});
  assert.equal(o.kind,'PAYWALL');assert.equal(o.status,'GREEN');assert.deepEqual(o.blockers,[]);
  assert.deepEqual(o.notes.map(n=>n.code),['TRAVEL_TITLE_IDENTITY']);
});

test('GN-03: the first identity card after acquiring citizenship is explained for free (A1, A3, C1)',()=>{
  const re={citizenship:'REACQUIRED',passport_domicile:'ROMANIA'};
  const a3=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},answers:{...re,goal:'ID_PROBLEM',can_come:'NO'}});
  assert.equal(a3.route,'A3_FIRST_ID_CONSULAR');assert.equal(a3.kind,'NOPAY');assert.ok(a3.codes.includes('FIRST_ID_AFTER_CITIZENSHIP'));
  const c1=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},answers:{...re,goal:'CEI',physical:'YES'}});
  assert.equal(c1.route,'C1_CEI_ROMANIA');assert.equal(c1.kind,'NOPAY');
  const exchange=run({country:'IT',documents:['ROMANIAN_ID','PASSPORT'],statuses:{ROMANIAN_ID:'EXPIRED',PASSPORT:'VALID'},answers:{...re,goal:'ID_PROBLEM',can_come:'YES'}});
  assert.equal(exchange.route,'A1_PERSONAL_ROMANIA');assert.equal(exchange.kind,'PAYWALL','an earlier Romanian identity card is not a first card');
  const born=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},answers:{passport_domicile:'ROMANIA',goal:'ID_PROBLEM',can_come:'NO'}});
  assert.equal(born.kind,'PAYWALL','born citizens keep A3 (open product question, see the report)');
});

test('Q126: Belgium, the Netherlands and Ireland pay only with a local document tied to the DGP wording',()=>{
  const accepted={BE:['EU_CARD','PERMANENT','CITIZEN'],NL:['PERMANENT','CITIZEN'],IE:['PERMANENT','CITIZEN']};
  const refused={BE:['ANNEX19','OTHER'],NL:['BRP','BSN','OTHER'],IE:['UNDER5']};
  for(const country of ['BE','NL','IE']){
    for(const v of accepted[country]){
      const o=run({country,documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,local_proof_type:v}});
      assert.equal(o.visits.Q126,1,country+' '+v+' '+o.seen.join('>'));
      assert.equal(o.kind,'PAYWALL',country+' '+v);assert.equal(o.key,'B1_'+country);
    }
    for(const v of refused[country]){
      const o=run({country,documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,local_proof_type:v}});
      assert.equal(o.kind,'NOPAY',country+' '+v);assert.deepEqual(o.codes,['LOCAL_PROOF_UNCONFIRMED']);
    }
    const unsure=run({country,documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,local_proof_type:'UNKNOWN'}});
    assert.notEqual(unsure.kind,'PAYWALL');assert.equal(unsure.visits.Q126,1);
    assert.ok(unsure.unknowns.some(u=>u.includes('ce document oficial ai din')));
    const renewal=run({country,documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},
      answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT',local_proof_type:refused[country][0]}});
    assert.equal(renewal.visits.Q126,1,renewal.seen.join('>'));assert.equal(renewal.kind,'NOPAY');
  }
});

test('Q126 is not asked for a citizen of the country or outside Belgium, the Netherlands and Ireland',()=>{
  const citizen=run({country:'NL',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,foreign_basis:'CITIZEN'}});
  assert.ok(!citizen.seen.includes('Q126'));assert.equal(citizen.kind,'PAYWALL');
  for(const country of ['ES','IT','DE','AT','FR','GB','CH']){
    const o=run({country,documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1}});
    assert.ok(!o.seen.includes('Q126'),country);
  }
});

test('10 countries: clean first-CRDS and renewal journeys still reach the paywall',()=>{
  for(const country of ['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH']){
    const b1=run({country,documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1}});
    assert.equal(b1.kind,'PAYWALL',country+' B1 '+b1.kind);assert.equal(b1.key,'B1_'+country);assert.equal(b1.decision.allowed,true);
    const b5=run({country,documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'CURRENT'}});
    assert.equal(b5.kind,'PAYWALL',country+' B5 '+b5.kind);assert.equal(b5.key,'B5_RENEWAL_'+country);
  }
});

test('M-09: a move to Switzerland needs the same permit check as a renewal there',()=>{
  const unsure=run({country:'CH',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},
    answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'OTHER',swiss_current_permit:'UNKNOWN'}});
  assert.ok(unsure.seen.includes('Q125'));assert.notEqual(unsure.kind,'PAYWALL');
  assert.ok(unsure.unknowns.some(u=>/documentului actual din Elveția/.test(u)),JSON.stringify(unsure.unknowns));
  const ok=run({country:'CH',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},
    answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'OTHER',swiss_current_permit:'C'}});
  assert.equal(ok.kind,'PAYWALL');assert.equal(ok.key,'B5_MOVED');
});

test('M-09/E12: a move without proof from the new country is explained, not left "în verificare"',()=>{
  const o=run({country:'BE',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'EXPIRED'},
    answers:{goal:'EXISTING_CRDS_PROBLEM',passport_domicile:'OTHER',foreign_proof:'NO'}});
  assert.equal(o.kind,'NOPAY');assert.deepEqual(o.codes,['NEW_COUNTRY_PROOF_MISSING']);
});

test('checkout guard: the paywall click re-checks the decision and never opens checkout for a blocked case',()=>{
  const probe=o=>vm.runInContext(`window.ACTERO_PAYMENT_API='https://pay.example.test';var __checkout=0;
    startShopifyCheckout=function(){__checkout++};unlockGuide(null);__checkout`,o.ctx);
  const blocked=run(NOPAY_CASES[0][1]);
  assert.equal(probe(blocked),0);
  assert.ok(blocked.$el('screen').innerHTML.includes('data-result="no-payment"'));
  const clean=run({country:'IT',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1}});
  assert.equal(probe(clean),1);
});

test('an unknown that cannot be asked again does not hide a missing document',()=>{
  const o=run({country:'DE',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...B1,birth_cert:'MISSING',civil_change:'MARRIAGE',civil_sync:'UNKNOWN'}});
  assert.equal(o.kind,'NOPAY',o.kind);
  assert.ok(o.html.includes('Mai rămâne de lămurit'));
});

// ---------- (f) urgent travel and the CEI status (M-04, M-05, M-13, decision 3) ----------
const TO_RO={goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'ROMANIA'};
const TO_OTHER={goal:'URGENT_TRAVEL',physical:'NO',travel_dest:'OTHER',travel_urgent_basis:'OBJECTIVE_URGENT',ever_crds:'NO'};

test('M-04: a valid CEI or old-model identity card is a travel document to Romania from the EU, EEA or Switzerland',()=>{
  for(const id_card_type of ['OLD_MODEL','CEI']){
    const o=run({country:'FR',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...TO_RO,id_card_type,id_card_area:'YES'}});
    assert.equal(o.visits.Q033,1);assert.equal(o.visits.Q034,1);
    assert.equal(o.kind,'NOPAY',id_card_type);assert.deepEqual(o.codes,['ID_CARD_IS_TRAVEL_DOC']);
  }
  const cei=run({country:'IT',documents:['CEI'],statuses:{CEI:'EXPIRING'},answers:{...TO_RO,id_card_area:'YES'}});
  assert.ok(!cei.seen.includes('Q033'),'a declared CEI needs no type question');
  assert.equal(cei.kind,'NOPAY');assert.deepEqual(cei.codes,['ID_CARD_IS_TRAVEL_DOC']);
});

test('M-04: the simple and the provisional identity card are not travel documents, so the travel title is offered',()=>{
  for(const id_card_type of ['CIS','CIP']){
    const o=run({country:'FR',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'},answers:{...TO_RO,id_card_type}});
    assert.ok(!o.seen.includes('Q034'),id_card_type);
    assert.equal(o.kind,'PAYWALL',id_card_type+' '+o.kind);assert.equal(o.key,'TRAVEL_TITLE_RETURN_RO');
  }
});

test('M-04: where the client is decides whether the identity card is enough',()=>{
  const card={country:'GB',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'}};
  const outside=run({...card,answers:{...TO_RO,id_card_area:'NO'}});
  assert.equal(outside.kind,'PAYWALL');
  const uk=run({...card,answers:{...TO_RO,id_card_area:'UK'}});
  assert.equal(uk.kind,'NOPAY');assert.deepEqual(uk.codes,['ID_CARD_UK_CHECK']);
  const unsure=run({...card,answers:{...TO_RO,id_card_area:'UNKNOWN'}});
  assert.notEqual(unsure.kind,'PAYWALL');assert.equal(unsure.visits.Q034,1);
  const type=run({...card,answers:{...TO_RO,id_card_type:'UNKNOWN'}});
  assert.notEqual(type.kind,'PAYWALL');assert.equal(type.visits.Q033,1);
  assert.ok(type.unknowns.some(u=>u.includes('ce tip de carte de identitate')));
});

test('M-04: an expiring passport is still valid, so no travel title to Romania',()=>{
  const o=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'EXPIRING'},answers:{...TO_RO}});
  assert.equal(o.kind,'NOPAY');assert.deepEqual(o.codes,['PASSPORT_STILL_VALID']);
  assert.ok(!o.seen.includes('Q033'));
});

test('decision 3: an expiring passport for another country is explained for free',()=>{
  const o=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'EXPIRING'},answers:{...TO_OTHER}});
  assert.equal(o.route,'URGENT_OTHER_COUNTRY');
  assert.equal(o.kind,'NOPAY');assert.deepEqual(o.codes,['PASSPORT_EXPIRING_OTHER_DEST']);
});

test('M-04: inside the EU, EEA and Switzerland the identity card replaces the temporary passport',()=>{
  const card={country:'DE',documents:['ROMANIAN_ID'],statuses:{ROMANIAN_ID:'VALID'}};
  const inside=run({...card,answers:{...TO_OTHER,id_card_type:'OLD_MODEL',id_card_area:'YES'}});
  assert.equal(inside.kind,'NOPAY');assert.deepEqual(inside.codes,['ID_CARD_IS_TRAVEL_DOC_OTHER']);
  const outside=run({...card,answers:{...TO_OTHER,id_card_type:'OLD_MODEL',id_card_area:'NO'}});
  assert.equal(outside.kind,'PAYWALL');assert.equal(outside.key,'URGENT_OTHER_COUNTRY');
});

test('M-05: a temporary passport requested from Romania is explained, not sold, and asks nothing about the card',()=>{
  const o=run({country:'IT',documents:['PASSPORT','ROMANIAN_ID'],statuses:{PASSPORT:'LOST',ROMANIAN_ID:'VALID'},
    answers:{...TO_OTHER,physical:'YES'}});
  assert.equal(o.kind,'NOPAY');assert.deepEqual(o.codes,['TEMP_PASSPORT_FROM_ROMANIA']);
  assert.ok(!o.seen.includes('Q033')&&!o.seen.includes('Q034'),o.seen.join('>'));
});

test('M-13: the CEI status abroad is shown before any clarification question',()=>{
  const c3=run({country:'IT',documents:['CRDS_PASSPORT'],statuses:{CRDS_PASSPORT:'VALID'},
    answers:{goal:'CEI',passport_domicile:'CURRENT',physical:'NO',civil_change:'UNKNOWN'}});
  assert.equal(c3.route,'C3_CEI_NO_RO_DOMICILE');assert.equal(c3.kind,'STATUS',c3.kind);
  assert.ok(c3.html.includes('16 octombrie 2026')&&c3.html.includes('carteadeidentitate.gov.ro'));
  const c2=run({country:'IT',documents:['PASSPORT'],statuses:{PASSPORT:'VALID'},
    answers:{goal:'CEI',passport_domicile:'ROMANIA',physical:'NO',can_come:'NO',civil_change:'UNKNOWN'}});
  assert.equal(c2.route,'C2_CEI_CONSULAR');assert.equal(c2.kind,'STATUS',c2.kind);
});
