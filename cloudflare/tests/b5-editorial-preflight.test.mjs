import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPrivatePair,auditB5Text} from '../b5-editorial-preflight-local.mjs';

const sample=[
 'Pașaportul CRDS anterior deteriorat dacă mai poate fi identificat',
 'înscrierea schimbării în actele de stare civilă românești de actualizat',
 'Certificatul românesc de naștere Carte de identitate românească (dacă există) Dovada achitării taxei',
 'Documentul concret și traducerea se confirmă la consulat. de verificat',
 'statutul digital UKVI (eVisa); un share code nu este automat acceptat',
 'Cardurile BRP fizice au expirat',
 'Pentru cererile consulare CRDS eConsulat indică 53 EUR. Confirmă taxa la consulatul ales',
 'Fișa DGP din 2022: confirmarea după verificare consulară se generează în cel mult 30 de zile',
].join(' | ').repeat(3);

function json(script=sample){
 return [{results:['B5_DAMAGED','B5_DATA_CHANGE'].map(guide_key=>({
  guide_key,route:'B5_EXISTING_CRDS',script_js:script
 }))}];
}

test('validates exactly two identical B5 scripts, regardless of input container',()=>{
 assert.equal(verifyPrivatePair(json()),sample);
 assert.equal(verifyPrivatePair(json()[0].results),sample);
 assert.throws(()=>verifyPrivatePair({results:[]}),/exactly two/);
 const mismatch=json();mismatch[0].results[1].script_js+='DIFFERENT';
 assert.throws(()=>verifyPrivatePair(mismatch),/differ/);
 const other=json();other[0].results[0].route='B1_FIRST_CRDS';
 assert.throws(()=>verifyPrivatePair(other),/validation/);
});

test('safe synthetic sample satisfies textual safeguards and 2022 context signal',()=>{
 const result=auditB5Text(sample);
 assert.equal(result.flags.length,8);
 assert.ok(result.flags.every(x=>x.ok));
 assert.equal(result.ukFreshnessContext,true);
});

test('does not report success for old verification badge, missing caution or missing checklist',()=>{
 const weak='Procedură verificată 5 octombrie 2026 '+('neconfirmat ').repeat(80);
 const r=auditB5Text(weak);
 assert.equal(r.flags[0].ok,false);
 assert.equal(r.flags[2].ok,false);
 assert.equal(r.flags[3].ok,false);
 assert.equal(r.flags[5].ok,false);
 assert.equal(r.ukFreshnessContext,false);
});

test('distinguishes 90-day UKVI code from DGP consular verification freshness',()=>{
 const r=auditB5Text(sample.replace('cel mult 30 de zile','90 de zile'));
 assert.equal(r.ukFreshnessContext,false);
});
