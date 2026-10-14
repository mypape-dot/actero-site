import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const catalog=JSON.parse(readFileSync(new URL('../guide-catalog.json',import.meta.url),'utf8'));
const cli=new URL('../audit-d1-metadata.mjs',import.meta.url).pathname;
const valid=catalog.guides.map(g=>({guide_key:g.key,route:g.route,script_chars:15}));
function run(rows){
 const folder=mkdtempSync(join(tmpdir(),'actero-d1-metadata-'));
 const file=join(folder,'metadata.json');
 try{
  writeFileSync(file,JSON.stringify([{results:rows}]));
  return spawnSync(process.execPath,[cli,file],{encoding:'utf8'});
 }finally{rmSync(folder,{recursive:true,force:true})}
}
test('all 43 valid metadata-only rows pass',()=>{
 const r=run(valid);
 assert.equal(r.status,0,r.stderr+' '+r.stdout);
 assert.equal(JSON.parse(r.stdout).expected,43);
});
test('missing, extra, duplicate and wrong-route keys are detected',()=>{
 const rows=[...valid.slice(1),{guide_key:'B1_ES',route:'WRONG',script_chars:20},
  {guide_key:'B1_ES',route:'WRONG',script_chars:20},
  {guide_key:'EXTRA_GUIDE',route:'WRONG',script_chars:0}];
 const r=run(rows);
 assert.equal(r.status,1);
 const out=JSON.parse(r.stdout);
 assert.ok(out.duplicate.includes('B1_ES'));
 assert.ok(out.route_mismatch.includes('B1_ES'));
 assert.ok(out.unexpected.includes('EXTRA_GUIDE'));
 assert.ok(out.empty_scripts.includes('EXTRA_GUIDE'));
});
test('private script fields are rejected, never printed',()=>{
 const r=run([{...valid[0],script_js:'SECRET PAID CONTENT'}]);
 assert.equal(r.status,2);
 assert.doesNotMatch(r.stdout+r.stderr,/SECRET PAID CONTENT/);
});
