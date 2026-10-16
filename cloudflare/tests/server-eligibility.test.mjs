// Synthetic cases + in-memory SQLite only. No private guides, real approvals or services.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {checkoutDecisionFor,paymentDecisionFor} from '../../shared/eligibility.mjs';
import {loadEngine} from './helpers/engine-harness.mjs';
import {harness,state,syntheticScript} from './helpers/payment-harness.mjs';

const browser=loadEngine().ctx;
const clone=()=>structuredClone(state);
function b5(country='ES'){
 const s=clone();s.route='B5_EXISTING_CRDS';
 Object.assign(s.answers,{residence_country:country,goal:'EXISTING_CRDS_PROBLEM',documents:['CRDS_PASSPORT'],passport_domicile:'CURRENT',b5case:'RENEWAL',same_country:'YES',current_foreign_proof:'YES',identity_detail:'HAS_PHOTO_DOC'});
 s.docs={CRDS_PASSPORT:'EXPIRED'};return s;
}
function approveSynthetic(h,key,route){
 if(!key||!route)return;
 const hash=createHash('sha256').update(syntheticScript).digest('hex');
 h.sql.prepare('INSERT OR REPLACE INTO guide_scripts(guide_key,route,title,script_js) VALUES(?,?,?,?)').run(key,route,'SYNTHETIC ONLY',syntheticScript);
 h.sql.prepare("INSERT OR REPLACE INTO guide_approvals(guide_key,route,script_sha256,status,reviewer_reference,approved_at) VALUES(?,?,?,'approved','synthetic-test',datetime('now'))").run(key,route,hash);
 for(const c of ['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH'])h.sql.prepare("INSERT OR REPLACE INTO guide_country_approvals(guide_key,route,country,script_sha256,status,reviewer_reference,approved_at) VALUES(?,?,?,?,'approved','synthetic-test',datetime('now'))").run(key,route,c,hash);
}
async function attempt(h,s,{route=s?.route||state.route,key=paymentDecisionFor(s).key||'B1_ES',extra={}}={}){
 const session=await h.api('/session');assert.equal(session.status,200);
 return h.api('/checkout',{body:{case_id:session.data.case_id,route,guide_key:key,case_state:s,...extra},headers:{'X-Actero-Session-Token':session.data.session_token}});
}
function assertNoPurchase(h){
 for(const table of ['access_grants','checkout_intents'])assert.equal(h.sql.prepare('SELECT COUNT(*) n FROM '+table).get().n,0,table);
}
const negatives=[
 ['minor',s=>{s.answers.age='NO'}],
 ['citizenship unknown',s=>{s.answers.citizenship='UNKNOWN'}],
 ['missing age',s=>{delete s.answers.age}],
 ['unsupported country',s=>{s.answers.residence_country='OTHER'}],
 ['missing goal',s=>{delete s.answers.goal}],
 ['missing civil state',s=>{delete s.answers.civil_change}],
 ['missing document selection',s=>{delete s.answers.documents}],
 ['missing document status',s=>{delete s.docs.PASSPORT}],
 ['unknown document',s=>{s.docs.PASSPORT='UNKNOWN'}],
 ['invented valid identity document',s=>{s.docs={FORGED:'VALID'}}],
 ['undeclared valid passport',s=>{s.answers.documents=['BIRTH_CERT']}],
 ['missing foreign proof',s=>{s.answers.foreign_proof='NO'}],
 ['unknown proof',s=>{s.answers.foreign_proof='UNKNOWN'}],
 ['invented proof enum',s=>{s.answers.foreign_proof='APPROVED'}],
 ['missing birth certificate',s=>{s.answers.birth_cert='MISSING'}],
 ['missing passport domicile',s=>{delete s.answers.passport_domicile;s.answers.ever_crds='NO'}],
 ['untranscribed civil change',s=>{s.answers.civil_change='MARRIAGE';s.answers.civil_sync='NO'}],
 ['forged reacquired citizenship exemption',s=>{s.answers.citizenship='REACQUIRED';s.docs.PASSPORT='EXPIRED';Object.assign(s.answers,{identity_detail:'HAS_PHOTO_DOC',post_citizenship_romanian_id:'NO',citizenship_cert_available:'NO',citizenship_cert_required:'NO'})}],
 ['returned CRDS history',s=>{s.answers.crds_history='RETURNED'}],
 ['CRDS declared but never held',s=>{s.answers.documents.push('CRDS_PASSPORT');s.docs.CRDS_PASSPORT='VALID';s.answers.ever_crds='NO'}],
 ['B5 country contradiction',s=>{Object.assign(s,b5());s.answers.same_country='NO'}],
 ['B5 valid passport claimed stolen',s=>{Object.assign(s,b5());s.docs.CRDS_PASSPORT='VALID';s.answers.b5case='STOLEN';s.answers.theft_proof='YES'}],
 ['B5 forged status-derived scenario',s=>{Object.assign(s,b5());s.answers.b5case='DATA_CHANGE'}],
 ['D1 forged validity',s=>{Object.assign(s,b5());s.route='D1_TEMPORARY';Object.assign(s.answers,{goal:'KEEP_FOREIGN_DOMICILE',d1_crds:'VALID',ro_residence:'OWN',ro_residence_proof:'YES'})}],
 ...['YES','REACQUIRED'].flatMap(citizenship=>['A1_PERSONAL_ROMANIA','A3_FIRST_ID_CONSULAR','C1_CEI_ROMANIA'].map(route=>[
  'GN-03 '+citizenship+' '+route,s=>{s.route=route;Object.assign(s.answers,{citizenship,goal:route.startsWith('C1')?'CEI':'ID_PROBLEM',physical:'YES',can_come:route.startsWith('A3')?'NO':'YES',ro_address:'OWN'})}
 ]))
];
for(const [name,mutate] of negatives)test('reject '+name+' despite forged browser approval and approved synthetic script',async()=>{
 const s=clone();mutate(s);
 Object.assign(s,{allowed:true,legalBasisConfirmed:true,key:'B1_ES',status:'GREEN'});
 const decision=checkoutDecisionFor(s);
 assert.equal(decision.allowed,false);
 assert.deepEqual(JSON.parse(JSON.stringify(browser.checkoutDecisionFor(s))),decision,'browser/server negative parity');
 const h=harness({stagingSchema:true});try{
  const key=paymentDecisionFor(s).key||'B1_ES';approveSynthetic(h,key,s.route);
  const response=await attempt(h,s,{key,extra:{allowed:true,legalBasisConfirmed:true}});
  assert.equal(response.status,409);assert.ok(['not_eligible','case_route_changed'].includes(response.data.error));assertNoPurchase(h);
 }finally{h.close()}
});
for(const country of ['BE','NL','IE'])for(const kind of ['B1','B5'])test(kind+' '+country+' legal gate remains independent of editorial approvals',async()=>{
 const s=kind==='B1'?clone():b5(country);s.answers.residence_country=country;s.answers.local_proof_type='PERMANENT';
 const decision=checkoutDecisionFor(s);assert.equal(decision.allowed,true);assert.equal(decision.legalBasisConfirmed,false);
 assert.deepEqual(JSON.parse(JSON.stringify(browser.checkoutDecisionFor(s))),decision);
 const h=harness();try{approveSynthetic(h,decision.key,decision.route);const r=await attempt(h,s,{extra:{legalBasisConfirmed:true}});
  assert.equal(r.status,409);assert.equal(r.data.error,'legal_basis_unconfirmed');assertNoPurchase(h);
 }finally{h.close()}
});
for(const scenario of ['RENEWAL','LOST','STOLEN'])test('France '+scenario+' remedy cannot act as legal approval',async()=>{
 const s=b5('FR');s.answers.b5case=scenario;s.docs.CRDS_PASSPORT=scenario==='RENEWAL'?'EXPIRED':scenario;
 s.answers.current_foreign_proof='NO';s.answers.theft_proof='NO';
 const d=checkoutDecisionFor(s);assert.equal(d.allowed,true);assert.equal(d.legalBasisConfirmed,false);
 const h=harness();try{approveSynthetic(h,d.key,d.route);const r=await attempt(h,s);assert.equal(r.data.error,'legal_basis_unconfirmed');assertNoPurchase(h)}finally{h.close()}
});
test('route and guide claims cannot select a different approved product',async()=>{
 for(const [route,key] of [['B1_FIRST_CRDS','B1_IT'],['B5_EXISTING_CRDS','B5_RENEWAL_ES']]){
  const h=harness();try{const s=clone();s.route=route;approveSynthetic(h,key,route);
   const r=await attempt(h,s,{route,key});assert.equal(r.data.error,'case_route_changed');assertNoPurchase(h);
  }finally{h.close()}
 }
});
test('a snapshot is mandatory even with recovery disabled',async()=>{
 const h=harness();try{h.env.RECOVERY_REQUIRED='false';const r=await attempt(h,undefined);assert.equal(r.status,400);assert.equal(r.data.error,'invalid_case_state');assertNoPurchase(h)}finally{h.close()}
});
test('malformed snapshots and invalid enum types cannot bypass the gate',async()=>{
 for(const s of [null,[],{...clone(),answers:[]},{...clone(),docs:[]},{...clone(),answers:{...state.answers,foreign_proof:{allowed:true}}}]){
  const h=harness();try{const r=await attempt(h,s,{key:'B1_ES'});assert.equal(r.status,400);assertNoPurchase(h)}finally{h.close()}
 }
});
test('eligible cases still require an exact editorial approval',async()=>{
 const h=harness();try{h.sql.exec('DELETE FROM guide_approvals');const r=await attempt(h,clone());assert.equal(r.data.error,'guide_not_available');assertNoPurchase(h)}finally{h.close()}
});
test('server-derived decision is saved, browser authority fields are discarded',async()=>{
 const h=harness();try{
  const s=clone();s.status='YELLOW_U';s.answers.allowed=true;s.answers.guide_key='B5_STOLEN';s.answers.citizenship_cert_required='NO';s.clarified={Q109:1};
  const r=await attempt(h,s,{extra:{allowed:false,legalBasisConfirmed:false}});assert.equal(r.status,200);
  const saved=JSON.parse(h.sql.prepare('SELECT evaluation_json FROM access_grants').get().evaluation_json);
  assert.deepEqual(saved,{...checkoutDecisionFor(s).caseState,clarified:{Q109:1}});
  assert.equal(saved.status,'GREEN');assert.equal(saved.answers.allowed,undefined);assert.equal(saved.answers.guide_key,undefined);
 }finally{h.close()}
});
test('every retry recalculates eligibility before rotating the existing token',async()=>{
 const h=harness();try{const paid=await h.checkout();const s=clone();s.answers.birth_cert='MISSING';
  const before=h.sql.prepare('SELECT access_token_hash FROM access_grants').get().access_token_hash;
  const r=await h.api('/checkout',{body:{case_id:paid.caseId,route:s.route,guide_key:'B1_ES',case_state:s},headers:{'X-Actero-Access-Token':paid.accessToken}});
  assert.equal(r.data.error,'not_eligible');assert.equal(h.sql.prepare('SELECT COUNT(*) n FROM checkout_intents').get().n,1);
  assert.equal(h.sql.prepare('SELECT access_token_hash FROM access_grants').get().access_token_hash,before);
 }finally{h.close()}
});
test('checkout remains disabled in both checked-in environments',()=>{
 const config=readFileSync(new URL('../staging/wrangler.json.example',import.meta.url),'utf8');
 assert.equal(JSON.parse(config).env.staging.vars.SHOPIFY_CHECKOUT_ENABLED,'false');
 assert.match(readFileSync(new URL('../../actero-config.js',import.meta.url),'utf8'),/ACTERO_PAYMENT_API\s*=\s*''/);
 const h=harness();h.env.SHOPIFY_CHECKOUT_ENABLED='false';return h.api('/checkout',{body:{}}).then(r=>{assert.equal(r.data.error,'checkout_disabled');assertNoPurchase(h)}).finally(()=>h.close());
});
test('CEI normal null case marker is serializable while null evidence is rejected',async()=>{
 const s=clone();s.route='C1_CEI_ROMANIA';Object.assign(s.answers,{goal:'CEI',physical:'YES',cei_case:null,ro_address:'OWN',documents:['PASSPORT','ROMANIAN_ID']});s.docs.ROMANIAN_ID='EXPIRED';
 const h=harness();try{approveSynthetic(h,s.route,s.route);const r=await attempt(h,s);assert.equal(r.status,200)}finally{h.close()}
 s.answers.ro_address=null;assert.equal(checkoutDecisionFor(s).allowed,false);
});
