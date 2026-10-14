// LOCAL ONLY. Prepare B5 checklist UX draft from the previous private UK review.
// No D1 connections, no uploads, no checkout and no overwrites.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {resolve,dirname,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const [input,output]=process.argv.slice(2);
assert.ok(input&&output&&isAbsolute(input)&&isAbsolute(output),'Two absolute private paths required');
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const parent=realpathSync(dirname(output));
assert.ok(parent!==repo&&!parent.startsWith(repo+sep),'Refusing private output in public repository');
assert.notEqual(resolve(input),resolve(output),'Input and output must differ');
assert.ok(!existsSync(output),'Output exists; refusing overwrite');
const raw=JSON.parse(readFileSync(input,'utf8'));
const rows=Array.isArray(raw)&&raw.length===1&&Array.isArray(raw[0]?.results)?raw[0].results:
  Array.isArray(raw)&&raw.every(x=>x&&typeof x==='object'&&'guide_key' in x)?raw:
  Array.isArray(raw?.results)?raw.results:null;
assert.ok(Array.isArray(rows)&&rows.length===2,'Expect precisely two guide records');
const byKey=new Map(rows.map(r=>[r.guide_key,r]));
assert.equal(byKey.size,2,'Duplicate B5 key');
for(const key of ['B5_DAMAGED','B5_DATA_CHANGE']){
 const item=byKey.get(key);
 assert.ok(item&&item.route==='B5_EXISTING_CRDS','Wrong route or missing key');
 assert.ok(typeof item.script_js==='string'&&item.script_js.length>500,'Guide script missing');
}
const script=byKey.get('B5_DAMAGED').script_js;
assert.equal(script,byKey.get('B5_DATA_CHANGE').script_js,'Expected matching shared scripts');
assert.ok(script.includes('statutul digital UKVI (eVisa)'),'Expected prior five-change UK draft');
assert.ok(!script.includes('5 octombrie 2026'),'Unapproved verification date present');

const begin='const checklist=[{name:isCountryChange?';
const marker="}].map(d=>"+String.fromCharCode(96)+'<div class="personal-check">';
const i=script.indexOf(begin),j=script.indexOf(marker,i+begin.length);
assert.ok(i>=0&&j>i&&script.indexOf(begin,i+1)<0&&script.indexOf(marker,j+1)<0,
 'Old checklist changed; refusing blind patch');
const newChecklist=[
 "const hasRomanianId=Boolean(docs.ROMANIAN_ID||docs.CEI);",
 "const checklist=[",
 " {name:'Pașaportul CRDS anterior',status:mode==='DAMAGED'?'deteriorat':mode==='DATA_CHANGE'?'date schimbate':'de verificat',tone:'warn',note:mode==='DAMAGED'?'Păstrează și prezintă documentul deteriorat dacă mai poate fi identificat. Nu este confirmat ca valabil pentru călătorie.':'Nu presupune că documentul anterior poate fi folosit după schimbarea datelor de identificare.'},",
 " {name:'Dovada actuală din '+cfg.name,status:proofOk?'de verificat':'neconfirmată',tone:proofOk?'neutral':'warn',note:cfg.proof+' Documentul concret și traducerea se confirmă la consulat.'},",
 " {name:'Certificatul românesc de naștere',status:'de pregătit',tone:'neutral',note:'Pregătește originalul și verifică să corespundă datelor din cerere.'},",
 " ...((mode==='DATA_CHANGE'||a.civil_change==='YES')?[{name:'Acte românești privind schimbarea datelor',status:civilOk?'de prezentat':'de actualizat',tone:civilOk?'neutral':'warn',note:civilOk?'Pregătește originalele care justifică numele sau datele actuale, după caz.':'Înregistrează sau confirmă schimbarea în actele românești înainte de solicitarea noului pașaport.'}]:[]),",
 " {name:'Carte de identitate românească (dacă există)',status:hasRomanianId?'de verificat':'dacă există',tone:'neutral',note:'Prezintă actul dacă îl ai; cerința exactă se verifică la consulat.'},",
 " {name:'Dovada achitării taxei',status:'de pregătit',tone:'neutral',note:'Verifică suma, modalitatea de plată și dovada necesară la consulatul ales.'}",
 "]"
].join('\n');
const rewritten=script.slice(0,i)+newChecklist+script.slice(j+2);
const dollar=String.fromCharCode(36);
const oldClass='class="pc-status '+dollar+"{d.ok?'ok':'warn'}"+'"';
const newClass='class="pc-status '+dollar+"{d.tone||'neutral'}"+'"';
assert.equal(rewritten.split(oldClass).length,2,'Checklist status markup changed');
const revised=rewritten.replace(oldClass,newClass);
assert.ok(revised.includes('Certificatul românesc de naștere'));
assert.ok(revised.includes('Pașaportul CRDS anterior'));
assert.ok(!revised.includes('5 octombrie 2026'));
writeFileSync(output,JSON.stringify([{results:rows.map(row=>({
 guide_key:row.guide_key,route:row.route,script_js:revised
}))}]),{flag:'wx',mode:0o600});
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
console.log('PRIVATE B5 CHECKLIST DRAFT: two matching scripts; one checklist block and one status-style replacement. D1 unchanged.');
console.log('Base SHA-256: '+hash(script));
console.log('Draft SHA-256: '+hash(revised));
console.log('Sale approval remains NO.');
