// ActeRO: source-type and consular-acceptance safety gates.
// Only public facts and synthetic case metadata; NEVER import private D1 scripts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const base=new URL('../',import.meta.url);
const evidence=JSON.parse(readFileSync(new URL('BE_NL_IE_EVIDENCE_GATES_20261014.json',base),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('guide-catalog.json',base),'utf8'));
const countryMatrix=JSON.parse(readFileSync(new URL('four-country-b1-b5-editorial-matrix.json',base),'utf8'));
const tracked=readFileSync(new URL('guide-review-tracker.csv',base),'utf8').trim()
  .split(/\r?\n/).filter(line=>line&&!line.startsWith('#'));
const columns=tracked[0].split(',');
const tracker=new Map(tracked.slice(1).map(line=>{
 const vals=line.split(',');
 const obj=Object.fromEntries(columns.map((name,i)=>[name,vals[i]]));
 return [obj.guide_key,obj];
}));
const expected=new Set(['BE','NL','IE'].flatMap(code=>
 ['B1_','B5_RENEWAL_','B5_LOST_'].map(prefix=>prefix+code)));

test('each of nine country-scenario gates links to existing, unapproved catalog and review record',()=>{
 assert.equal(evidence.overall_sale_approval,'NO');
 assert.equal(evidence.guide_gates.length,9);
 assert.deepEqual(new Set(evidence.guide_gates.map(g=>g.guide_key)),expected);
 assert.equal(evidence.countries.FR,undefined);
 for(const item of evidence.guide_gates){
   const expectedRoute=item.scenario==='first_crds'?'B1_FIRST_CRDS':'B5_EXISTING_CRDS';
   const guide=catalog.guides.find(x=>x.key===item.guide_key);
   assert.ok(guide,'missing guide in catalog '+item.guide_key);
   assert.equal(item.route,expectedRoute);
   assert.equal(guide.route,item.route);
   assert.equal(guide.country,item.country);
   assert.equal(guide.scenario,item.scenario);
   assert.equal(tracker.get(item.guide_key)?.sale_approved,'NO');
   assert.equal(item.romanian_consular_acceptance_confirmed,false);
   assert.equal(item.private_d1_content_reviewed,false);
   assert.equal(item.editorial_clearance,'NO');
   assert.ok(item.must_not.length>45);
   assert.ok(item.must_do.length>45);
   assert.ok(item.case.length>25);
   const m=countryMatrix.guide_checks.find(x=>x.guide_key===item.guide_key);
   assert.equal(m?.editorial_clearance,'NO');
   assert.equal(m?.consular_acceptance_confirmed,false);
 }
});
test('official foreign government references never masquerade as Romanian CRDS acceptance',()=>{
 assert.match(evidence.romanian_crds_source,/^https:\/\/pasapoarte\.mai\.gov\.ro\//);
 for(const [code,policy] of Object.entries(evidence.countries)){
  assert.ok(['BE','NL','IE'].includes(code));
  assert.ok(policy.authority_refs.length>=2);
  assert.ok(policy.prohibited_claims.length>=3);
  assert.ok(policy.red_flag.length>60);
  assert.ok(policy.check_for.length>60);
  assert.equal(policy.cases.length,3);
  for(const ref of policy.authority_refs){
    assert.ok(ref.url.startsWith('https://'));
    assert.ok(!ref.url.includes('pasapoarte.mai.gov.ro'));
    assert.ok(ref.what_it_proves.length>65);
  }
 }
 assert.ok(evidence.explanation.includes('NOT which exact documents Romania accepts'));
});
test('country-specific false equivalences and 2025 Belgian registration update have source-backed blockers',()=>{
 const be=evidence.countries.BE;
 assert.ok(be.authority_refs.some(r=>r.url.includes('dofi.ibz.be')&&r.what_it_proves.includes('1 Sep 2025')));
 assert.match(be.red_flag,/Anexa 19/);
 assert.match(be.prohibited_claims.join(' '),/acceptată automat/);

 const nl=evidence.countries.NL;
 assert.match(nl.red_flag,/BSN.*RNI/);
 assert.ok(nl.authority_refs.some(r=>r.url.includes('8004.pdf')&&r.what_it_proves.includes('five years')));
 assert.match(nl.prohibited_claims.join(' '),/RNI/);

 const ie=evidence.countries.IE;
 assert.match(ie.red_flag,/PPS.*IRP.*EUTR2/);
 assert.ok(ie.authority_refs.some(r=>r.url.includes('gov.ie')));
 assert.ok(ie.authority_refs.some(r=>r.url.includes('EUTR2.pdf')));
 assert.match(ie.prohibited_claims.join(' '),/IRP/);
});
test('loss and renewal never collapse to a new first-CRDS eligibility conclusion',()=>{
 for(const country of Object.keys(evidence.countries)){
  const byScenario=Object.fromEntries(evidence.guide_gates
   .filter(x=>x.country===country).map(x=>[x.scenario,x]));
  assert.ok(byScenario.first_crds);
  assert.ok(byScenario.renewal);
  assert.ok(byScenario.lost);
  assert.notEqual(byScenario.lost.case,byScenario.renewal.case);
  assert.match(byScenario.lost.must_do,/Separa/i);
  assert.match(byScenario.renewal.must_do,/(dovad|document|tipul)/i);
 }
});
