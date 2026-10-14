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
 const count=original.split(SOURCE_CLAIM).length-1;
 // Fail closed if the template changed or the claim appears unexpectedly often.
 assert.ok(count>=1&&count<=4,'VISIBLE_CLAIM_ANCHOR_COUNT');
 const revised=original.split(SOURCE_CLAIM).join(NEUTRAL_LABEL);
 assert.notEqual(original,revised,'NO_CHANGE');
 assert.equal(revised,original.replaceAll(SOURCE_CLAIM,NEUTRAL_LABEL),'UNEXPECTED_CONTENT_DIFF');
 assert.ok(!revised.includes(SOURCE_CLAIM),'CLAIM_REMAINS');
 new Script(revised,{filename:'PRIVATE_DO_NOT_PRINT.js'});
 const otherClaims=[];
 if(/Surse reverificate/i.test(revised))otherClaims.push('REVIEW_OTHER_REVERIFIED_SOURCES_CLAIM');
 if(/Verificat.{0,80}5 octombrie 2026/i.test(revised))otherClaims.push('REVIEW_HISTORIC_VERIFICATION_DATE');
 return {
   draft:{guide_key:row.guide_key,route:row.route,script_js:revised},
   record:{
     guide_key:row.guide_key,source_sha256:sha(original),draft_sha256:sha(revised),
     exact_badge_replacements:count,other_claim_flags:otherClaims,
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
 try{
   if(process.argv.length!==3)throw Error('OUTPUT_DIR_ARGUMENT_REQUIRED');
   const input=readFileSync(0,'utf8');
   if(input.length>16*1024*1024)throw Error('D1_EXPORT_TOO_LARGE');
   const parsed=JSON.parse(input);
   const result=preparePrivateBadgeDraft(parsed); // validate fully BEFORE writing any file
   const outdir=safePrivateOutputFolder(process.argv[2]);
   writeFileSync(join(outdir,'private-draft.json'),JSON.stringify(result.privateDraft),{mode:0o600,flag:'wx'});
   writeFileSync(join(outdir,'safe-summary.json'),JSON.stringify(result.report,null,2),{mode:0o600,flag:'wx'});
   console.log('PRIVATE BADGE DRAFT: '+result.report.changed+'/'+result.report.checked+
     ' guide scripts prepared; '+result.report.exact_badge_replacements+' exact visible-claim substitutions.');
   for(const row of result.report.guide_reviews){
     console.log('DRAFT_ONLY '+row.guide_key+' | replacements='+row.exact_badge_replacements+
       (row.other_claim_flags.length?' | '+row.other_claim_flags.join(','):''));
   }
   console.log('NOT FOR SALE: 0 editorial approvals, 0 Cloudflare D1 updates, 0 Shopify writes.');
   console.log('Sensitive draft stored ONLY on this Mac; do not upload private-draft.json to GitHub or chat.');
 }catch{
   // Exceptions could echo source code and secrets. Never print stack or message.
   console.error('PRIVATE BADGE DRAFT BLOCKED: source format, expected label, syntax or output safety check failed.');
   process.exitCode=2;
 }
}
