// ActeRO B5: read-only, local-only editorial risk preflight.
// This is NOT a legal accuracy certificate or a script publication mechanism.
// Never log a paid guide, customer data, file content, or a private file path.
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const REQUIRED_KEYS=['B5_DAMAGED','B5_DATA_CHANGE'];

export function verifyPrivatePair(raw){
 const rows=Array.isArray(raw)&&raw.length===1&&Array.isArray(raw[0]?.results)?raw[0].results:
   Array.isArray(raw)&&raw.every(x=>x&&typeof x==='object'&&'guide_key' in x)?raw:
   Array.isArray(raw?.results)?raw.results:null;
 if(!Array.isArray(rows)||rows.length!==2)throw Error('Expected exactly two B5 records');
 const entries=new Map(rows.map(x=>[x.guide_key,x]));
 if(entries.size!==2)throw Error('Duplicate or missing B5 key');
 for(const key of REQUIRED_KEYS){
   const item=entries.get(key);
   if(!item||item.route!=='B5_EXISTING_CRDS'||typeof item.script_js!=='string'||item.script_js.length<500)
     throw Error('B5 key, route or script validation failed');
 }
 const a=entries.get('B5_DAMAGED').script_js;
 if(a!==entries.get('B5_DATA_CHANGE').script_js)throw Error('The two B5 scripts differ');
 return a;
}

export function auditB5Text(s){
 if(typeof s!=='string')throw TypeError('Expected a guide script');
 const has=(...terms)=>terms.every(term=>s.includes(term));
 const flags=[
   {code:'UNVERIFIED_REVIEW_CLAIMS',ok:!/Procedură verificată|Surse reverificate:\s*5 octombrie 2026|Verificat<\/b><span>5 octombrie 2026/.test(s)},
   {code:'DAMAGED_PASSPORT_WARNING',ok:has('Pașaportul CRDS anterior','deteriorat','dacă mai poate fi identificat')},
   {code:'ROMANIAN_CIVIL_REGISTRATION',ok:has('actele de stare civilă românești','de actualizat')},
   {code:'GRANULAR_CONDITIONAL_CHECKLIST',ok:has('Certificatul românesc de naștere','Carte de identitate românească (dacă există)','Dovada achitării taxei')},
   {code:'RESIDENCE_EVIDENCE_NOT_AUTO_APPROVED',ok:has('Documentul concret și traducerea se confirmă la consulat.','de verificat')},
   {code:'UKVI_SHARE_CODE_CAUTION',ok:has('statutul digital UKVI (eVisa)','share code','nu este automat')},
   {code:'UK_PHYSICAL_BRP_CAVEAT',ok:has('Cardurile BRP fizice au expirat')},
   {code:'CONSULAR_FEE_CONTEXT',ok:has('cererile consulare CRDS','53 EUR','Confirmă taxa la consulatul ales')},
 ];
 // Historical DGP 2022 source distinguishes a <=30-day consular-generated
 // confirmation from a (different) UKVI share code. Its CURRENT application
 // is NOT established; missing nuance signals a manual review, never an
 // automatic instruction to users or an approval for sale.
 const ukFreshnessContext=/fișa DGP.{0,240}(?:2022).{0,420}(?:30\s+de\s+zile|30\s+zile)/i.test(s)||
   /(?:confirmare|confirmări).{0,180}consular.{0,200}(?:30\s+de\s+zile|30\s+zile)/i.test(s);
 return {flags,ukFreshnessContext};
}

export function summary(audit){
 const issues=audit.flags.filter(x=>!x.ok).map(x=>x.code);
 console.log('B5 EDITORIAL PREFLIGHT: '+audit.flags.filter(x=>x.ok).length+'/'+audit.flags.length+' textual safeguards present.');
 for(const flag of audit.flags)console.log((flag.ok?'PASS ':'REVIEW ')+flag.code);
 console.log((audit.ukFreshnessContext?'PRESENT ':'REVIEW ')+'UK_DGP_2022_30_DAY_CONSULAR_CONTEXT');
 console.log('MANDATORY HUMAN REVIEW: current consular acceptance, country documents, translations, and live paid flow.');
 console.log('NOT APPROVED FOR SALE. D1 and Shopify unchanged. No private content printed.');
 return issues.length;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
   if(process.argv.length!==3)throw Error('Expected one private absolute JSON file');
   const file=realpathSync(process.argv[2]);
   const repo=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
   if(file===repo||file.startsWith(repo+sep))throw Error('Refusing guide file inside public checkout');
   const script=verifyPrivatePair(JSON.parse(readFileSync(file,'utf8')));
   const issues=summary(auditB5Text(script));
   if(issues)process.exitCode=2;
 }catch{
   console.error('B5 PREFLIGHT BLOCKED: input invalid or inaccessible. No private content displayed.');
   process.exitCode=2;
 }
}
