// Offline read-only review aid for PRIVATE D1 guide_scripts exports.
// This never executes commercial scripts and never prints source, snippets, titles,
// customer data or links. Structural warnings are NOT editorial/legal approval.
// Usage: node cloudflare/audit-private-guides.mjs /PRIVATE/OUTSIDE/REPO/guide-scripts.json
import {readFileSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('guide-catalog.json',import.meta.url),'utf8'));
const expected=new Map(catalog.guides.map(x=>[x.key,x.route]));
const knownSharedPair=['B5_DAMAGED','B5_DATA_CHANGE'];
const KNOWN_REVIEW_CODES=[
  ['VERIFICATION_CLAIM',/verificat[ăa]?\s+la\s+\d|procedur[ăa]\s+verificat[ăa]|surse\s+oficiale\s+verificate/i],
  ['EDITORIAL_PLACEHOLDER',/\bTODO\b|\bFIXME\b|\bTBD\b|lorem\s+ipsum|text\s+de\s+completat/i],
  ['FEE_REQUIRES_CURRENT_SOURCE',/\b\d+(?:[.,]\d+)?\s*(?:EUR|EURO|RON|LEI|CHF)\b/i],
  ['UK_BRP_REFERENCE',/\bBRP\b/i],
  ['SWISS_PERMIT_CLAIM',/\b(?:permis(?:ul)?\s+[BCLG]|permit\s+[BCLG])\b/i],
];

