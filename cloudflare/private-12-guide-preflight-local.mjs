// ActeRO: local-only, READ-ONLY preflight for the 12 FR/BE/NL/IE paid scripts.
// Input from a private Cloudflare D1 SELECT, preferably piped over stdin.
// Never uploads, executes, or prints paid script contents. NO sale approval.
// This checks code shape and textual risk indicators, NOT legal accuracy.
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';

const SCRIPT_MIN_CHARS=200;
const CODES=['FR','BE','NL','IE'];
const TEMPLATES=[
  ['B1_','B1_FIRST_CRDS'],
  ['B5_RENEWAL_','B5_EXISTING_CRDS'],
  ['B5_LOST_','B5_EXISTING_CRDS']
];
export const EXPECTED=new Map(CODES.flatMap(code=>
  TEMPLATES.map(([prefix,route])=>[prefix+code,{route,country:code,scenario:prefix}])));
const SOURCE_CUES={
  FR:['PDF-Franta.pdf','pasapoarte.mai.gov.ro'],
  BE:['dofi.ibz.be','belgium.be'],
  NL:['government.nl','rijksoverheid.nl'],
  IE:['irishimmigration.ie','gov.ie']
};
const MANUAL={
 FR:'REVIEW_FR_SUBSIDIARY_EVIDENCE_RESTRICTIONS',
 BE:'REVIEW_BE_ANNEX_19_CONSULAR_ACCEPTANCE',
 NL:'REVIEW_NL_BRP_RNI_BSN_PROOF',
 IE:'REVIEW_IE_PPS_IRP_EU_STATUS'
};
function rowsOf(raw){
 const rows=Array.isArray(raw)&&raw.length===1&&Array.isArray(raw[0]?.results)?raw[0].results:
   Array.isArray(raw)&&raw.every(x=>x&&typeof x==='object'&&'guide_key' in x)?raw:
   Array.isArray(raw?.results)?raw.results:null;
 return Array.isArray(rows)?rows:null;
}
export function inspectPrivateExport(raw){
 const rows=rowsOf(raw);
 if(!rows)throw Error('UNSUPPORTED_PRIVATE_EXPORT_FORMAT');
 const output=[],seen=new Set();
 for(const item of rows){
  if(!item||typeof item!=='object'||Array.isArray(item))throw Error('INVALID_PRIVATE_ROW');
  const fields=Object.keys(item);
  if(fields.some(k=>!['guide_key','route','script_js'].includes(k)))
    throw Error('UNSAFE_EXPORT_FIELDS');
  const key=item.guide_key;
  if(typeof key!=='string'||!EXPECTED.has(key))throw Error('UNEXPECTED_GUIDE_KEY');
  if(seen.has(key))throw Error('DUPLICATE_GUIDE_KEY');
  seen.add(key);
  const entry=EXPECTED.get(key);
  const failures=[],signals=[MANUAL[entry.country],'REVIEW_ALL_DOCUMENTS_FEES_AND_LINKS'];
  if(item.route!==entry.route)failures.push('ROUTE_MISMATCH');
  const code=item.script_js;
  if(typeof code!=='string'||code.trim().length<SCRIPT_MIN_CHARS){
    failures.push('SCRIPT_EMPTY_OR_TRUNCATED');
  }else{
    try{new Script(code,{filename:'PRIVATE_GUIDE_DO_NOT_PRINT.js'});}
    catch{failures.push('SCRIPT_SYNTAX_REVIEW');}
    const lower=code.toLowerCase();
    if(!SOURCE_CUES[entry.country].some(v=>lower.includes(v.toLowerCase())))
      signals.push('REVIEW_COUNTRY_OFFICIAL_SOURCE_NOT_LOCATED');
    // An official link being present does NOT guarantee it is current or accepted.
    if(!/https?:\/\//i.test(code))signals.push('REVIEW_NO_ABSOLUTE_SOURCE_LINK');
    // Match explicit verification claims, not an unrelated date within 80 chars.
    if(/(?:Procedură verificată|Surse reverificate:\s*5 octombrie 2026|\bVerificat\s+(?:la|pe)\s*:?\s*5 octombrie 2026|\bData verificării\s*:?\s*5 octombrie 2026)/i.test(code))
      signals.push('REVIEW_UNSUPPORTED_VERIFICATION_BADGE');
    if(/(?:lorem ipsum|TODO|FIXME|de înlocuit)/i.test(code))
      signals.push('REVIEW_EDITORIAL_PLACEHOLDER');
    if(entry.country==='FR'&&key==='B1_FR'&&/Carte Vitale/i.test(code))
      signals.push('REVIEW_FR_SUBSIDIARY_PROOF_IN_FIRST_CRDS');
    if(entry.country==='BE'&&/Annex(?:e)?\s*19|Anexa 19/i.test(code))
      signals.push('REVIEW_BE_PENDING_APPLICATION_VS_APPROVED_STATUS');
    if(entry.country==='NL'&&/\bBSN\b|\bRNI\b/i.test(code))
      signals.push('REVIEW_NL_RESIDENT_VS_NONRESIDENT_EVIDENCE');
    if(entry.country==='IE'&&/\bPPS\b|\bIRP\b/i.test(code))
      signals.push('REVIEW_IE_ID_VS_RESIDENCE_EVIDENCE');
  }
  output.push({guide_key:key,structure_ok:failures.length===0,failures,manual_signals:[...new Set(signals)]});
 }
 const missing=[...EXPECTED.keys()].filter(k=>!seen.has(k));
 // Do not print private content: only public guide keys and signal identifiers.
 return {expected:EXPECTED.size,found:rows.length,
    structure_ok:missing.length===0&&rows.length===EXPECTED.size&&output.every(x=>x.structure_ok),
    missing,rows:output.sort((a,b)=>a.guide_key.localeCompare(b.guide_key))};
}
export function summaryLines(result){
 const ok=result.rows.filter(x=>x.structure_ok).length;
 return [
   'PRIVATE GUIDE PREFLIGHT: '+ok+'/'+result.expected+' scripts structurally valid; '+result.found+' rows received.',
   ...result.missing.map(x=>'MISSING '+x),
   ...result.rows.map(r=>
     (r.structure_ok?'STRUCTURE_OK ':'BLOCKED ')+r.guide_key+
     ' | '+(r.failures.length?r.failures.join(','):'REVIEW_REQUIRED')+
     ' | '+r.manual_signals.join(',')),
   'NOT APPROVED FOR SALE. Verify actual rendered steps and current Romanian consular rules privately.',
   'No premium code or personal data printed; no D1/Shopify writes.'
 ];
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);
  let input;
  if(args.length===1&&args[0]==='--stdin'){
    input=readFileSync(0,'utf8'); // pipe D1 results; no private file is created.
  }else if(args.length===1&&args[0].startsWith('/')){
    const file=realpathSync(args[0]);
    const repo=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
    if(file===repo||file.startsWith(repo+sep))throw Error('PRIVATE_INPUT_INSIDE_REPO');
    input=readFileSync(file,'utf8');
  }else throw Error('EXPECTED_STDIN_OR_ABSOLUTE_PRIVATE_PATH');
  if(input.length>16*1024*1024)throw Error('PRIVATE_EXPORT_TOO_LARGE');
  const result=inspectPrivateExport(JSON.parse(input));
  for(const line of summaryLines(result))console.log(line);
  if(!result.structure_ok)process.exitCode=2;
 }catch{
  // No exceptions/errors from script compilation can escape into console logs.
  console.error('PRIVATE PREFLIGHT BLOCKED: invalid or unsafe input. No premium source printed.');
  process.exitCode=2;
 }
}
