// Offline-only verification of an operator's B5 draft vs their original D1 export.
// Never uploads or logs paid content, credentials or raw diffs.
// Expected revision is regenerated using the reviewed 5-substitution preparer.
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const [originalPath,draftPath]=process.argv.slice(2);
assert.ok(originalPath&&draftPath&&isAbsolute(originalPath)&&isAbsolute(draftPath),
  'Provide absolute private original and draft JSON paths');
assert.notEqual(resolve(originalPath),resolve(draftPath),'Original and draft must be separate files');

const readGuideRows=(path)=>{
  const raw=JSON.parse(readFileSync(path,'utf8'));
  const rows=Array.isArray(raw)&&raw.length===1&&Array.isArray(raw[0]?.results)?raw[0].results:
    Array.isArray(raw)&&raw.every(x=>x&&typeof x==='object'&&'guide_key' in x)?raw:
    Array.isArray(raw?.results)?raw.results:null;
  assert.ok(Array.isArray(rows)&&rows.length===2,'Expected precisely two guide records');
  const map=new Map(rows.map(x=>[x.guide_key,x]));
  assert.equal(map.size,2,'Duplicate guide keys');
  for(const key of ['B5_DAMAGED','B5_DATA_CHANGE']){
    const row=map.get(key);
    assert.ok(row&&row.route==='B5_EXISTING_CRDS','Unexpected guide key/route');
    assert.ok(typeof row.script_js==='string'&&row.script_js.length>500,'Script missing');
  }
  assert.equal(map.get('B5_DAMAGED').script_js,map.get('B5_DATA_CHANGE').script_js,
    'The shared B5 scripts are no longer identical');
  return map;
};

const original=readGuideRows(originalPath);
const supplied=readGuideRows(draftPath);
const directory=mkdtempSync(join(tmpdir(),'actero-b5-diff-'));
try{
  const expectedPath=join(directory,'expected.json');
  const preparer=resolve(dirname(fileURLToPath(import.meta.url)),'prepare-b5-uk-review.mjs');
  execFileSync(process.execPath,[preparer,originalPath,expectedPath],{
    timeout:20000,encoding:'utf8',maxBuffer:4096
  });
  const expected=readGuideRows(expectedPath);
  for(const key of ['B5_DAMAGED','B5_DATA_CHANGE'])
    assert.equal(supplied.get(key).script_js,expected.get(key).script_js,
      'Unexpected content edit beyond the five reviewed replacements');
  assert.notEqual(supplied.get('B5_DAMAGED').script_js,original.get('B5_DAMAGED').script_js,
    'No B5 review changes detected');
  const updated=supplied.get('B5_DAMAGED').script_js;
  assert.ok(updated.includes('UKVI (eVisa)'),'Missing UKVI caveat');
  assert.ok(updated.includes('share code'),'Missing UK share-code clarification');
  assert.ok(!updated.includes('5 octombrie 2026'),'Unreviewed historic source claim remains');
  assert.ok(!updated.includes('Procedură verificată'),'Unreviewed approved badge remains');
  console.log('B5 EXACT DIFF: 5/5 planned substitutions; 0 unexpected edits; 2 matching guides. D1 unchanged.');
}finally{
  rmSync(directory,{recursive:true,force:true});
}
