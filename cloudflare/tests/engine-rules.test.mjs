// ActeRO engine rules (16 Oct 2026): validity, derivations, contradictions, payment gates.
// Drives the REAL questionnaire from index.html with synthetic answers (see helpers/engine-harness.mjs).
// No premium guide code, no D1 export, no network. Run: node --test cloudflare/tests/engine-rules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {run,loadEngine} from './helpers/engine-harness.mjs';

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
