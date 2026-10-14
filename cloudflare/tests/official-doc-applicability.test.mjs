// Metadata-level audit only; no premium guide source, no legal acceptance claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const rules=JSON.parse(readFileSync(new URL('cloudflare/official-doc-applicability-audit.json',root),'utf8'));
const start=html.indexOf('const COUNTRY_OFFICIAL_DOCS={');
const end=html.indexOf('const COUNTRY_OFFICIAL_DOC_IMAGES={',start);
assert.ok(start>=0&&end>start,'Missing official doc configuration');
const block=html.slice(start,end);
function urlForCountry(code){
 const line=block.split('\n').find(l=>l.startsWith('  '+code+':{'));
 assert.ok(line,'Missing official doc reference for '+code);
 const match=/\burl:'(https:\/\/[^']+)'/.exec(line);
 assert.ok(match,'Missing official doc URL for '+code);
 return match[1];
}
test('actual frontend links match tracked official-document applicability records',()=>{
 assert.equal(rules.sales_approved,false);
 assert.deepEqual(Object.keys(rules.countries).sort(),['BE','FR','IE','NL']);
 for(const [code,cfg] of Object.entries(rules.countries)){
   assert.equal(urlForCountry(code),cfg.source_url,code+' URL changed — source review required');
   assert.equal(cfg.unconditional_application_instruction,false,code+' must not be called a default required form');
   assert.ok(cfg.review_note.length>70);
   assert.ok(cfg.status!=='APPROVED');
 }
});
test('NL and IE specialised permanent-residence applications are not labeled generic CRDS checklists',()=>{
 assert.match(rules.countries.NL.doc_role,/permanent_residence_application_form/);
 assert.match(rules.countries.IE.doc_role,/permanent_residence_certificate_application/);
 assert.equal(rules.countries.NL.status,'CONDITIONAL_FORM_NOT_DEFAULT');
 assert.equal(rules.countries.IE.status,'CONDITIONAL_FORM_NOT_DEFAULT');
 assert.match(rules.countries.BE.doc_role,/not_romania_crds_proof_list/);
 assert.match(rules.countries.FR.doc_role,/romanian_crds_country_specific_reference/);
});
test('source-preview and document-card helpers have separate semantics',()=>{
 // The frontend's miniFormPreview is a synthetic HTML illustration, not a PDF.
 assert.ok(html.includes('function miniFormPreview(title,anexa){'));
 assert.ok(html.includes('class="real-doc-page"'));
 assert.ok(html.includes('function syncOfficialDocumentsForCurrentGuide(){'));
 assert.ok(html.includes('function countryOfficialDocCard(cfg){'));
 assert.ok(html.includes('function officialPdfPageImageUrl('));
 assert.ok(html.includes('function isOfficialPdfUrl('));
 assert.ok(html.includes('ILUSTRAȚIE — NU DOCUMENT OFICIAL'));
 assert.ok(html.includes('Ilustrație orientativă, nu imaginea unui PDF oficial.'));
 assert.ok(html.includes("const conditionalResource=['BE','NL','IE'].includes(code);"));
 assert.ok(html.includes('Document de referință, cu aplicabilitate limitată'));
 assert.ok(html.includes('Nu reprezintă automat documentul de domiciliu necesar pentru pașaportul CRDS.'));
 // This check DOES NOT prove live PDF fetch, correct first-page imagery or
 // lawful applicability, which remain BLOCKED for human review.
});
