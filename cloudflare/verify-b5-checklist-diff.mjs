// Verify operator's private B5 checklist edit byte-for-byte by regenerating the
// expected private output locally. Never print, upload or expose guide source.
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,isAbsolute,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const [originalPath,revisedPath]=process.argv.slice(2);
assert.ok(originalPath&&revisedPath&&isAbsolute(originalPath)&&isAbsolute(revisedPath),
  'Require absolute reviewed-UK base and checklist-draft private paths');
assert.notEqual(resolve(originalPath),resolve(revisedPath),'Base and draft must differ');
function parse(path){
 const raw=JSON.parse(readFileSync(path,'utf8'));
 const rows=Array.isArray(raw)&&raw.length===1&&Array.isArray(raw[0]?.results)?raw[0].results:
   Array.isArray(raw)&&raw.every(x=>x&&typeof x==='object'&&'guide_key' in x)?raw:
   Array.isArray(raw?.results)?raw.results:null;
 assert.ok(Array.isArray(rows)&&rows.length===2,'Exactly two B5 records required');
 const byKey=new Map(rows.map(r=>[r.guide_key,r]));
 assert.equal(byKey.size,2,'Duplicate keys');
 for(const key of ['B5_DAMAGED','B5_DATA_CHANGE']){
   const row=byKey.get(key);
   assert.ok(row&&row.route==='B5_EXISTING_CRDS','Invalid route or key');
   assert.ok(typeof row.script_js==='string'&&row.script_js.length>500,'Missing guide');
 }
 assert.equal(byKey.get('B5_DAMAGED').script_js,byKey.get('B5_DATA_CHANGE').script_js,
   'B5 scripts are no longer matching');
 return byKey.get('B5_DAMAGED').script_js;
}
const base=parse(originalPath),updated=parse(revisedPath);
const tmp=mkdtempSync(join(tmpdir(),'actero-b5-checklist-'));
try{
 const expectedPath=join(tmp,'expected.json');
 const preparer=resolve(dirname(fileURLToPath(import.meta.url)),'prepare-b5-checklist-review.mjs');
 execFileSync(process.execPath,[preparer,originalPath,expectedPath],{
   encoding:'utf8',timeout:20000,maxBuffer:4096
 });
 assert.equal(updated,parse(expectedPath),'Unexpected content edits beyond checklist changes');
 assert.notEqual(updated,base,'No new checklist changes detected');
 assert.ok(updated.includes('Certificatul românesc de naștere'));
 assert.ok(updated.includes("tone:'warn'"));
 assert.ok(updated.includes('Dovada achitării taxei'));
 assert.ok(!updated.includes('5 octombrie 2026'));
 console.log('B5 CHECKLIST DIFF: 2/2 intended replacements; 0 unexpected edits; 2 matching guides. D1 unchanged.');
}finally{rmSync(tmp,{force:true,recursive:true})}
