// Run: node --test cloudflare/tests/quiz-history.test.mjs
// Replays real q006() / afterDocs() from public questionnaire, without premium guide text.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
function extract(name,next){
  const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction '+next+'(',start+1);
  assert.ok(start>=0&&end>start,'Missing function '+name);
  return html.slice(start,end);
}
function fixture(){
 const S={current:'Q006',answers:{goal:'ID_PROBLEM',documents:['PASSPORT']},docs:{},
   docQueue:['PASSPORT','ROMANIAN_ID'],docIndex:0,history:[]};
 const calls=[],ctx={S,screen:{innerHTML:''},
   setChrome(){},header:()=>'<div>',optionHTML:()=>'<options>',
   docLabels:{PASSPORT:'pașaportul',ROMANIAN_ID:'buletinul'},
   statusLabels:{VALID:'valabil',EXPIRED:'expirat',EXPIRING:'în expirare',LOST:'pierdut',
     STOLEN:'furat',DAMAGED:'deteriorat',MISSING:'lipsă',UNKNOWN:'necunoscut'},
   snapshot:()=>({current:S.current,docs:{...S.docs},docIndex:S.docIndex,docQueue:[...S.docQueue]}),
   replace:id=>{calls.push({kind:'replace',id});S.current=id},
   push:id=>{calls.push({kind:'push',id});S.current=id},
   showStop:(...args)=>calls.push({kind:'stop',args}),
   bindOptions:fn=>{ctx.choose=fn}
 };
 const q006=vm.runInNewContext(extract('q006','afterDocs')+'\nq006;',ctx);
 const afterDocs=vm.runInNewContext(extract('afterDocs','q007')+'\nafterDocs;',ctx);
 return {S,calls,ctx,q006,afterDocs};
}
test('each document answer records a reversible snapshot',()=>{
 const h=fixture();
 h.q006();h.ctx.choose('VALID');
 assert.equal(h.S.docIndex,1);
 assert.equal(h.S.history.length,1);
 assert.deepEqual(Object.keys(h.S.docs),['PASSPORT']);
 assert.equal(h.calls.at(-1).id,'Q006');
 h.q006();h.ctx.choose('EXPIRED');
 assert.equal(h.S.docIndex,2);
 assert.equal(h.S.history.length,2);
 assert.equal(h.calls.at(-1).kind,'replace');
 assert.equal(h.calls.at(-1).id,'AFTER_DOCS');
 const previous=h.S.history.pop();
 h.S.docs=previous.docs;h.S.docIndex=previous.docIndex;h.S.current=previous.current;
 assert.equal(h.S.docIndex,1);
 assert.equal(h.S.docs.PASSPORT,'VALID');
 assert.equal(h.S.docs.ROMANIAN_ID,undefined);
});
test('last document does not add a duplicate AFTER_DOCS history entry',()=>{
 const h=fixture();h.S.docQueue=['PASSPORT'];
 h.q006();h.ctx.choose('MISSING');
 assert.equal(h.S.history.length,1);
 assert.deepEqual(h.calls,[{kind:'replace',id:'AFTER_DOCS'}]);
});
test('urgent-travel route checks destination before rejecting a valid Romanian ID',()=>{
 const h=fixture();h.S.answers.goal='URGENT_TRAVEL';
 h.S.docs={ROMANIAN_ID:'VALID',PASSPORT:'MISSING'};
 h.afterDocs();
 assert.deepEqual(h.calls,[{kind:'push',id:'Q020'}]);
});
test('urgent travel flags contradiction when passport is actually valid',()=>{
 const h=fixture();h.S.answers.goal='URGENT_TRAVEL';
 h.S.docs={PASSPORT:'VALID'};
 h.afterDocs();
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].kind,'stop');
});
test('normal flow follows declared passport documents',()=>{
 const h=fixture();h.afterDocs();
 assert.deepEqual(h.calls,[{kind:'push',id:'Q007'}]);
});
