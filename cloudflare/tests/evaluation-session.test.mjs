import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import worker from '../worker.js';
const ORIGIN='https://mypape-dot.github.io';
function harness(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE access_grants(case_id TEXT PRIMARY KEY,status TEXT NOT NULL,route TEXT,shopify_order_id TEXT,shopify_order_name TEXT,paid_at TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE guides(route TEXT PRIMARY KEY,title TEXT,guide_json TEXT,updated_at TEXT)');
 for(const migration of ['001-guide-variants.sql','002-shopify-checkout.sql','003-payment-events.sql','004-revocations.sql','005-recovery.sql','006-request-quotas.sql','007-evaluation-sessions.sql'])sql.exec(readFileSync(new URL('../'+migration,import.meta.url),'utf8'));
 sql.exec("INSERT INTO guide_scripts(guide_key,route,title,script_js) VALUES('B1_IT','B1_FIRST_CRDS','Italia','window.ok=true')");
 const stmt=(query,args=[])=>({bind:(...v)=>stmt(query,v),first:async()=>sql.prepare(query).get(...args)??null,run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}}),exec:()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})});
 const DB={prepare:q=>stmt(q),batch:async stmts=>{sql.exec('BEGIN');try{const result=stmts.map(s=>s.exec());sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}};
 const env={DB,ABUSE_HASH_PEPPER:'a-long-randomized-pepper-for-testing-not-a-secret-2026',SHOPIFY_CHECKOUT_ENABLED:'true',SHOPIFY_WEBHOOK_SECRET:'test-shop-secret',PAYMENT_ALERT_WEBHOOK_URL:'https://alert.invalid/mock'};
 async function api(path,{body,sessionToken,accessToken,ip='192.0.2.10',origin=ORIGIN}={}){
   const response=await worker.fetch(new Request('https://worker.invalid'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':ip,...(sessionToken?{'X-Actero-Session-Token':sessionToken}:{}),...(accessToken?{'X-Actero-Access-Token':accessToken}:{})},body:JSON.stringify(body??{})}),env);
   return {status:response.status,data:await response.json()};
 }
 const checkout=(caseId,opts={})=>api('/checkout',{body:{case_id:caseId,route:'B1_FIRST_CRDS',guide_key:'B1_IT'},...opts});
 return {sql,env,api,checkout};
}
test('server issues a unique case with hashed session secret',async()=>{
 const {api,sql}=harness(),s=await api('/session');
 assert.equal(s.status,200);assert.match(s.data.case_id,/^AR-[\w-]{36}$/);assert.match(s.data.session_token,/^[0-9a-f]{64}$/);
 const row=sql.prepare('SELECT * FROM evaluation_sessions WHERE case_id=?').get(s.data.case_id);
 assert.ok(row);assert.notEqual(row.session_token_hash,s.data.session_token);
 assert.ok(row.expires_at > Math.floor(Date.now()/1000));
});
test('arbitrary browser case ID cannot create first checkout',async()=>{
 const h=harness(),r=await h.checkout('AR-'+randomUUID());
 assert.equal(r.status,403);assert.equal(r.data.error,'session_required');
});
test('a known session case ID is useless without its secret',async()=>{
 const h=harness(),s=await h.api('/session');
 assert.equal((await h.checkout(s.data.case_id)).status,403);
 assert.equal((await h.checkout(s.data.case_id,{sessionToken:'0'.repeat(64)})).status,403);
 assert.equal(h.sql.prepare('SELECT COUNT(*) n FROM access_grants').get().n,0);
});
test('valid session creates a checkout; paid-access token allows secure retry',async()=>{
 const h=harness(),s=await h.api('/session'),co=await h.checkout(s.data.case_id,{sessionToken:s.data.session_token});
 assert.equal(co.status,200);assert.ok(co.data.accessToken);
 const retry=await h.checkout(s.data.case_id,{accessToken:co.data.accessToken});
 assert.equal(retry.status,200);assert.notEqual(retry.data.accessToken,co.data.accessToken);
 const forged=await h.checkout(s.data.case_id,{sessionToken:s.data.session_token});
 assert.equal(forged.status,409);assert.equal(forged.data.error,'case_in_progress');
});
test('expired session cannot authorize initial checkout',async()=>{
 const h=harness(),s=await h.api('/session');
 h.sql.prepare('UPDATE evaluation_sessions SET expires_at=unixepoch()-1 WHERE case_id=?').run(s.data.case_id);
 assert.equal((await h.checkout(s.data.case_id,{sessionToken:s.data.session_token})).status,403);
});
test('session secret is bound to its own case',async()=>{
 const h=harness(),one=await h.api('/session'),two=await h.api('/session');
 assert.equal((await h.checkout(two.data.case_id,{sessionToken:one.data.session_token})).status,403);
});
test('ninth session request from same IP is rate limited',async()=>{
 const h=harness();for(let i=0;i<8;i++)assert.equal((await h.api('/session')).status,200);
 const last=await h.api('/session');assert.equal(last.status,429);assert.equal(last.data.error,'too_many_requests');
 assert.equal(h.sql.prepare('SELECT COUNT(*) n FROM evaluation_sessions').get().n,8);
});
test('session creation fails closed without the quota secret',async()=>{
 const h=harness();delete h.env.ABUSE_HASH_PEPPER;assert.equal((await h.api('/session')).status,503);
});
test('foreign origin is rejected',async()=>{
 const h=harness();assert.equal((await h.api('/session',{origin:'https://evil.example'})).status,403);
});
test('simultaneous first checkouts have only one winner',async()=>{
 const h=harness(),s=await h.api('/session');
 const attempts=await Promise.all(Array.from({length:6},()=>h.checkout(s.data.case_id,{sessionToken:s.data.session_token})));
 assert.equal(attempts.filter(x=>x.status===200).length,1);
 assert.equal(h.sql.prepare('SELECT COUNT(*) n FROM checkout_intents').get().n,1);
});
