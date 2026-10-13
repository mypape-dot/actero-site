// Local, read-only B5 country-specific source/nuance preflight.
// Only public evidence metadata is committed; private premium scripts stay on Mac.
// Textual cues DO NOT establish current Romanian consular acceptance or legal accuracy.
import {readFileSync,realpathSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPrivatePair} from './b5-editorial-preflight-local.mjs';

const sourceFile=resolve(dirname(fileURLToPath(import.meta.url)),'b5-country-evidence-matrix.json');
export const evidence=JSON.parse(readFileSync(sourceFile,'utf8'));
const allCodes=['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH'];

export function inspectCountries(script, entries=evidence.countries){
 if(typeof script!=='string')throw TypeError('Expected private B5 script');
 const begins=new Map(allCodes.map(code=>[code,script.indexOf(code+':{name:')]));
 return entries.map(({code,source_token,nuance_terms,nuance_code})=>{
   const start=begins.get(code);
   if(!Number.isInteger(start)||start<0)return {code,source_present:false,nuance_present:false,nuance_code};
   const next=allCodes.map(other=>begins.get(other)).filter(i=>i>start);
   const section=script.slice(start,next.length?Math.min(...next):script.length);
   // The final country's section can include common rendering code; source check
   // remains a textual signal, not verification of the rendered DOM or link target.
   const lower=section.toLocaleLowerCase('ro');
   return {code,
     source_present:lower.includes(source_token.toLocaleLowerCase('ro')),
     nuance_present:nuance_terms.every(term=>lower.includes(term.toLocaleLowerCase('ro'))),
     nuance_code
   };
 });
}
export function formatSummary(results){
 const sourceCount=results.filter(x=>x.source_present).length;
 console.log('B5 COUNTRY SOURCE PREFLIGHT: '+sourceCount+'/'+results.length+' expected source markers present.');
 for(const result of results){
   console.log((result.source_present?'PASS ':'REVIEW ')+'COUNTRY_SOURCE_'+result.code);
   console.log((result.nuance_present?'CUE ':'REVIEW ') +result.nuance_code);
 }
 console.log('CUE means a keyword appears in the country block; not a legal-content approval.');
 console.log('FOREIGN-COUNTRY INFO IS NOT PROOF OF ROMANIAN CONSULAR ACCEPTANCE.');
 console.log('MANUAL REVIEW: exact document, conditional eligibility, translations, chosen consulate, current source version.');
 console.log('NOT APPROVED FOR SALE. No private content printed. No D1/Shopify writes.');
 return sourceCount===results.length?0:2;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try {
   if(process.argv.length!==3)throw Error('Expected private path');
   const file=realpathSync(process.argv[2]);
   const repo=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
   if(file===repo||file.startsWith(repo+sep))throw Error('Refusing private source inside checkout');
   const script=verifyPrivatePair(JSON.parse(readFileSync(file,'utf8')));
   process.exitCode=formatSummary(inspectCountries(script));
 }catch{
   console.error('B5 COUNTRY PREFLIGHT BLOCKED: private input missing, invalid or inaccessible. No content printed.');
   process.exitCode=2;
 }
}
