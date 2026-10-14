// Prevent claiming a guide was independently reviewed when no such signoff exists.
// Public copy only; this test does NOT inspect or approve private D1 scripts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const tracker=readFileSync(new URL('../guide-review-tracker.csv',import.meta.url),'utf8');
const rows=tracker.split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('#'));
const cols=rows[0].split(','),sale=cols.indexOf('sale_approved');
test('public home and result copy must not claim unrecorded guide verification',()=>{
  assert.ok(sale>=0);
  const approvals=rows.slice(1).filter(r=>r.split(',')[sale]==='YES').length;
  assert.equal(approvals,0,'Audit state changed: review copy policy before changing this test');
  for(const claim of [
    'surse oficiale verificate',
    'Surse oficiale verificate',
    'Procedură verificată',
    'Verificat la 5 octombrie 2026'
  ])assert.ok(!html.includes(claim),'Unsubstantiated blanket claim: '+claim);
  assert.ok(html.includes('surse oficiale de consultat'));
  assert.ok(html.includes('Procedură identificată'));
  assert.ok(html.includes('Verifică cerințele actuale la instituția competentă.'));
});
