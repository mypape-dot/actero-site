// Synthetic-only tests; DO NOT import actual D1 guide scripts into GitHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPECTED,inspectPrivateExport,summaryLines} from '../private-12-guide-preflight-local.mjs';

const url={
 FR:'https://pasapoarte.mai.gov.ro/wp-content/uploads/2022/07/PDF-Franta.pdf',
 BE:'https://dofi.ibz.be/en/news/changes-residence-applications-eu-citizens',
 NL:'https://www.government.nl/documents/question-and-answer/when-should-i-register-with-the-personal-records-database-as-a-resident',
 IE:'https://www.gov.ie/en/department-of-social-protection/services/get-a-personal-public-service-pps-number/'
};
function fixture(){
 return {results:[...EXPECTED].map(([guide_key,route],i)=>({
  guide_key,route:route.route,
  script_js:'function syntheticGuide'+i+'(){return '+JSON.stringify(
    'Fixture about country source '+url[route.country]+' '.repeat(250))+';}'
 }))};
}
test('all 12 private guide shapes can be checked without running code',()=>{
 const r=inspectPrivateExport(fixture());
 assert.equal(r.expected,12);
 assert.equal(r.found,12);
 assert.equal(r.structure_ok,true);
 assert.equal(r.rows.length,12);
 assert.ok(r.rows.every(x=>x.manual_signals.includes('REVIEW_ALL_DOCUMENTS_FEES_AND_LINKS')));
 assert.ok(summaryLines(r).at(-2).includes('NOT APPROVED FOR SALE'));
});
test('refuses duplicate, missing, extra guide, bad route or unsafe fields',()=>{
 const a=fixture();a.results.push({...a.results[0]});
 assert.throws(()=>inspectPrivateExport(a),/DUPLICATE_GUIDE_KEY/);
 const b=fixture();b.results.pop();
 assert.equal(inspectPrivateExport(b).structure_ok,false);
 const c=fixture();c.results[0].guide_key='B1_US';
 assert.throws(()=>inspectPrivateExport(c),/UNEXPECTED_GUIDE_KEY/);
 const d=fixture();d.results[0].route='UNKNOWN';
 assert.equal(inspectPrivateExport(d).rows.find(x=>x.guide_key==='B1_FR').failures[0],'ROUTE_MISMATCH');
 const e=fixture();e.results[0].email='private@example.test';
 assert.throws(()=>inspectPrivateExport(e),/UNSAFE_EXPORT_FIELDS/);
});
test('syntax errors and unsupported verification claims are signalled without leaking guide content',()=>{
 const a=fixture(),secret='DO_NOT_LOG_PRIVATE_GUIDE_CONTENT';
 a.results[0].script_js='function ??? '+secret+' '.repeat(50);
 const row=a.results.find(x=>x.guide_key==='B1_FR');
 row.script_js='function broken( { '+secret.repeat(12);
 const r=inspectPrivateExport(a),lines=summaryLines(r).join('\n');
 assert.equal(r.structure_ok,false);
 assert.ok(lines.includes('SCRIPT_SYNTAX_REVIEW'));
 assert.ok(!lines.includes(secret));
 const b=fixture();
 b.results.find(x=>x.guide_key==='B1_FR').script_js=
   'function guide(){return "Procedură verificată; Carte Vitale; '+url.FR+'; '+ 'test editorial '.repeat(25)+'";}';
 const second=inspectPrivateExport(b);
 const warnings=second.rows.find(x=>x.guide_key==='B1_FR').manual_signals;
 assert.ok(warnings.includes('REVIEW_UNSUPPORTED_VERIFICATION_BADGE'));
 assert.ok(warnings.includes('REVIEW_FR_SUBSIDIARY_PROOF_IN_FIRST_CRDS'));
});
test('recognized wrapper format matches Cloudflare wrangler JSON',()=>{
 const f=fixture();
 assert.equal(inspectPrivateExport([f]).found,12);
 assert.equal(inspectPrivateExport(f.results).found,12);
});

test('differentiate explicit dated verification claims from unrelated nearby calendar dates',()=>{
 const f=fixture();
 const row=f.results.find(x=>x.guide_key==='B1_NL');
 const make=x=>'function sample(){return '+JSON.stringify(
   x+' ; '+url.NL+' '+('context '.repeat(45)))+';}';
 row.script_js=make('Acest document a fost verificat ca format. Data informativă: 5 octombrie 2026');
 let flags=inspectPrivateExport(f).rows.find(x=>x.guide_key==='B1_NL').manual_signals;
 assert.ok(!flags.includes('REVIEW_UNSUPPORTED_VERIFICATION_BADGE'));
 row.script_js=make('Verificat la 5 octombrie 2026');
 flags=inspectPrivateExport(f).rows.find(x=>x.guide_key==='B1_NL').manual_signals;
 assert.ok(flags.includes('REVIEW_UNSUPPORTED_VERIFICATION_BADGE'));
 row.script_js=make('Surse reverificate: 5 octombrie 2026');
 flags=inspectPrivateExport(f).rows.find(x=>x.guide_key==='B1_NL').manual_signals;
 assert.ok(flags.includes('REVIEW_UNSUPPORTED_VERIFICATION_BADGE'));
});
