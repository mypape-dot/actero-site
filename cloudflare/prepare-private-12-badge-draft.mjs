// ActeRO: prepare an EXACT, private, UNDEPLOYED editorial wording draft.
// No D1 updates, network access, approval or public premium content.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import {dirname,resolve,isAbsolute,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {inspectPrivateExport,EXPECTED} from './private-12-guide-preflight-local.mjs';

export const SOURCE_CLAIM='Procedură verificată';
export const NEUTRAL_LABEL='Ghid informativ';
export const HISTORICAL_CLAIM_NEUTRAL='Surse de consultat';
// Only B1_FR and B1_BE were confirmed by an authorized private, code-free
// diagnostic to contain this exact dated verification claim.
// Do not broaden to arbitrary dates or "verified" text.
const DATED_CLAIM_GUIDES=new Set(['B1_FR','B1_BE']);
const DATED_SOURCE_CLAIM=/Surse reverificate:\s*5 octombrie 2026/gi;
const OTHER_DATED_VERIFICATION=/Verificat.{0,80}5 octombrie 2026/i;
export function editorialReplacements(guideKey,script){
 const badgeCount=script.split(SOURCE_CLAIM).length-1;
 assert.ok(badgeCount>=1&&badgeCount<=4,'VISIBLE_CLAIM_ANCHOR_COUNT');
 const badgeOnly=script.replaceAll(SOURCE_CLAIM,NEUTRAL_LABEL);
 const matches=[...badgeOnly.matchAll(DATED_SOURCE_CLAIM)];
 if(DATED_CLAIM_GUIDES.has(guideKey)){
   assert.ok(matches.length>=1&&matches.length<=2,'DATED_CLAIM_COUNT_CHANGED');
 }else{
   assert.equal(matches.length,0,'DATE_CLAIM_UNEXPECTED_COUNTRY');
 }
 const revised=badgeOnly.replace(DATED_SOURCE_CLAIM,HISTORICAL_CLAIM_NEUTRAL);
 // A second, distinct dated claim is not authorized for automatic editing.
 assert.ok(!OTHER_DATED_VERIFICATION.test(revised),'OTHER_UNAPPROVED_DATE_CLAIM');
 assert.ok(!DATED_SOURCE_CLAIM.test(revised),'DATED_CLAIM_REMAINS');
 return {revised,badgeCount,datedCount:matches.length};
}

