// T-03 (16 Oct 2026): preparatory tests for server-side eligibility. They do NOT test the Worker.
// The Worker part lives in Codex's commit e172cf9, which is not published; the `todo` entries below
// are the exact checks that commit must pass. See cloudflare/SERVER_ELIGIBILITY_T03_TESTS.md.
// What runs today: the fixture corpus is complete (all 43 guide keys) and in sync with the page engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluate} from './helpers/engine-harness.mjs';

const corpus=JSON.parse(readFileSync(new URL('./fixtures/server-eligibility-cases.json',import.meta.url),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('../guide-catalog.json',import.meta.url),'utf8'));
const REASONS=new Set([null,'not_eligible','legal_basis_unconfirmed','route_not_derivable','case_route_changed']);

test('T-03 corpus: well formed, unique ids, known refusal reasons',()=>{
  assert.equal(corpus.schema_version,1);
  const ids=corpus.cases.map(c=>c.id);
  assert.equal(new Set(ids).size,ids.length,'duplicate fixture id');
  for(const c of corpus.cases){
    assert.ok(c.case_state&&typeof c.case_state.route==='string'&&c.case_state.answers&&c.case_state.docs,c.id);
    assert.ok(REASONS.has(c.expected.refuse_reason),c.id+' '+c.expected.refuse_reason);
    assert.equal(c.expected.allowed===false,c.expected.refuse_reason==='not_eligible'||c.expected.refuse_reason==='route_not_derivable'||c.expected.refuse_reason==='case_route_changed',c.id);
  }
});

test('T-03 corpus: every one of the 43 guide keys has a canonical journey',()=>{
  const keys=new Set(corpus.cases.filter(c=>c.source==='journey').map(c=>c.expected.guide_key));
  for(const g of catalog.guides)assert.ok(keys.has(g.key),'no fixture for '+g.key);
  assert.equal(catalog.guides.length,43);
});

test('T-03 corpus: journeys, stale sessions and unchecked statuses match the page decision today',()=>{
  for(const c of corpus.cases.filter(x=>['journey','stale_or_unknown'].includes(x.source))){
    const d=evaluate(c.case_state).decision;
    assert.equal(d.allowed,c.expected.allowed,c.id+' allowed');
    if(c.source==='journey'){
      assert.equal(d.key,c.expected.guide_key,c.id+' key');
      assert.equal(d.legalBasisConfirmed,c.expected.legalBasisConfirmed,c.id+' legal basis');
    }
  }
});

test('T-03 corpus: a request that clears status and blockers changes nothing in the page decision',()=>{
  const c=corpus.cases.find(x=>x.id==='forged:status_and_blockers_cleared');
  assert.equal(evaluate(c.case_state).decision.allowed,false);
});

// ---- Server checks owed by the Worker integration (Codex e172cf9). Not runnable here. ----
for(const c of corpus.cases.filter(x=>x.expected.refuse_reason)){
  test.todo(`Worker /checkout refuses ${c.id} with ${c.expected.refuse_reason}, recomputing from case_state only`);
}
test.todo('Worker /checkout derives route and guide key from answers and docs; request route, guide_key, status, blockers and unknowns never decide');
test.todo('Worker and page agree on allowed, guide key, route and legalBasisConfirmed for every journey, stale and unknown fixture (parity)');
test.todo('Worker refuses forged routes the page decision still accepts today (7 forged:* cases): needs a shared route derivation or route preconditions');
test.todo('Worker refuses a case_state missing answers required by the current questionnaire version (missingRequiredOf)');
test.todo('Worker keeps checkout disabled unless SHOPIFY_CHECKOUT_ENABLED is set, before any eligibility work');
test.todo('Worker grants access only to the guide key it derived and stored in checkout_intents, whatever the webhook or recovery request says');
