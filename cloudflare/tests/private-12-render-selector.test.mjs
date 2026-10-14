// No paid script source is included in these tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {rendererFor,diagnosticEntrypoints} from '../private-12-render-selector.mjs';
test('B1 selects only its matching national renderer',()=>{
 const text='function showB1FRValidatedGuide(){return 1;}\nfunction showB1BEValidatedGuide(){return 2;}';
 assert.deepEqual(rendererFor('B1_FR',text),{
   entrypoint:'showB1FRValidatedGuide',reason:null,mode:'FIRST_CRDS',country:'FR'
 });
 assert.equal(rendererFor('B1_NL',text).reason,'NO_KNOWN_ENTRYPOINT');
});
test('B5 renderer selector never substitutes a wrong country',()=>{
 const content='function showB5RenewalFRValidatedGuide(){}\nfunction showB5RenewalBEValidatedGuide(){}\nfunction showB5LostIEValidatedGuide(){}';
 assert.equal(rendererFor('B5_RENEWAL_FR',content).entrypoint,'showB5RenewalFRValidatedGuide');
 assert.equal(rendererFor('B5_RENEWAL_BE',content).entrypoint,'showB5RenewalBEValidatedGuide');
 assert.equal(rendererFor('B5_LOST_IE',content).entrypoint,'showB5LostIEValidatedGuide');
 const wrong='function showB5LostFRValidatedGuide(){}';
 assert.equal(rendererFor('B5_LOST_NL',wrong).reason,'NO_KNOWN_ENTRYPOINT');
});
test('ambiguous or unknown guide variants require human review',()=>{
 const s='function showB1FRValidatedGuide(){}\nfunction showB1FRVariantGuide(){}';
 assert.equal(rendererFor('B1_FR',s).reason,'AMBIGUOUS_ENTRYPOINT');
 assert.equal(rendererFor('B1_US',s).reason,'UNKNOWN_GUIDE');
 assert.equal(rendererFor('B1_FR','').reason,'EMPTY_SCRIPT');
});

test('diagnostic lists only bounded renderer identifier metadata without body text',()=>{
 const secret='PRIVATE_PREMIUM_PROCEDURE_SHOULD_NEVER_LEAK';
 const fixture='function showB5SharedGuide(){ const note="'+secret+'"; return note; }\n'+
   'const showB5PreviewGuide=()=>42;\n'+
   'function renderInternalSecret(){ return "'+secret+'"; }';
 const names=diagnosticEntrypoints(fixture);
 assert.deepEqual(names,['showB5PreviewGuide','showB5SharedGuide']);
 assert.equal(names.join(' ').includes(secret),false);
});
