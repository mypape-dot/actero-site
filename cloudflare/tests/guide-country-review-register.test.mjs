// Public metadata tracker checks only. No premium guide source or personal data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../',import.meta.url);
const catalog=JSON.parse(readFileSync(new URL('guide-catalog.json',base),'utf8'));
const text=readFileSync(new URL('guide-country-review-tracker.csv',base),'utf8');
const lines=text.split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('#'));
const columns=['guide_key','country','official_sources_checked','eligibility_checked',
  'fees_checked','documents_checked','mobile_QA','editorial_approved',
  'reviewer_reference','reviewed_at'];
const rows=lines.slice(1).map(line=>{
  const cells=line.split(',');
  assert.equal(cells.length,columns.length,'Malformed country review CSV row');
  return Object.fromEntries(columns.map((c,i)=>[c,cells[i]]));
});
const keys=new Set(['B5_STOLEN','B5_DAMAGED','B5_DATA_CHANGE','B5_MOVED']);
test('all forty B5 shared-country review obligations are explicitly tracked',()=>{
  assert.deepEqual(lines[0].split(','),columns);
  const expected=new Set([...keys].flatMap(k=>catalog.countries.map(c=>k+':'+c)));
  const present=new Set(rows.map(r=>r.guide_key+':'+r.country));
  assert.equal(rows.length,40);
  assert.equal(present.size,40);
  assert.deepEqual(present,expected);
});
test('no country is marked approved without full editorial checks and reviewer reference',()=>{
  for(const row of rows){
    for(const col of [...columns.slice(2,7),'editorial_approved']){
      assert.ok(['YES','NO'].includes(row[col]),row.guide_key+' '+row.country+' '+col);
    }
    if(row.editorial_approved==='YES'){
      for(const col of columns.slice(2,7))assert.equal(row[col],'YES',
        row.guide_key+' '+row.country+' not reviewed: '+col);
      assert.ok(row.reviewer_reference.trim(),'No private-review evidence reference');
      assert.match(row.reviewed_at,/^\d{4}-\d{2}-\d{2}$/);
    }
  }
});