export function sha(value){
 return createHash('sha256').update(value,'utf8').digest('hex');
}
function d1Rows(raw){
 const rows=Array.isArray(raw)&&raw.length===1&&Array.isArray(raw[0]?.results)?raw[0].results:
   Array.isArray(raw)&&raw.every(x=>x&&typeof x==='object'&&'guide_key' in x)?raw:
   Array.isArray(raw?.results)?raw.results:null;
 assert.ok(Array.isArray(rows),'UNEXPECTED_D1_FORMAT');
 return rows;
}
export function reviseOne(row){
 assert.ok(row&&EXPECTED.has(row.guide_key),'UNEXPECTED_GUIDE_KEY');
 assert.equal(row.route,EXPECTED.get(row.guide_key).route,'GUIDE_ROUTE_MISMATCH');
 const original=row.script_js;
 assert.ok(typeof original==='string'&&original.length>=200,'SCRIPT_MISSING');
 const {revised,badgeCount,datedCount}=editorialReplacements(row.guide_key,original);
 assert.notEqual(original,revised,'NO_CHANGE');
 // The function above accepts only two literal kinds of wording edit.
 assert.ok(!revised.includes(SOURCE_CLAIM),'CLAIM_REMAINS');
 new Script(revised,{filename:'PRIVATE_DO_NOT_PRINT.js'});
 const otherClaims=[];
 if(/Surse reverificate/i.test(revised))otherClaims.push('REVIEW_OTHER_REVERIFIED_SOURCES_CLAIM');
 if(/Verificat.{0,80}5 octombrie 2026/i.test(revised))otherClaims.push('REVIEW_HISTORIC_VERIFICATION_DATE');
 return {
   draft:{guide_key:row.guide_key,route:row.route,script_js:revised},
   record:{
     guide_key:row.guide_key,source_sha256:sha(original),draft_sha256:sha(revised),
     exact_badge_replacements:badgeCount,dated_claim_replacements:datedCount,other_claim_flags:otherClaims,
     editorial_approved:false
   }
 };
}
export function preparePrivateBadgeDraft(raw){
 const rows=d1Rows(raw);
 const preflight=inspectPrivateExport(raw);
 assert.equal(preflight.structure_ok,true,'STRUCTURE_PREFLIGHT_FAILED');
 assert.equal(rows.length,EXPECTED.size,'WRONG_GUIDE_COUNT');
 const updates=rows.map(reviseOne);
 const guide_keys=updates.map(x=>x.draft.guide_key);
 assert.equal(new Set(guide_keys).size,EXPECTED.size,'DUPLICATE_KEY');
 const revisedRaw=[{results:updates.map(x=>x.draft)}];
 const revisedCheck=inspectPrivateExport(revisedRaw);
 assert.equal(revisedCheck.structure_ok,true,'DRAFT_STRUCTURE_FAILED');
 for(const entry of revisedCheck.rows)
   assert.ok(!entry.manual_signals.includes('REVIEW_UNSUPPORTED_VERIFICATION_BADGE'),
     'DRAFT_STILL_HAS_UNVERIFIED_BADGE');
 return {
  privateDraft:revisedRaw,
  report:{
   checked:updates.length,
   changed:updates.length,
   exact_badge_replacements:updates.reduce((sum,x)=>sum+x.record.exact_badge_replacements,0),
   dated_claim_replacements:updates.reduce((sum,x)=>sum+x.record.dated_claim_replacements,0),
   all_edits_exact:true,
   editorial_approved:false,
   sale_approved:false,
   guide_reviews:updates.map(x=>x.record).sort((a,b)=>a.guide_key.localeCompare(b.guide_key)),
   required_manual_checks:[
    'Confirm accurate country-specific procedures, supporting documents, translations and fees with official current sources.',
    'Verify actual visible text on Chromium and WebKit privately, including PDF links and download behavior.',
    'No Shopify purchase or Cloudflare deployment authorized by this draft.'
   ]
  }
 };
}
// Safe failure analysis: never print or return the paid guide's JavaScript,
// extracted strings, URLs, credentials, SQL results, or exception messages.
export function diagnosePrivateBadgeDraft(raw){
 let rows;
 try{rows=d1Rows(raw)}catch{return ['INPUT_FORMAT_UNRECOGNIZED']}
 const flags=[];
 if(rows.length!==EXPECTED.size)flags.push('GUIDE_COUNT_MISMATCH');
 try{
  if(!inspectPrivateExport(raw).structure_ok)
   flags.push('ORIGINAL_STRUCTURE_PREFLIGHT_FAILED');
 }catch{flags.push('ORIGINAL_STRUCTURE_PREFLIGHT_FAILED')}
 const seen=new Set();
 for(const row of rows){
  const key=typeof row?.guide_key==='string'&&EXPECTED.has(row.guide_key)
    ? row.guide_key:'UNKNOWN_GUIDE';
  if(key==='UNKNOWN_GUIDE'){flags.push('UNKNOWN_GUIDE_KEY');continue}
  if(seen.has(key)){flags.push('DUPLICATE_GUIDE_KEY');continue}
  seen.add(key);
  const errors=[];
  if(row.route!==EXPECTED.get(key).route)errors.push('ROUTE_MISMATCH');
  const code=row.script_js;
  if(typeof code!=='string'||code.length<200){
   errors.push('SOURCE_MISSING_OR_TOO_SHORT');
  }else{
   const count=code.split(SOURCE_CLAIM).length-1;
   if(count===0)errors.push('EXACT_BADGE_NOT_FOUND');
   if(count>4)errors.push('BADGE_OCCURS_MORE_THAN_FOUR_TIMES');
   try{
     const draft=editorialReplacements(key,code).revised;
     new Script(draft);
   }catch{
     const matched=[...code.matchAll(DATED_SOURCE_CLAIM)].length;
     if(DATED_CLAIM_GUIDES.has(key)){
       if(matched===0)errors.push('EXPECTED_DATED_CLAIM_MISSING');
       if(matched>2)errors.push('DATED_CLAIM_TOO_MANY');
     }else if(matched)errors.push('UNEXPECTED_DATED_CLAIM');
     const cleaned=code.replaceAll(SOURCE_CLAIM,NEUTRAL_LABEL)
       .replace(DATED_SOURCE_CLAIM,HISTORICAL_CLAIM_NEUTRAL);
     if(OTHER_DATED_VERIFICATION.test(cleaned))
       errors.push('OTHER_UNAPPROVED_DATE_CLAIM');
     if(!errors.length)errors.push('DRAFT_VALIDATION_OR_SYNTAX_FAILED');
   }
  }
  if(errors.length)flags.push(key+':'+errors.join(','));
 }
 return flags.length?flags:['UNCLASSIFIED_STOP_REQUIRES_LOCAL_REVIEW'];
}
function safePrivateOutputFolder(outdir){
 assert.ok(typeof outdir==='string'&&isAbsolute(outdir),'ABSOLUTE_PRIVATE_DIRECTORY_REQUIRED');
 assert.ok(!existsSync(outdir),'DIRECTORY_ALREADY_EXISTS');
 const repo=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
 const resolvedParent=realpathSync(dirname(outdir));
 assert.ok(resolvedParent!==repo&&!resolvedParent.startsWith(repo+sep),'PRIVATE_DATA_IN_REPO_FORBIDDEN');
 mkdirSync(outdir,{mode:0o700});
 return outdir;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let parsed=null;
 let stage='INPUT';
 try{
   if(process.argv.length!==3)throw Error('OUTPUT_DIR_ARGUMENT_REQUIRED');
   const input=readFileSync(0,'utf8');
   if(input.length>16*1024*1024)throw Error('D1_EXPORT_TOO_LARGE');
   parsed=JSON.parse(input);
   stage='EXACT_EDIT_VALIDATION';
   const result=preparePrivateBadgeDraft(parsed); // validate fully BEFORE writing any file
   stage='PRIVATE_OUTPUT_PATH';
   const outdir=safePrivateOutputFolder(process.argv[2]);
   stage='PRIVATE_FILES_WRITE';
   writeFileSync(join(outdir,'private-draft.json'),JSON.stringify(result.privateDraft),{mode:0o600,flag:'wx'});
   writeFileSync(join(outdir,'safe-summary.json'),JSON.stringify(result.report,null,2),{mode:0o600,flag:'wx'});
   console.log('PRIVATE BADGE DRAFT: '+result.report.changed+'/'+result.report.checked+
     ' guide scripts prepared; '+result.report.exact_badge_replacements+' badge substitutions; '+result.report.dated_claim_replacements+' dated-source substitutions.');
   for(const row of result.report.guide_reviews){
     console.log('DRAFT_ONLY '+row.guide_key+' | badge_edits='+row.exact_badge_replacements+
       ' | source_date_edits='+row.dated_claim_replacements+
       (row.other_claim_flags.length?' | '+row.other_claim_flags.join(','):''));
   }
   console.log('NOT FOR SALE: 0 editorial approvals, 0 Cloudflare D1 updates, 0 Shopify writes.');
   console.log('Sensitive draft stored ONLY on this Mac; do not upload private-draft.json to GitHub or chat.');
 }catch{
   // Exceptions may quote private source, so NEVER print message/stack.
   console.error('PRIVATE BADGE DRAFT BLOCKED | STAGE_'+stage);
   if(stage==='EXACT_EDIT_VALIDATION'&&parsed!==null){
     for(const code of diagnosePrivateBadgeDraft(parsed))
       console.error('SAFE_DIAGNOSTIC '+code);
   }else if(stage==='PRIVATE_OUTPUT_PATH'){
     console.error('SAFE_DIAGNOSTIC PRIVATE_OUTPUT_PATH_NOT_AVAILABLE_OR_ALREADY_EXISTS');
   }else if(stage==='PRIVATE_FILES_WRITE'){
     console.error('SAFE_DIAGNOSTIC PRIVATE_FILE_WRITE_FAILED');
   }else{
     console.error('SAFE_DIAGNOSTIC CHECK_LOCAL_INPUT_OR_WRANGLER_RESPONSE');
   }
   process.exitCode=2;
 }
}
