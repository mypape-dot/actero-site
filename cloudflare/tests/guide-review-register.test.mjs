// Strict content-review register validation. Never import private paid scripts.
// This checks metadata and approvals only; it DOES NOT certify legal accuracy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const dir=new URL('../',import.meta.url);
const catalog=JSON.parse(readFileSync(new URL('guide-catalog.json',dir),'utf8'));
const lines=readFileSync(new URL('guide-review-tracker.csv',dir),'utf8')
  .split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('#'));
const headers=lines[0].split(',');
const required=['guide_key','route','country','scenario','audit_flags',
 'D1_metadata_checked','official_sources_checked','fees_checked',
 'documents_checked','mobile_QA','payment_E2E','sale_approved'];
const items=lines.slice(1).map((line,i)=>{
  const values=line.split(',');
  assert.equal(values.length,headers.length,'Invalid CSV cell count row '+(i+2));
  return Object.fromEntries(headers.map((h,j)=>[h,values[j]]));
});
const gateCols=['D1_metadata_checked','official_sources_checked','fees_checked',
 'documents_checked','mobile_QA','payment_E2E'];
test('review-register schema is complete and unambiguous',()=>{
  assert.deepEqual(headers,required);
  assert.equal(items.length,catalog.guides.length);
  assert.equal(new Set(items.map(x=>x.guide_key)).size,items.length);
});
test('every guide appears exactly once, with matching route, country and scenario',()=>{
  const byKey=new Map(items.map(x=>[x.guide_key,x]));
  for(const g of catalog.guides){
    const row=byKey.get(g.key);
    assert.ok(row,'Missing review register entry '+g.key);
    assert.equal(row.route,g.route,g.key+' route mismatch');
    assert.equal(row.country,g.country||'MULTI',g.key+' country mismatch');
    assert.equal(row.scenario,g.scenario,g.key+' scenario mismatch');
    assert.ok(row.audit_flags.trim(),'No tracked audit flags: '+g.key);
  }
});
test('no guide is sale-approved without every independent review gate',()=>{
  for(const row of items){
    for(const col of [...gateCols,'sale_approved'])
      assert.ok(['YES','NO'].includes(row[col]),row.guide_key+' invalid '+col+'='+row[col]);
    if(row.sale_approved==='YES')
      for(const col of gateCols)
        assert.equal(row[col],'YES',row.guide_key+' approved without '+col);
  }
});
test('inventory may not silently claim that 43 private scripts were checked',()=>{
  assert.match(catalog.verification_note,/Private D1 script content.*NOT been verified individually/);
  assert.equal(catalog.review_status,'requires_individual_legal_and_content_review');
});
