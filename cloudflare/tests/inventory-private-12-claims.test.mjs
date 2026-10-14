import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPECTED} from '../private-12-guide-preflight-local.mjs';
import {countEditorialClaims,safeLines} from '../inventory-private-12-claims-local.mjs';
function fixture(){
 return [{results:[...EXPECTED].map(([guide_key,x],i)=>({
  guide_key,route:x.route,script_js:'function sample'+i+'(){return '+JSON.stringify(
   'Ghid de test. Procedură verificată. Surse reverificate: 5 octombrie 2026. '+
   (guide_key==='B1_FR'?'Verificat la 5 octombrie 2026. ':'')+
   'CONTINUT_TEST_NU_AFISA '+'test '.repeat(80))+';}'
 }))}];
}
test('distinguishes exact dated claim from independent verification date',()=>{
 const r=countEditorialClaims(fixture());
 assert.equal(r.length,12);
 const fr=r.find(x=>x.guide_key==='B1_FR');
 assert.equal(fr.dated_source_count,1);
 assert.equal(fr.separate_dated_claim_count,1);
 assert.equal(fr.VERIFIED_ON_DATE,1);
 const nl=r.find(x=>x.guide_key==='B1_NL');
 assert.equal(nl.separate_dated_claim_count,0);
});
test('inventory text contains no source text',()=>{
 const lines=safeLines(fixture()).join('\n');
 assert.ok(lines.includes('PRIVATE CLAIM INVENTORY: 12/12'));
 assert.equal((lines.match(/CLAIM_COUNT /g)||[]).length,12);
 assert.equal(lines.includes('CONTINUT_TEST_NU_AFISA'),false);
 assert.equal(lines.includes('function sample'),false);
});
test('incomplete or unexpected input is refused',()=>{
 const a=fixture();a[0].results.pop();
 assert.throws(()=>countEditorialClaims(a));
 const b=fixture();b[0].results[0].extra='x';
 assert.throws(()=>countEditorialClaims(b));
});