// This is deliberately a static signal inventory, not a live URL check or a legal audit.
// Never emit the raw URLs, hostnames, guide titles or source excerpts to stdout.
const SOURCE_HOSTS=new Set([
  'pasapoarte.mai.gov.ro','dgep.mai.gov.ro','econsulat.ro','www.econsulat.ro',
  'hub.mai.gov.ro','carteadeidentitate.gov.ro','www.mai.gov.ro','mai.gov.ro',
  'www.gov.uk','gov.uk','sem.admin.ch','www.sem.admin.ch',
  'europa.eu','ec.europa.eu','eur-lex.europa.eu',
]);
function inspectStaticReferences(script){
  const matches=script.match(/https?:\/\/[^\s"'`<>\\]+/gi)||[];
  let official=0,pdf=0,other=0,http=0,placeholder=0;
  const unique=new Set();
  for(let raw of matches){
    raw=raw.replace(/[),;]+$/,'');
    if(unique.has(raw))continue;
    unique.add(raw);
    let parsed;
    try{parsed=new URL(raw)}catch{other++;continue}
    if(parsed.protocol==='http:')http++;
    if(/(?:^|\.)example\.(?:com|org|net)$|(?:^|\.)invalid$|^localhost$|^127\.0\.0\.1$/i.test(parsed.hostname)
      ||/\b(?:TODO|TBD|PLACEHOLDER)\b/i.test(parsed.pathname))placeholder++;
    if(SOURCE_HOSTS.has(parsed.hostname.toLowerCase()))official++;else other++;
    if(/\.pdf$/i.test(parsed.pathname))pdf++;
  }
  return {static_url_count:unique.size,official_domain_url_count:official,
    static_pdf_url_count:pdf,other_domain_url_count:other,
    insecure_http_url_count:http,placeholder_url_count:placeholder};
}

function safeKey(value){
  return typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(value)?value:null;
}

export function rowsFromExport(raw){
  if(Array.isArray(raw)&&raw.length===1&&Array.isArray(raw[0]?.results))return raw[0].results;
  if(Array.isArray(raw))return raw;
  if(raw&&Array.isArray(raw.results))return raw.results;
  throw Error('INVALID_PRIVATE_EXPORT');
}

// Errors and findings include only keys from the PUBLIC catalog.
export function auditPrivateGuides(rows){
  if(!Array.isArray(rows))throw Error('INVALID_PRIVATE_EXPORT');
  const found=new Map(),errors=[],warnings=[],shaToKeys=new Map(),referenceSignals=[];
  let seen=0;
  for(const row of rows){
    seen++;
    if(!row||typeof row!=='object'||Array.isArray(row)){
      errors.push({code:'INVALID_ROW',index:seen});continue;
    }
    const key=safeKey(row.guide_key);
    if(!key||!expected.has(key)){
      errors.push({code:'UNEXPECTED_OR_INVALID_KEY',index:seen});continue;
    }
    if(found.has(key)){
      errors.push({code:'DUPLICATE_KEY',key});continue;
    }
    found.set(key,true);
    if(row.route!==expected.get(key))errors.push({code:'ROUTE_MISMATCH',key});
    if(typeof row.script_js!=='string'||!row.script_js.trim()){
      errors.push({code:'SCRIPT_MISSING_OR_EMPTY',key});continue;
    }
    try{new Script(row.script_js,{filename:'private-guide.js',displayErrors:false})}
    catch{errors.push({code:'JAVASCRIPT_SYNTAX',key})}
    // SHA is computed for duplicate detection but never printed or written.
    const fp=createHash('sha256').update(row.script_js,'utf8').digest('hex');
    if(!shaToKeys.has(fp))shaToKeys.set(fp,[]);
    shaToKeys.get(fp).push(key);
    for(const [code,re] of KNOWN_REVIEW_CODES){
      if(re.test(row.script_js))warnings.push({code,key});
    }
    // Some generators construct URLs dynamically. Counts are review aids only.
    const refs=inspectStaticReferences(row.script_js);
    referenceSignals.push({key,...refs});
    if(refs.static_url_count===0)warnings.push({code:'NO_STATIC_SOURCE_URL_FOUND',key});
    if(refs.official_domain_url_count===0)warnings.push({code:'NO_KNOWN_OFFICIAL_DOMAIN_URL',key});
    if(refs.insecure_http_url_count)warnings.push({code:'INSECURE_HTTP_REFERENCE',key});
    if(refs.placeholder_url_count)warnings.push({code:'PLACEHOLDER_REFERENCE',key});
    if(refs.other_domain_url_count)warnings.push({code:'OTHER_DOMAIN_REVIEW',key});
    if(/href\s*=\s*(['"])\s*(?:javascript:|data:|#)\1/i.test(row.script_js))
      warnings.push({code:'POSSIBLE_UNSAFE_OR_PLACEHOLDER_HREF',key});
    if(/\b(?:fetch\s*\(|XMLHttpRequest\b|sendBeacon\s*\()/i.test(row.script_js))
      warnings.push({code:'GUIDE_PERFORMS_NETWORK_REQUEST_REVIEW',key});
    if(/\b(?:localStorage|sessionStorage|document\s*\.\s*cookie)\b/i.test(row.script_js))
      warnings.push({code:'GUIDE_READS_BROWSER_STATE_REVIEW',key});
  }
  for(const key of expected.keys()){
    if(!found.has(key))errors.push({code:'MISSING_KEY',key});
  }
  for(const keys of shaToKeys.values()){
    if(keys.length<=1)continue;
    const isKnown=keys.length===2&&knownSharedPair.every(k=>keys.includes(k));
    warnings.push({code:isKnown?'KNOWN_SHARED_B5_SCRIPT_CHECK_BOTH_CASES':'IDENTICAL_SCRIPTS_REVIEW_CASE_DIFFERENCES',
      keys:keys.sort()});
  }
  return {
    expected:expected.size,received:seen,matched:found.size,
    structurally_valid:errors.length===0,legal_review_completed:false,
    sale_approved:0,errors,warnings,
    reference_signals:referenceSignals.sort((a,b)=>a.key.localeCompare(b.key)),
    note:'Read-only local static scan. NO scripts executed, NO legal approval, NO production D1 writes.'
  };
}

function outsideRepo(path){
  const normalized=resolve(path);
  const rel=relative(root,normalized);
  return isAbsolute(rel)||rel==='..'||rel.startsWith('../')||rel.startsWith('..\\');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const path=process.argv[2];
  if(!path||!outsideRepo(path)){
    console.error('Use an absolute or local file path OUTSIDE the ActeRO repository. No private scripts belong in Git.');
    process.exitCode=2;
  }else{
    try{
      const raw=JSON.parse(readFileSync(resolve(path),'utf8'));
      const report=auditPrivateGuides(rowsFromExport(raw));
      console.log(JSON.stringify(report,null,2));
      if(!report.structurally_valid)process.exitCode=1;
    }catch{
      console.error('Private file could not be read or parsed. No private source printed.');
      process.exitCode=2;
    }
  }
}
