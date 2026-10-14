// Synthetic-only tests. Never use actual D1 guide scripts in GitHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPECTED} from '../private-12-guide-preflight-local.mjs';
import {preparePrivateBadgeDraft,diagnosePrivateBadgeDraft,reviseOne,SOURCE_CLAIM,NEUTRAL_LABEL,HISTORICAL_CLAIM_NEUTRAL,sha} from '../prepare-private-12-badge-draft.mjs';

function fixture(){
 const datedGuideSet=new Set(['B1_FR','B1_BE',
 'B5_RENEWAL_FR','B5_RENEWAL_BE','B5_RENEWAL_NL','B5_RENEWAL_IE',
 'B5_LOST_FR','B5_LOST_BE','B5_LOST_NL','B5_LOST_IE']);
 const rows=[...EXPECTED].map(([guide_key,x],i)=>{
   const source='Guide sintetic pentru '+guide_key+' '+SOURCE_CLAIM+' '+
     (datedGuideSet.has(guide_key)?'Surse reverificate: 5 octombrie 2026; ':'')+
     ('Data informativă: 5 octombrie 2026; '.repeat(
       guide_key==='B1_FR'||guide_key.startsWith('B5_LOST_')?2:1))+
     'Info '.repeat(70);
   return {guide_key,route:x.route,script_js:
     'function renderSynthetic'+i+'(){return '+JSON.stringify(source)+';}'};
 });
 return [{results:rows}];
}
test('all 12 private drafts change only the exact unsupported badge text; no approvals',()=>{
 const raw=fixture(),result=preparePrivateBadgeDraft(raw);
 assert.equal(result.report.checked,12);
 assert.equal(result.report.changed,12);
 assert.equal(result.report.exact_badge_replacements,12);
 assert.equal(result.report.dated_claim_replacements,10);
 assert.equal(result.report.all_edits_exact,true);
 assert.equal(result.report.sale_approved,false);
 assert.equal(result.report.editorial_approved,false);
 for(const [i,source] of raw[0].results.entries()){
   const updated=result.privateDraft[0].results[i];
   assert.equal(updated.guide_key,source.guide_key);
   assert.equal(updated.route,source.route);
   assert.equal(updated.script_js,source.script_js.replaceAll(SOURCE_CLAIM,NEUTRAL_LABEL)
     .replaceAll('Surse reverificate: 5 octombrie 2026',HISTORICAL_CLAIM_NEUTRAL));
   assert.equal(source.script_js.includes(SOURCE_CLAIM),true);
   assert.equal(updated.script_js.includes(SOURCE_CLAIM),false);
   const row=result.report.guide_reviews.find(r=>r.guide_key===source.guide_key);
   assert.equal(row.source_sha256,sha(source.script_js));
   assert.equal(row.draft_sha256,sha(updated.script_js));
   assert.equal(row.editorial_approved,false);
   assert.equal(row.exact_badge_replacements,1);
   assert.equal(row.dated_claim_replacements,datedGuideSet.has(source.guide_key)?1:0);
   assert.equal(updated.script_js.includes('Data informativă: 5 octombrie 2026'),true);
 }
 assert.ok(!JSON.stringify(result.report).includes('renderSynthetic'));
});
test('unknown, duplicate, missing, wrong route, or unexpected fields fail before writing',()=>{
 const wrong=fixture();wrong[0].results[0].route='B1_FIRST_CRDS_NO';
 assert.throws(()=>preparePrivateBadgeDraft(wrong),/STRUCTURE_PREFLIGHT_FAILED/);
 const duplicate=fixture();duplicate[0].results[1].guide_key=duplicate[0].results[0].guide_key;
 assert.throws(()=>preparePrivateBadgeDraft(duplicate));
 const missing=fixture();missing[0].results.pop();
 assert.throws(()=>preparePrivateBadgeDraft(missing));
 const unexpected=fixture();unexpected[0].results[0].personal_data='should-not-export';
 assert.throws(()=>preparePrivateBadgeDraft(unexpected));
});
test('fail closed on zero or too many badge occurrences and on invalid JavaScript',()=>{
 const f=fixture()[0].results[0];
 assert.throws(()=>reviseOne({...f,script_js:f.script_js.replaceAll(SOURCE_CLAIM,NEUTRAL_LABEL)}),/VISIBLE_CLAIM_ANCHOR_COUNT/);
 const repeated=' '+SOURCE_CLAIM.repeat(5);
 assert.throws(()=>reviseOne({...f,script_js:'function x(){return '+JSON.stringify('intro '+repeated+' '.repeat(300))+';}'}),/VISIBLE_CLAIM_ANCHOR_COUNT/);
 assert.throws(()=>reviseOne({...f,script_js:'function ( {'+SOURCE_CLAIM.repeat(4)+' '.repeat(300)}));
});
test('unapproved historical source-date claims cannot slip through under a neutral badge',()=>{
 const raw=fixture();
 const row=raw[0].results.find(x=>x.guide_key==='B1_NL');
 row.script_js=row.script_js.replace('Info '.repeat(70),
   'Surse reverificate: 5 octombrie 2026; '+'Info '.repeat(65));
 assert.throws(()=>preparePrivateBadgeDraft(raw),/DATE_CLAIM_UNEXPECTED_COUNTRY/);
});

