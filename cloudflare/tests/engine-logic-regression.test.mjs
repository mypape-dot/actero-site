// ActeRO engine audit regressions: execute the questionnaire functions from the actual public HTML.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
function extract(name,next){
  const start=html.indexOf('function '+name+'(');
  const end=html.indexOf('\nfunction '+next+'(',start+1);
  assert.ok(start>=0&&end>start,'Cannot extract '+name+' -> '+next);
  return html.slice(start,end);
}
// Urgent-travel answers now continue through urgentCardStep() (M-04, 16.10), which uses the one validity model.
const URGENT_HELPERS=['docState','docValid','travelCardOf','urgentUnknownDocOf','urgentCardStep'].map(n=>{
  const start=html.indexOf('\nfunction '+n+'(')+1,end=html.indexOf('\nfunction ',start);
  assert.ok(start>0&&end>start,'Cannot extract '+n);return html.slice(start,end)}).join('\n');
function choice(name,next,answers={}){
  const S={answers:{...answers},docs:{},route:null};
  let config;
  vm.runInNewContext(URGENT_HELPERS+'\n'+extract(name,next)+'\n'+name+'();',{S,choose:c=>{config=c}},{timeout:1000});
  assert.ok(config?.next,'Missing routing callback: '+name);
  return {S,config};
}

test('L-01 travel location is not mistaken for travel destination',()=>{
  const {S,config}=choice('q020','q030',{goal:'URGENT_TRAVEL'});
  assert.equal(config.next('YES'),'Q030','Person in Romania still needs destination question');
  S.answers.physical='YES';
  assert.equal(config.next('NO'),'Q030');
  const travel=choice('q030','q031',{physical:'YES'});
  assert.equal(travel.config.next('ROMANIA'),'STOP_TRAVEL_ALREADY_RO');
  assert.equal(travel.config.next('OTHER'),'Q031','Outbound urgent travel stays available');
  const outbound=choice('q030','q031',{physical:'NO'});
  assert.equal(outbound.config.next('ROMANIA'),'RESULT');
  assert.equal(outbound.S.route,'TRAVEL_TITLE_RETURN_RO');
});

test('L-04 orientation to urgent travel reuses the valid-passport contradiction check',()=>{
  const {S,config}=choice('q050','q051',{goal:'UNKNOWN'});
  assert.equal(config.next('TRAVEL'),'AFTER_DOCS');
  assert.equal(S.answers.goal,'URGENT_TRAVEL');
  const calls=[];
  vm.runInNewContext(extract('afterDocs','q007')+'\nafterDocs();',{
    S:{answers:S.answers,docs:{PASSPORT:'VALID'}},
    showStop:(...args)=>calls.push(['stop',...args]),
    push:id=>calls.push(['push',id])
  },{timeout:1000});
  assert.equal(calls[0]?.[0],'stop','A valid passport must trigger a contradiction');
});

test('L-02 unresolved UNKNOWN never becomes cleared merely because it was answered',()=>{
  const S={unknowns:['Trebuie clarificat certificatul de naștere.'],clarified:{Q103:1}};
  const pending=vm.runInNewContext(extract('pendingUnknowns','hasValidatedPaidGuide')+'\npendingUnknowns();',{S},{timeout:1000});
  assert.equal(pending.length,1);
  assert.match(html,/const hasCriticalUnknowns=pending\.length>0;/);
  assert.match(html,/const target=pending\.map\(/,'Avoid repeatedly asking an already-UNKNOWN question');
});

test('L-05 Back restores the full clarification state',()=>{
  const S={answers:{},docs:{},route:null,status:null,blockers:[],unknowns:[],
    docQueue:[],docIndex:0,current:'Q103',clarified:{Q103:1}};
  const ctx={S,clone:x=>JSON.parse(JSON.stringify(x))};
  const fns=vm.runInNewContext(extract('snapshot','restore')+'\n'+extract('restore','push')+'\n({snapshot,restore});',ctx,{timeout:1000});
  const saved=fns.snapshot();
  S.clarified.Q103=0;S.clarified.Q108=1;
  fns.restore(saved);
  assert.equal(S.clarified.Q103,1);
  assert.equal(S.clarified.Q108,undefined);
});

test('L-06 deselected documents do not retain stale statuses',()=>{
  const S={answers:{documents:['ROMANIAN_ID']},docs:{ROMANIAN_ID:'VALID',PASSPORT:'EXPIRED'},
    docQueue:[],docIndex:0};
  const screen={innerHTML:''},continueBtn={classList:{remove(){}},disabled:true,onclick:null};
  const pushed=[],ctx={S,screen,continueBtn,setChrome(){},header(){return'<div>'},
    optionHTML(){return'<div>'},bindOptions(){},push:x=>pushed.push(x)};
  vm.runInNewContext(extract('q005','q006')+'\nq005();',ctx,{timeout:1000});
  continueBtn.onclick();
  assert.deepEqual(Object.keys(S.docs),['ROMANIAN_ID']);
  assert.equal(S.docs.PASSPORT,undefined);
  assert.equal(pushed[0],'Q006');
});

test('Rapid repeated taps cannot advance the standard question more than once',()=>{
  const S={current:'Q002',answers:{},clarified:{}}, transitions=[];
  let onChoice;
  const el={classList:{add(){},remove(){}}};
  const ctx={S,screen:{innerHTML:''},setChrome(){},header:()=>'<div>',
    optionHTML:()=>'<div>',bindOptions:fn=>{onChoice=fn},
    document:{querySelectorAll:()=>[el]},updateDebug(){},updateCaseSide(){},
    setTimeout:fn=>fn(),push:id=>transitions.push(id)};
  vm.runInNewContext(extract('choose','showStop')+
    "\nchoose({title:'Test',opts:[{value:'A',label:'A'}],key:'answer',next:'Q004'});",ctx,{timeout:1000});
  onChoice('A',el);onChoice('A',el);
  assert.deepEqual(transitions,['Q004']);
});

test('Rapid country taps cannot send the user to multiple branches',()=>{
  const S={answers:{}},transitions=[];
  const countries=[{code:'IT',name:'Italia'},{code:'CH',name:'Elveția'}];
  const els=countries.map(c=>({dataset:{code:c.code},onclick:null}));
  const list={innerHTML:'',querySelectorAll:()=>els};
  const input={value:'',oninput:null};
  const ctx={S,countries,screen:{innerHTML:''},setChrome(){},
    header:()=>'<div>',flagEmoji:()=>'',persistCase(){},
    $:id=>id==='countryList'?list:input,setTimeout:fn=>fn(),
    push:id=>transitions.push(id)};
  vm.runInNewContext(extract('q003','q004')+'\nq003();',ctx,{timeout:1000});
  els[0].onclick();els[1].onclick();
  assert.equal(S.answers.residence_country,'IT');
  assert.deepEqual(transitions,['Q004']);
});
