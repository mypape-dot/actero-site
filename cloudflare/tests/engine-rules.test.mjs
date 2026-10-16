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
