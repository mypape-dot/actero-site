// Shared harness for the ActeRO questionnaire engine tests.
// Runs the REAL inline application script from index.html in a Node vm with a minimal fake DOM.
// Synthetic answers only: no premium guide code, no D1 export, no network, no secrets.
// INDEX=/path/to/index.html overrides the file under test.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
export const INDEX=process.env.INDEX||path.resolve(here,'../../../index.html');
export const COUNTRIES=['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH'];

export function loadEngine(){
  const html=readFileSync(INDEX,'utf8');
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!/src=/.test(m[1]));
  const src=scripts.sort((a,b)=>b[2].length-a[2].length)[0][2];
  const elements=new Map();
  const CODES=[...COUNTRIES,'OTHER'];
  const mk=id=>{const el={id,innerHTML:'',textContent:'',style:{},dataset:{},disabled:false,onclick:null,value:'',
    classList:{add(){},remove(){},toggle(){},contains(){return false}},querySelectorAll(){return []},querySelector(){return null},
    appendChild(){},remove(){},addEventListener(){},setAttribute(){},removeAttribute(){},focus(){},closest(){return null}};
    if(id==='countryList')el.querySelectorAll=()=>{el._items=CODES.map(code=>({dataset:{code},onclick:null}));return el._items};
    return el};
  const $el=id=>{if(!elements.has(id))elements.set(id,mk(id));return elements.get(id)};
  const store=new Map();
  const ctx=vm.createContext({
    window:{ACTERO_PAYMENT_API:'',addEventListener(){},location:{search:'',href:'https://example.test/index.html',assign(){}},
      crypto:{randomUUID:()=>'00000000-0000-4000-8000-000000000000'},open(){}},
    document:{getElementById:$el,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:()=>mk('_t'),
      head:{appendChild(){}},body:{appendChild(){}},visibilityState:'visible'},
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    console,URLSearchParams,URL,setTimeout:fn=>{fn();return 0},clearTimeout(){},MutationObserver:class{observe(){}disconnect(){}},
    navigator:{clipboard:{writeText:async()=>{}}},fetch:async()=>{throw new Error('offline')},Blob:class{}
  });
  vm.runInContext(src,ctx);
  vm.runInContext(`var __H={};setChrome=function(){};persistCase=function(){};updateDebug=function(){};updateCaseSide=function(){};
    bindOptions=function(fn){__H.opt=fn};var __rc=choose;choose=function(s){__H.spec=s;return __rc(s)};
    var __rr=render;render=function(id){__H={renderId:id};return __rr(id)};
    var __rs=showStop;showStop=function(k,t,b,m){__H.stop={kind:k,title:t,body:b};return __rs(k,t,b,m)};`,ctx);
  return {ctx,$el,html,source:src};
}

// Clean-case answers by question key. Every key a journey may ask must be present, so a new
// question makes the failing assertion name the missing key instead of silently passing.
export const DEFAULTS={age:'YES',citizenship:'YES',civil_change:'NO',civil_sync:'YES',birth_cert:'READY',foreign_basis:'RESIDENCE',
  foreign_proof:'YES',foreign_document_generic:'YES',current_foreign_proof:'YES',theft_proof:'YES',identity_detail:'HAS_PHOTO_DOC',
  ro_address:'OWN',host_consent:'YES',representative:'YES',poa:'YES',ro_residence:'OWN',ro_residence_proof:'YES',dependents:'NO',
  swiss_permit:'B',swiss_current_permit:'B',post_citizenship_romanian_id:'YES',citizenship_cert_available:'YES',
  local_proof_type:'PERMANENT',id_card_type:'OLD_MODEL',id_card_area:'YES',crds_history:'RETURNED',crds_confirm:'HAD_CRDS'};

function classify(html){
  if(html.includes('id="unlockResult"'))return 'PAYWALL';
  if(html.includes('data-result="no-payment"'))return 'NOPAY';
  if(html.includes('data-result="contradiction"'))return 'CONTRADICTION';
  if(html.includes('Mai desfacem un singur nod'))return 'CLARIFY';
  if(html.includes('paywall-pending'))return 'PENDING';
  if(html.includes('data-result="status"'))return 'STATUS';
  if(html.includes('Nu se încadrează la pașaport temporar'))return 'TOURISM';
  return 'OTHER';
}

