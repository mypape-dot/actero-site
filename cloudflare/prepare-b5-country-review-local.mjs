// Prepare, but NEVER deploy, a country-specific B5 editorial draft.
// Exact structural changes only. No network, no D1/Shopify writes, no source output.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {dirname,resolve,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPrivatePair} from './b5-editorial-preflight-local.mjs';

export const COUNTRY_NOTES={
  FR:' Notă Franța: permisul de conducere și Carte Vitale apar ca dovezi subsidiare în fișa DGP doar dacă ai deja pașaport CRDS cu domiciliul în Franța și nu poți prezenta documentele principale. Confirmă cerințele actuale la consulat.',
  BE:' Notă Belgia: anexa 19 dovedește depunerea unei cereri de înregistrare, nu aprobarea definitivă a dreptului de ședere. Verifică documentul emis de autorități și acceptarea lui pentru CRDS la consulat.',
  NL:' Notă Țările de Jos: înscrierea BRP ca rezident diferă de evidența RNI pentru nerezidenți. Un număr BSN nu dovedește singur domiciliul în Olanda. Confirmă documentul acceptat cu consulatul.',
  IE:' Notă Irlanda: numărul PPS nu dovedește singur domiciliul în Irlanda, iar IRP nu este documentul obișnuit pentru cetățeni români. Verifică dovada concretă de reședință acceptată de consulat.'
};
const TOKENS={FR:'PDF-Franta.pdf',BE:'dofi.ibz.be',NL:'government.nl',IE:'irishimmigration.ie'};
const ALL_CODES=['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH'];
function sectionBounds(script,code){
 const anchors=[];
 for(const c of ALL_CODES){
  const re=new RegExp('(?:^|[\\s,{])'+c+':\\{name:','g');
  const matches=[...script.matchAll(re)];
  assert.equal(matches.length,1,'Country anchor missing or repeated: '+c);
  anchors.push({code:c,start:matches[0].index});
 }
 const start=anchors.find(x=>x.code===code).start;
 const other=anchors.filter(x=>x.start>start).map(x=>x.start);
 return [start,other.length?Math.min(...other):script.length];
}
export function prepareCountryRevision(script){
 assert.equal(typeof script,'string');
 const insertions=[];
 for(const [code,note] of Object.entries(COUNTRY_NOTES)){
  const [start,end]=sectionBounds(script,code);
  const section=script.slice(start,end);
  assert.ok(section.includes(TOKENS[code]),'Wrong country source anchor: '+code);
  assert.ok(!section.includes(note.trim()),'Country note already applied: '+code);
  const matches=[...section.matchAll(/proof\s*:\s*'/g)];
  assert.equal(matches.length,1,'Expected exactly one quoted proof field for '+code);
  const quoteStart=start+matches[0].index+matches[0][0].length-1;
  let close=-1;
  for(let i=quoteStart+1;i<end;i++){
   if(script[i]==='\\'){i++;continue;}
   if(script[i]==="'"){close=i;break;}
  }
  assert.ok(close>quoteStart,'Unterminated proof for '+code);
  assert.ok(!note.includes("'")&&!note.includes('\\')&&!note.includes('\n'),'Unsafe note');
  insertions.push({code,position:close,note});
 }
 let revised=script;
 for(const item of [...insertions].sort((a,b)=>b.position-a.position))
   revised=revised.slice(0,item.position)+item.note+revised.slice(item.position);
 return {revised,insertions};
}
export function validateExactRevision(original,revised){
 const {revised:expected,insertions}=prepareCountryRevision(original);
 assert.equal(revised,expected,'Unexpected edits beyond four country notes');
 assert.equal(insertions.length,4);
 return 4;
}
function parseRows(raw){
 const rows=Array.isArray(raw)&&raw.length===1&&Array.isArray(raw[0]?.results)?raw[0].results:
    Array.isArray(raw)&&raw.every(x=>x&&typeof x==='object'&&'guide_key' in x)?raw:
    Array.isArray(raw?.results)?raw.results:null;
 assert.ok(Array.isArray(rows)&&rows.length===2,'Expected two B5 records');
 return rows;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [input,output]=process.argv.slice(2);
  assert.ok(input&&output&&isAbsolute(input)&&isAbsolute(output),'Two absolute private paths required');
  const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
  const source=realpathSync(input), outDir=realpathSync(dirname(output));
  assert.ok(!source.startsWith(root+sep)&&!outDir.startsWith(root+sep)&&outDir!==root,'Private sources must stay outside public checkout');
  assert.notEqual(resolve(input),resolve(output),'Never replace input');
  assert.ok(!existsSync(output),'Refusing overwrite');
  const raw=JSON.parse(readFileSync(source,'utf8'));
  const original=verifyPrivatePair(raw);
  const {revised}=prepareCountryRevision(original);
  validateExactRevision(original,revised);
  const rows=parseRows(raw).map(x=>({guide_key:x.guide_key,route:x.route,script_js:revised}));
  writeFileSync(output,JSON.stringify([{results:rows}]),{flag:'wx',mode:0o600});
  console.log('B5 COUNTRY DRAFT: four country proof notes (FR BE NL IE), 2 matching guide scripts; no unexpected edits.');
  console.log('Private output kept outside repository. NOT approved for sale. D1 and Shopify unchanged.');
 }catch{
  console.error('B5 COUNTRY DRAFT BLOCKED: input, branch shape or intended anchors need manual review. No private content printed.');
  process.exitCode=2;
 }
}