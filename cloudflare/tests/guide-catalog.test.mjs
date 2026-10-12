// Run: node --test cloudflare/tests/guide-catalog.test.mjs
// Public metadata and router contract only; NEVER import private premium guide scripts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const catalog=JSON.parse(readFileSync(new URL('../guide-catalog.json',import.meta.url),'utf8'));
function extract(startAnchor,endAnchor,name,answers,route){
  const start=html.indexOf(startAnchor),end=html.indexOf(endAnchor,start);
  assert.ok(start>=0&&end>start, 'Missing router function '+name);
  return vm.runInNewContext(html.slice(start,end)+'\n'+name+';',{
    S:{route,answers},domicileState:()=> 'ABROAD'
  });
}
function example(entry){
  const c=entry.country||'IT';
  const answers={
    residence_country:c,residence_country_name:c,foreign_basis:'PERMIT',swiss_permit:'B',
    swiss_current_permit:'B',same_country:'YES',b5case:'RENEWAL',
    foreign_proof:'YES',travel_urgent_basis:'CONTINUE_JOURNEY'
  };
  if(entry.key.startsWith('B5_')){
    if(entry.key==='B5_MOVED')answers.same_country='NO';
    else if(entry.key==='B5_STOLEN')answers.b5case='STOLEN';
    else if(entry.key==='B5_DAMAGED')answers.b5case='DAMAGED';
    else if(entry.key==='B5_DATA_CHANGE')answers.b5case='DATA_CHANGE';
    else answers.b5case=entry.scenario.toUpperCase();
  }
  return answers;
}
test('catalog describes 43 unique keys and 10 countries, no paid content',()=>{
  assert.equal(catalog.guides.length,43);
  assert.equal(catalog.countries.length,10);
  assert.equal(new Set(catalog.guides.map(x=>x.key)).size,43);
  assert.ok(catalog.verification_note.includes('NOT been verified'));
  for(const g of catalog.guides){
    assert.match(g.key,/^[A-Z0-9_]+$/);
    assert.match(g.route,/^[A-Z0-9_]+$/);
    assert.equal(Object.hasOwn(g,'steps'),false);
    assert.equal(Object.hasOwn(g,'script_js'),false);
    assert.equal(Object.hasOwn(g,'guide_json'),false);
  }
});
test('every declared guide key is reachable and is flagged valid by the client router',()=>{
  for(const entry of catalog.guides){
    const answers=example(entry);
    const routeFn=extract('function guideKeyForCurrent(){','\nlet loadedPaidGuideKey=', 'guideKeyForCurrent',answers,entry.route);
    const validated=extract('function hasValidatedPaidGuide(){','\nfunction showCurrentStatusResult(', 'hasValidatedPaidGuide',answers,entry.route);
    assert.equal(routeFn(),entry.key,'guide key mismatch: '+entry.key);
    assert.equal(validated(),true,'guide not validated by router: '+entry.key);
  }
});
test('unknown scenarios do not receive a guide key',()=>{
  const invalid=[
    {route:'B1_FIRST_CRDS',answers:{residence_country:'XX'}},
    {route:'B5_EXISTING_CRDS',answers:{residence_country:'IT',same_country:'UNKNOWN',b5case:'RENEWAL'}},
    {route:'UNKNOWN_ROUTE',answers:{residence_country:'IT'}},
    {route:'B5_EXISTING_CRDS',answers:{residence_country:'IT',same_country:'YES',b5case:'UNKNOWN'}}
  ];
  for(const x of invalid){
    const fn=extract('function guideKeyForCurrent(){','\nlet loadedPaidGuideKey=','guideKeyForCurrent',x.answers,x.route);
    assert.equal(fn(),null,JSON.stringify(x));
  }
});
test('private premium function implementations are absent from public index',()=>{
  assert.doesNotMatch(html,/\bfunction\s+show[A-Za-z0-9_]*(?:ValidatedGuide|VariantGuide|MovedCountryCompositeGuide)\s*\(/);
  assert.ok(html.includes("'/guide-script?case_id='"));
  assert.ok(html.includes("key!==grant.guide_key")===false); // the server enforces grants; client cannot impersonate the server
});