// Drives the questionnaire by question key. An array answer is consumed one element per time the
// question is asked. Follows up to `maxClarifications` "Continuă clarificarea" buttons.
export function run(c,{maxClarifications=3}={}){
  const {ctx,$el}=loadEngine();
  const S=vm.runInContext('S',ctx);
  const H=()=>vm.runInContext('__H',ctx);
  const answers={...DEFAULTS,...(c.answers||{})};
  const seen=[];const visits={};const pos={};
  const val=k=>{const v=answers[k];if(Array.isArray(v)){pos[k]=(pos[k]||0);const x=v[Math.min(pos[k],v.length-1)];pos[k]++;return x}return v};
  vm.runInContext(`S.answers={};S.docs={};S.route=null;S.history=[];S.clarified={};S.autoSkip=false;S.skipTarget=null;render('Q001')`,ctx);
  let clarifications=0;const allUnknowns=[];
  const decision=()=>vm.runInContext("typeof paymentDecision==='function'?paymentDecision():null",ctx);
  const key=()=>vm.runInContext("typeof guideKeyForCurrent==='function'?guideKeyForCurrent():null",ctx);
  for(let step=0;step<100;step++){
    const cur=S.current;
    // showStop() renames S.current to STOP_RED/STOP_YELLOW; the rendered screen id names the stop.
    if(cur.startsWith('STOP_'))return {kind:'STOP',stopId:String(H().renderId||'').startsWith('STOP_')?H().renderId:cur,
      stop:(H().stop||{}).title||cur,stopBody:(H().stop||{}).body||'',
      route:S.route,seen,visits,allUnknowns,S,ctx,$el};
    if(cur==='RESULT'){
      const html=$el('screen').innerHTML;
      allUnknowns.push(...S.unknowns);
      if(html.includes('id="clarifyNow"')&&clarifications<maxClarifications){clarifications++;$el('clarifyNow').onclick();continue}
      return {kind:classify(html),html,route:S.route,status:S.status,blockers:[...S.blockers],codes:[...(S.blockerCodes||[])],
        unknowns:[...S.unknowns],notes:[...(S.notes||[])],key:key(),decision:decision(),seen,visits,allUnknowns,S,ctx,$el};
    }
    visits[cur]=(visits[cur]||0)+1;seen.push(cur);
    if(visits[cur]>4)return {kind:'LOOP',at:cur,seen,visits,allUnknowns,S,ctx,$el};
    if(cur==='Q003'){$el('countryList')._items.find(x=>x.dataset.code===c.country).onclick();continue}
    if(cur==='Q005'){S.answers.documents=[...(c.documents||[])];vm.runInContext(`render('Q005')`,ctx);$el('continue').onclick();continue}
    if(cur==='Q006'){const d=S.docQueue[S.docIndex];const st=(c.statuses||{})[d];assert.ok(st,'missing status for '+d);H().opt(st);continue}
    const spec=H().spec;assert.ok(spec&&H().opt,'no question rendered at '+cur+'; path '+seen.join('>'));
    const v=val(spec.key);
    assert.notEqual(v,undefined,`case ${c.id||'?'}: no answer for ${spec.key} (${cur}); path ${seen.join('>')}`);
    if(!spec.opts.some(o=>o.value===v))return {kind:'OPTION_MISSING',at:cur,key:spec.key,value:v,options:spec.opts.map(o=>o.value),seen,visits,allUnknowns,S,ctx,$el};
    H().opt(v,{classList:{add(){}}});
  }
  return {kind:'DEPTH',seen,visits,allUnknowns,S,ctx,$el};
}

// Evaluates the pure engine functions directly on a synthetic case, without walking the screens.
export function evaluate(input){
  const {ctx}=loadEngine();
  ctx.__input=JSON.parse(JSON.stringify(input));
  // JSON round-trip: plain host objects, so deepEqual does not trip over the vm realm.
  return {
    ev:JSON.parse(vm.runInContext('JSON.stringify(evaluateCase(__input))',ctx)),
    decision:JSON.parse(vm.runInContext('JSON.stringify(paymentDecisionFor(__input))',ctx)),
    ctx
  };
}
