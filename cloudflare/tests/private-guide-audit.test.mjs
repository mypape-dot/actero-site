import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {auditPrivateGuides,rowsFromExport} from '../audit-private-guides.mjs';
const catalog=JSON.parse(readFileSync(new URL('../guide-catalog.json',import.meta.url),'utf8'));
const js=i=>'function localGuide'+i+'(){return '+i+'}';
const normal=()=>catalog.guides.map((g,i)=>({guide_key:g.key,route:g.route,script_js:js(i)}));

test('all expected scripts are compiled statically, never executed',()=>{
  const rows=normal();
  rows[0].script_js='throw new Error("this must never execute")';
  const result=auditPrivateGuides(rows);
  assert.equal(result.expected,43);
  assert.equal(result.matched,43);
  assert.equal(result.structurally_valid,true);
  assert.equal(result.legal_review_completed,false);
  assert.equal(result.sale_approved,0);
  assert.deepEqual(result.errors,[]);
});

test('missing, repeated, mismatched, blank and syntactically invalid entries fail closed',()=>{
  const rows=normal();
  rows.pop();
  rows[0].route='OTHER';
  rows[1].script_js='   ';
  rows[2].script_js='function invalid( {';
  rows.push({...rows[3]});
  rows.push({guide_key:'SECRET_TOKEN_X',route:'X',script_js:'PRIVATE_TEXT'});
  const result=auditPrivateGuides(rows);
  const codes=result.errors.map(x=>x.code);
  for(const code of ['MISSING_KEY','ROUTE_MISMATCH','SCRIPT_MISSING_OR_EMPTY',
      'JAVASCRIPT_SYNTAX','DUPLICATE_KEY','UNEXPECTED_OR_INVALID_KEY'])
    assert.ok(codes.includes(code),'Missing expected '+code);
  assert.equal(result.structurally_valid,false);
  const output=JSON.stringify(result);
  assert.ok(!output.includes('PRIVATE_TEXT'));
  assert.ok(!output.includes('SECRET_TOKEN_X'));
  assert.ok(!output.includes('function invalid'));
});

test('shared B5 scripts produce advisory review flags, not automatic approval',()=>{
  const rows=normal();
  const first=rows.find(x=>x.guide_key==='B5_DAMAGED');
  rows.find(x=>x.guide_key==='B5_DATA_CHANGE').script_js=first.script_js;
  const result=auditPrivateGuides(rows);
  assert.equal(result.structurally_valid,true);
  assert.ok(result.warnings.some(w=>w.code==='KNOWN_SHARED_B5_SCRIPT_CHECK_BOTH_CASES'));
  assert.equal(result.sale_approved,0);
});

test('verification claims, BRP mentions and fee amounts are flagged without excerpts',()=>{
  const rows=normal();
  rows[0].script_js='const privatePayload="Verificat la 5 octombrie 2026. BRP. 53 EUR. TODO";';
  const result=auditPrivateGuides(rows);
  const codes=result.warnings.filter(x=>x.key===rows[0].guide_key).map(x=>x.code);
  for(const code of ['VERIFICATION_CLAIM','EDITORIAL_PLACEHOLDER','FEE_REQUIRES_CURRENT_SOURCE','UK_BRP_REFERENCE'])
    assert.ok(codes.includes(code),code);
  const output=JSON.stringify(result);
  assert.ok(!output.includes('Verificat la 5 octombrie'));
  assert.ok(!output.includes('53 EUR'));
});

test('CLI accepts a private export outside repo, and never prints commercial content',()=>{
  const dir=mkdtempSync(join(tmpdir(),'actero-private-audit-'));
  const file=join(dir,'guide-scripts.json');
  try{
    const rows=normal();
    rows[0].script_js='const strictlySecret="never-emit-private-paid-steps";';
    writeFileSync(file,JSON.stringify([{results:rows}]));
    assert.equal(rowsFromExport([{results:rows}]).length,43);
    assert.equal(rowsFromExport({results:rows}).length,43);
    const run=spawnSync(process.execPath,[new URL('../audit-private-guides.mjs',import.meta.url).pathname,file],
      {encoding:'utf8',timeout:20000});
    assert.equal(run.status,0,run.stderr);
    assert.ok(run.stdout.includes('"expected": 43'));
    assert.ok(!run.stdout.includes('never-emit-private-paid-steps'));
    assert.ok(!run.stderr.includes('never-emit-private-paid-steps'));
  }finally{rmSync(dir,{recursive:true,force:true})}
});

test('CLI refuses input paths inside the public repository',()=>{
  const file=new URL('../guide-catalog.json',import.meta.url).pathname;
  const run=spawnSync(process.execPath,[new URL('../audit-private-guides.mjs',import.meta.url).pathname,file],
    {encoding:'utf8',timeout:20000});
  assert.equal(run.status,2);
  assert.match(run.stderr,/OUTSIDE the ActeRO repository/);
});
