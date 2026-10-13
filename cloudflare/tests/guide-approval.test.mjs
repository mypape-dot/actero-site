// Audit-only approval gate tests, backed by simulated SQLite D1 and real Worker code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import worker from '../worker.js';
const ORIGIN='https://mypape-dot.github.io';
const APPROVED_SCRIPT='window.acteroReviewed=true;';
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');

function harness(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE access_grants(case_id TEXT PRIMARY KEY,status TEXT NOT NULL,route TEXT,shopify_order_id TEXT,shopify_order_name TEXT,paid_at TEXT,created_at TEXT,updated_at TEXT); CREATE TABLE guides(route TEXT PRIMARY KEY,title TEXT,guide_json TEXT,updated_at TEXT)');
 for(const n of ['001-guide-variants.sql','002-shopify-checkout.sql','003-payment-events.sql','004-revocations.sql','005-recovery.sql','006-request-quotas.sql','007-evaluation-sessions.sql','008-guide-approvals.sql'])
   sql.exec(readFileSync(new URL('../'+n,import.meta.url),'utf8'));
 sql.prepare('INSERT INTO guide_scripts(guide_key,route,title,script_js) VALUES(?,?,?,?)')
   .run('B1_ES','B1_FIRST_CRDS','Spain',APPROVED_SCRIPT);
 const stmt=(query,args=[])=>({bind:(...v)=>stmt(query,v),
   first:async()=>sql.prepare(query).get(...args)??null,
   exec:()=>({meta:{changes:sql.prepare(query).run(...args).changes}})});
 const DB={prepare:query=>stmt(query),batch:async stmts=>{
   sql.exec('BEGIN');try{const v=stmts.map(x=>x.exec());sql.exec('COMMIT');return v}
   catch(e){sql.exec('ROLLBACK');throw e}
 }};
 const env={DB,SHOPIFY_CHECKOUT_ENABLED:'true',SHOPIFY_WEBHOOK_SECRET:'test',
   PAYMENT_ALERT_WEBHOOK_URL:'https://alerts.invalid/test',ABUSE_HASH_PEPPER:'safe-fixture-123456789012345678901234'};
 async function request(path,body={},token){
   const response=await worker.fetch(new Request('https://worker.invalid'+path,{
     method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json','CF-Connecting-IP':'198.51.100.12',
       ...(token?{'X-Actero-Session-Token':token}:{})},
     body:JSON.stringify(body)}),env);
   return {status:response.status,data:await response.json()};
 }
 async function checkout(){
   const sess=await request('/session');
   assert.equal(sess.status,200);
   return request('/checkout',{case_id:sess.data.case_id,route:'B1_FIRST_CRDS',
     guide_key:'B1_ES'},sess.data.session_token);
 }
 const approve=(status='approved',script=APPROVED_SCRIPT,route='B1_FIRST_CRDS')=>
   sql.prepare('INSERT INTO guide_approvals(guide_key,route,script_sha256,status,reviewer_reference,approved_at) VALUES(?,?,?,?,?,?)')
   .run('B1_ES',route,hash(script),status,'private-review-fixture','2026-10-13');
 return {sql,checkout,approve};
}
test('a stored guide without review cannot reach Shopify checkout',async()=>{
 const h=harness(),res=await h.checkout();
 assert.equal(res.status,409);
 assert.equal(res.data.error,'guide_not_available');
 assert.equal(h.sql.prepare('SELECT count(*) n FROM checkout_intents').get().n,0);
});
test('pending or revoked reviews cannot reach Shopify checkout',async()=>{
 for(const status of ['pending','revoked']){
   const h=harness();h.approve(status);const res=await h.checkout();
   assert.equal(res.status,409,status);
 }
});
test('an approved exact script can reach checkout',async()=>{
 const h=harness();h.approve();
 const result=await h.checkout();
 assert.equal(result.status,200);
 assert.ok(result.data.checkoutUrl);
});
test('changing approved script bytes invalidates the approval immediately',async()=>{
 const h=harness();h.approve();
 h.sql.prepare('UPDATE guide_scripts SET script_js=? WHERE guide_key=?')
   .run('window.editedWithoutReview=true;','B1_ES');
 const result=await h.checkout();
 assert.equal(result.status,409);
});
test('approval with wrong route does not authorize another procedure',async()=>{
 const h=harness();h.approve('approved',APPROVED_SCRIPT,'B5_EXISTING_CRDS');
 const result=await h.checkout();
 assert.equal(result.status,409);
});
test('blank approved script does not pass review gate',async()=>{
 const h=harness();
 h.sql.prepare('UPDATE guide_scripts SET script_js=? WHERE guide_key=?').run('   ','B1_ES');
 h.approve('approved','   ');
 assert.equal((await h.checkout()).status,409);
});
test('missing approval migration fails closed without creating a checkout',async()=>{
 const h=harness();h.sql.exec('DROP TABLE guide_approvals');
 const res=await h.checkout();
 assert.equal(res.status,500);
 assert.equal(res.data.error,'checkout_database_error');
 assert.equal(h.sql.prepare('SELECT count(*) n FROM checkout_intents').get().n,0);
});
