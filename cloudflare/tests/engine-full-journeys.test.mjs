// Full questionnaire route walks against the real ActeRO frontend source.
// Simulates customer answers but executes the actual question and route functions.
// This does not validate private D1 scripts or official legal guidance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const catalog=JSON.parse(readFileSync(new URL('../guide-catalog.json',import.meta.url),'utf8'));
const fns=[...html.matchAll(/(?:^|\n)function\s+([A-Za-z0-9_$]+)\s*\(/g)]
  .map(m=>({name:m[1],start:m.index+(m[0].startsWith('\n')?1:0)}));
const sourceByName=new Map(fns.map((f,i)=>[f.name,html.slice(f.start,fns[i+1]?.start??html.length)]));
const selected=[
  ...fns.filter(f=>/^q\d+$/.test(f.name)).map(f=>f.name),
  'afterDocs','routeCommon','domicileState','hasRomanianIdentityHistory',
  'existingCEIProblem','existingCRDSStatus','nextB5Screen','nextD1Screen',
  'identityKnown','computeResult','guideKeyForCurrent','hasValidatedPaidGuide',
  'pendingUnknowns','clarificationTarget','clarificationTargetFor','unknownish'
];
const definitions=selected.map(name=>{
  const body=sourceByName.get(name);
  assert.ok(body,'Missing ActeRO function '+name);
  return body;
}).join('\n');

const countryCodes=catalog.countries;
const base={
  age:'YES',citizenship:'YES',civil_change:'NO',
  foreign_basis:'RESIDENCE',foreign_proof:'YES',foreign_document_generic:'YES',
  birth_cert:'READY',swiss_permit:'B',swiss_current_permit:'B',
  current_foreign_proof:'YES',same_country:'YES',theft_proof:'YES',
  can_come:'YES',ro_address:'OWN',host_consent:'YES',representative:'YES',
  poa:'YES',physical:'NO',ro_residence:'OWN',ro_residence_proof:'YES',
  dependents:'NO',identity_detail:'HAS_PHOTO_DOC',
  travel_dest:'ROMANIA',travel_urgent_basis:'OBJECTIVE_URGENT',ever_crds:'NO'
};

function walk({country='IT',goal,documents=[],docStatuses={},choices={},expectedStop=null}){
  const S={answers:{},docs:{},route:null,status:null,blockers:[],unknowns:[],
    clarified:{},history:[],current:'Q001',docQueue:[],docIndex:0};
  const opts={...base,...choices,goal};
  const countries=countryCodes.map(code=>({code,name:code}));
  const input={value:'',oninput:null};
  const elements=countries.map(c=>({dataset:{code:c.code},onclick:null}));
  const list={innerHTML:'',querySelectorAll:()=>elements};
  const continueBtn={disabled:true,onclick:null,classList:{remove(){}}};
  let current='Q001',config=null,optionClick=null,next=null,stop=null;
  const history=[];
  const ctx=vm.createContext({
    S,countries,continueBtn,input,screen:{innerHTML:''},
    statusLabels:{VALID:'valabil',EXPIRED:'expirat',EXPIRING:'în expirare',LOST:'pierdut',STOLEN:'furat',DAMAGED:'deteriorat',MISSING:'lipsă',UNKNOWN:'necunoscut'},
    docLabels:{ROMANIAN_ID:'buletinul',PASSPORT:'pașaportul',CRDS_PASSPORT:'pașaportul CRDS',CEI:'cartea electronică'},
    setChrome(){},header:()=>'<div>',optionHTML:()=>'<div>',
    flagEmoji:()=>'',persistCase(){},updateCaseSide(){},updateDebug(){},
    $:id=>id==='countryList'?list:input,
    setTimeout:fn=>fn(),
    push:id=>{next=id},replace:id=>{next=id},
    snapshot:()=>({docs:{...S.docs},docIndex:S.docIndex}),
    choose:c=>{config=c},bindOptions:fn=>{optionClick=fn},
    showStop:(...args)=>{stop=args;next='STOP'}
  });
  vm.runInContext(definitions,ctx,{timeout:3000});
  for(let step=0;step<85;step++){
    history.push(current);
    if(current==='STOP'||current.startsWith('STOP_'))
      return {S,current,history,stop,offer:false,key:null};
    if(current==='RESULT'){
      ctx.computeResult();
      const unknowns=ctx.pendingUnknowns();
      if(unknowns.length){
        const target=unknowns.map(u=>ctx.clarificationTargetFor([u]))
          .find(t=>t&&!S.clarified[t]&&!history.slice(0,-1).includes(t));
        if(target){
          current=target;
          continue;
        }
        return {S,current:'UNRESOLVED',history,unknowns,offer:false,key:ctx.guideKeyForCurrent()};
      }
      return {S,current,history,unknowns,offer:ctx.hasValidatedPaidGuide(),key:ctx.guideKeyForCurrent()};
    }
    next=null;config=null;optionClick=null;
    if(current==='Q003'){
      ctx.q003();
      const target=elements.find(el=>el.dataset.code===country);
      assert.ok(target, 'Unsupported fixture country '+country);
      target.onclick();
    }else if(current==='Q005'){
      S.answers.documents=[...documents];
      ctx.q005();
      assert.equal(typeof continueBtn.onclick,'function','Missing document continue');
      continueBtn.onclick();
    }else if(current==='Q006'){
      ctx.q006();
      assert.equal(typeof optionClick,'function','Missing document status callback');
      const doc=S.docQueue[S.docIndex];
      const status=docStatuses[doc]||'VALID';
      optionClick(status);
    }else if(current==='AFTER_DOCS'){
      ctx.afterDocs();
    }else if(current==='ROUTE_COMMON'){
      ctx.routeCommon();
    }else{
      const name=current.toLowerCase();
      assert.equal(typeof ctx[name],'function','Missing question function '+current);
      ctx[name]();
      assert.ok(config,'Missing choice config at '+current);
      const value=opts[config.key];
      assert.notEqual(value,undefined,'Fixture missing '+config.key+' at '+current+'; history '+history.join(' > '));
      assert.ok(config.opts.some(o=>o.value===value),
        'Invalid '+config.key+'='+value+' at '+current);
      S.answers[config.key]=value;
      next=typeof config.next==='function'?config.next(value):config.next;
    }
    assert.ok(next,'No next step from '+current+'; history '+history.join(' > '));
    current=next;
  }
  assert.fail('Flow exceeded 85 steps: '+history.join(' > '));
}

function fixtureFor(entry){
  const c=entry.country||'IT';
  const common={country:c,goal:'EXISTING_CRDS_PROBLEM',
    documents:['CRDS_PASSPORT'],
    docStatuses:{CRDS_PASSPORT:'VALID'},
    choices:{passport_domicile:'CURRENT'}};
  if(entry.key.startsWith('B1_'))return {
    country:c,goal:'ESTABLISH_FOREIGN_DOMICILE',
    documents:['PASSPORT'],docStatuses:{PASSPORT:'VALID'},
    choices:{passport_domicile:'ROMANIA'}
  };
  if(entry.key.startsWith('B5_')){
    const which=entry.scenario;
    if(which==='renewal'||which==='lost'){
      common.docStatuses.CRDS_PASSPORT=which==='renewal'?'EXPIRED':'LOST';
    }else if(which==='stolen'){
      common.docStatuses.CRDS_PASSPORT='STOLEN';
    }else if(which==='damaged'){
      common.docStatuses.CRDS_PASSPORT='DAMAGED';
    }else if(which==='data_change'){
      common.choices.b5case='DATA_CHANGE';
    }else if(which==='new_country'){
      common.choices.b5case='COUNTRY_CHANGE';
    }
    if(which==='new_country')common.choices.same_country='NO';
    return common;
  }
  const rest={
    A1_PERSONAL_ROMANIA:{goal:'ID_PROBLEM',documents:['PASSPORT'],docStatuses:{PASSPORT:'VALID'},choices:{passport_domicile:'ROMANIA'}},
    A2_PROXY:{goal:'ID_PROBLEM',documents:['ROMANIAN_ID','PASSPORT'],docStatuses:{ROMANIAN_ID:'EXPIRED',PASSPORT:'VALID'},choices:{passport_domicile:'ROMANIA',can_come:'NO'}},
    A3_FIRST_ID_CONSULAR:{goal:'ID_PROBLEM',documents:['PASSPORT'],docStatuses:{PASSPORT:'VALID'},choices:{passport_domicile:'ROMANIA',can_come:'NO'}},
    C1_CEI_ROMANIA:{goal:'CEI',documents:['PASSPORT'],docStatuses:{PASSPORT:'VALID'},choices:{passport_domicile:'ROMANIA',physical:'YES'}},
    C5_CEI_REPLACEMENT:{goal:'CEI',documents:['CEI','PASSPORT'],docStatuses:{CEI:'EXPIRED',PASSPORT:'VALID'},choices:{passport_domicile:'ROMANIA',physical:'YES'}},
    D1_TEMPORARY:{goal:'KEEP_FOREIGN_DOMICILE',documents:['CRDS_PASSPORT'],docStatuses:{CRDS_PASSPORT:'VALID'},choices:{passport_domicile:'CURRENT'}},
    D2_PERMANENT_RETURN:{goal:'MOVE_DOMICILE_TO_RO',documents:['CRDS_PASSPORT'],docStatuses:{CRDS_PASSPORT:'VALID'},choices:{passport_domicile:'CURRENT'}},
    TRAVEL_TITLE_RETURN_RO:{goal:'URGENT_TRAVEL',documents:['BIRTH_CERT'],choices:{physical:'NO',travel_dest:'ROMANIA'}},
    URGENT_OTHER_COUNTRY:{goal:'URGENT_TRAVEL',documents:['PASSPORT'],docStatuses:{PASSPORT:'MISSING'},choices:{physical:'NO',travel_dest:'OTHER',ever_crds:'NO'}}
  };
  assert.ok(rest[entry.key],'Unknown guide fixture '+entry.key);
  return {country:c,...rest[entry.key]};
}

test('all 43 catalog keys are produced by complete questionnaire journeys',()=>{
  const found=new Set();
  for(const entry of catalog.guides){
    const result=walk(fixtureFor(entry));
    assert.equal(result.current,'RESULT',entry.key+' ended '+result.current+' via '+result.history.join(' > '));
    assert.equal(result.S.route,entry.route,entry.key+' wrong route');
    assert.equal(result.key,entry.key,entry.key+' wrong guide after complete journey');
    assert.equal(result.offer,true,entry.key+' never reaches eligible paywall');
    assert.ok(!result.unknowns?.length,entry.key+' has unresolved information');
    found.add(result.key);
  }
  assert.equal(found.size,43);
});

test('unknown Swiss permit and a cross-border G permit do not present checkout',()=>{
  for(const permit of ['UNKNOWN','G']){
    const result=walk({country:'CH',goal:'ESTABLISH_FOREIGN_DOMICILE',
      documents:['PASSPORT'],docStatuses:{PASSPORT:'VALID'},
      choices:{passport_domicile:'ROMANIA',swiss_permit:permit}});
    assert.equal(result.offer,false,permit+' must not be offered a guide');
    assert.ok(result.current==='UNRESOLVED'||result.current==='STOP'||result.current.startsWith('STOP_'),result.current);
  }
});

test('unverified birth certificate never produces a payable first-CRDS result',()=>{
  for(const birth_cert of ['UNKNOWN','MISSING','PLASTIFIED']){
    const result=walk({country:'ES',goal:'ESTABLISH_FOREIGN_DOMICILE',
      documents:['PASSPORT'],docStatuses:{PASSPORT:'VALID'},
      choices:{passport_domicile:'ROMANIA',birth_cert}});
    if(birth_cert==='UNKNOWN')assert.equal(result.offer,false);
    else assert.ok(result.S.blockers.length>0,'Administrative blocker must be disclosed: '+birth_cert);
  }
});

test('all 10 countries are supported in the first-CRDS and lost-CRDS journeys',()=>{
  for(const c of countryCodes){
    const first=walk(fixtureFor({key:'B1_'+c,country:c,route:'B1_FIRST_CRDS',scenario:'first_crds'}));
    const lost=walk(fixtureFor({key:'B5_LOST_'+c,country:c,route:'B5_EXISTING_CRDS',scenario:'lost'}));
    assert.equal(first.key,'B1_'+c);
    assert.equal(lost.key,'B5_LOST_'+c);
    assert.ok(first.offer&&lost.offer);
  }
});