test('failed real-guide draft reports only allowlisted diagnostic codes',()=>{
 const secret='PAID_PRIVATE_SCRIPT_SECRET_TEST_VALUE';
 const raw=fixture();
 const first=raw[0].results.find(r=>r.guide_key==='B1_FR');
 first.script_js=first.script_js.replace(SOURCE_CLAIM,NEUTRAL_LABEL)+secret;
 const second=raw[0].results.find(r=>r.guide_key==='B5_LOST_IE');
 second.script_js=second.script_js.replace('Info '.repeat(70),
    'Surse reverificate: 5 octombrie 2026 '+'Info '.repeat(65));
 const flags=diagnosePrivateBadgeDraft(raw);
 assert.ok(flags.includes('B1_FR:EXACT_BADGE_NOT_FOUND'));
 assert.ok(flags.some(flag=>flag.startsWith('B5_LOST_IE:')&&flag.includes('EXPECTED_EXACTLY_ONE_DATED_CLAIM')));
 assert.ok(!JSON.stringify(flags).includes(secret));
 assert.ok(!JSON.stringify(flags).includes('renderSynthetic'));
 assert.ok(flags.every(item=>/^[A-Z0-9_:,]+$/.test(item)));
});
test('success case never outputs private source as diagnostic',()=>{
 const result=diagnosePrivateBadgeDraft(fixture());
 assert.deepEqual(result,['UNCLASSIFIED_STOP_REQUIRES_LOCAL_REVIEW']);
});

test('ten confirmed country variants neutralize one exact source claim, preserving unrelated dates',()=>{
 const rows=fixture()[0].results;
 for(const key of datedGuideSet){
   const row=rows.find(r=>r.guide_key===key);
   assert.equal(row.script_js.includes('Surse reverificate: 5 octombrie 2026'),true);
   const result=reviseOne(row);
   assert.equal(result.record.dated_claim_replacements,1);
   assert.equal(result.draft.script_js.includes('Surse reverificate:'),false);
   assert.ok(result.draft.script_js.includes('Surse de consultat'));
 }
 const extra=rows.find(x=>x.guide_key==='B1_FR');
 const changed=extra.script_js.replace('Info '.repeat(70),
   'Verificat la 5 octombrie 2026; '+'Info '.repeat(60));
 assert.throws(()=>reviseOne({...extra,script_js:changed}),/OTHER_EXPLICIT_VERIFICATION_REQUIRES_REVIEW/);
});

test('other incidental date mentions remain byte-for-byte unchanged',()=>{
 const src=fixture()[0].results.find(x=>x.guide_key==='B1_IE');
 const result=reviseOne(src);
 assert.equal(result.record.dated_claim_replacements,0);
 assert.equal(result.draft.script_js,
   src.script_js.replaceAll('Procedură verificată','Ghid informativ'));
 assert.equal((result.draft.script_js.match(/Data informativă: 5 octombrie 2026/g)||[]).length,1);
});
test('unexpected historical-source count fails closed, even in approved set',()=>{
 const source=fixture()[0].results.find(x=>x.guide_key==='B5_LOST_NL');
 const duplicate=source.script_js.replace('Info '.repeat(70),
    'Surse reverificate: 5 octombrie 2026; '+'Info '.repeat(70));
 assert.throws(()=>reviseOne({...source,script_js:duplicate}),/DATED_CLAIM_COUNT_CHANGED/);
});
