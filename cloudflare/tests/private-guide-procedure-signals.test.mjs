// Tests use synthetic snippets only; no actual customer or premium D1 content.
import test from 'node:test';
import assert from 'node:assert/strict';
import {assessRenderedGuide,compareViewportSignals} from '../private-guide-procedure-signals.mjs';

const body='Text pentru test sintetic de afisare. '.repeat(18);
const scan=(key,extra)=>assessRenderedGuide(key,body+' '+extra);
test('France: Carte Vitale needs manual previous-CRDS check, particularly first-time B1',()=>{
 const first=scan('B1_FR','Documente: Carte Vitale, documentul de identitate.');
 assert.ok(first.signals.includes('REVIEW_FR_SUBSIDIARY_PROOF_SCOPE'));
 assert.ok(first.signals.includes('REVIEW_FR_FIRST_CRDS_CARTE_VITALE_IN_CONTEXT'));
 const qualified=scan('B5_RENEWAL_FR','Carte Vitale doar dacă există deja un pașaport CRDS pentru Franța.');
 assert.ok(qualified.markers.includes('PREVIOUS_CRDS_CONDITION'));
 assert.ok(!qualified.signals.includes('REVIEW_FR_SUBSIDIARY_PROOF_SCOPE'));
 assert.ok(qualified.signals.includes('HUMAN_LEGAL_REVIEW_REQUIRED'));
});
test('Belgium: Annex 19 alone is not residence approval or accepted Romanian evidence',()=>{
 const risky=scan('B1_BE','Anexa 19.');
 assert.ok(risky.signals.includes('REVIEW_BE_APPLICATION_NOT_APPROVED_STATUS'));
 assert.ok(risky.signals.includes('REVIEW_BE_CONSULAR_ACCEPTANCE_UNESTABLISHED'));
 const explained=scan('B5_RENEWAL_BE','Anexa 19 este o cerere în curs de analiză. Verifică la consulat acceptarea.');
 assert.ok(explained.markers.includes('ANNEX_19'));
 assert.ok(!explained.signals.includes('REVIEW_BE_APPLICATION_NOT_APPROVED_STATUS'));
});
test('Netherlands: BSN/RNI are not interchangeable with resident BRP proof',()=>{
 const risky=scan('B1_NL','Deține doar BSN și RNI. Pentru rezidență IND 8004.');
 assert.ok(risky.signals.includes('REVIEW_NL_BSN_NOT_ADDRESS_PROOF'));
 assert.ok(risky.signals.includes('REVIEW_NL_IND8004_APPLICABILITY'));
 const clarified=scan('B5_LOST_NL','BSN poate aparține unui nerezident. RNI nu este BRP de rezident. Formular IND 8004 pentru rezidență permanentă.');
 assert.ok(!clarified.signals.includes('REVIEW_NL_BSN_NOT_ADDRESS_PROOF'));
 assert.ok(clarified.markers.includes('PERMANENT_CONDITION'));
});
test('Ireland: PPS, IRP and EUTR2 are conditional and never universal CRDS requirements',()=>{
 const risk=scan('B1_IE','PPS, IRP și EUTR2.');
 assert.ok(risk.signals.includes('REVIEW_IE_PPS_NOT_ADDRESS_PROOF'));
 assert.ok(risk.signals.includes('REVIEW_IE_IRP_EU_CITIZEN_EXCEPTION'));
 assert.ok(risk.signals.includes('REVIEW_IE_EUTR2_APPLICABILITY'));
 const explained=scan('B5_RENEWAL_IE','PPS singur nu este dovadă de domiciliu. IRP nu se cere unui cetățean român din UE. EUTR2 pentru rezidență permanentă.');
 assert.ok(!explained.signals.includes('REVIEW_IE_PPS_NOT_ADDRESS_PROOF'));
 assert.ok(!explained.signals.includes('REVIEW_IE_IRP_EU_CITIZEN_EXCEPTION'));
 assert.ok(!explained.signals.includes('REVIEW_IE_EUTR2_APPLICABILITY'));
});
test('all twelve route keys remain unapproved; diagnostics reveal no source snippets',()=>{
 const secret='PRIVATE_GUIDE_PREMIUM_DO_NOT_PRINT_1234567';
 for(const country of ['FR','BE','NL','IE'])for(const prefix of ['B1_','B5_RENEWAL_','B5_LOST_']){
   const result=scan(prefix+country,secret);
   assert.equal(result.editorial_clearance,'NO');
   assert.equal(result.consular_acceptance_verified,false);
   assert.ok(!JSON.stringify(result).includes(secret));
   assert.ok(!JSON.stringify(result).includes(body));
   assert.ok(result.signals.includes('HUMAN_LEGAL_REVIEW_REQUIRED'));
   assert.equal(compareViewportSignals(result,structuredClone(result)),true);
 }
 assert.throws(()=>scan('B1_US','Anexa 19'),/UNKNOWN_GUIDE_KEY/);
});
test('different browser signals trigger review rather than automatic pass',()=>{
 const a=scan('B1_NL','BSN');
 const b=scan('B1_NL','BSN este doar un număr; BRP este pentru rezident.');
 assert.equal(compareViewportSignals(a,b),false);
});
