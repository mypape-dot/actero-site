// ActeRO F-03 simulated regression against the actual Cloudflare Worker module + SQLite.
// Run: node --no-warnings cloudflare/tests/recovery.test.mjs
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHmac,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import worker from '../worker.js';
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE access_grants (case_id TEXT PRIMARY KEY,status TEXT NOT NULL,route TEXT,shopify_order_id TEXT,shopify_order_name TEXT,paid_at TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE guides(route TEXT PRIMARY KEY,title TEXT,guide_json TEXT,updated_at TEXT)');
for(const n of ['001-guide-variants.sql','002-shopify-checkout.sql','003-payment-events.sql','004-revocations.sql','005-recovery.sql'])
  db.exec(readFileSync(new URL('../'+n,import.meta.url),'utf8'));
db.exec("INSERT INTO guide_scripts(guide_key,route,title,script_js) VALUES('B1_CH','B1_FIRST_CRDS','Elveția','window.test=true')");
const statement=(sql,args=[])=>({bind:(...v)=>statement(sql,v),first:async()=>db.prepare(sql).get(...args)||null,run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}}),exec:()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});
const DB={prepare:s=>statement(s),batch:async items=>{db.exec('BEGIN');try{const results=items.map(x=>x.exec());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}};
const env={DB,SHOPIFY_CHECKOUT_ENABLED:'true',SHOPIFY_WEBHOOK_SECRET:'local-secret',PAYMENT_ALERT_WEBHOOK_URL:'https://alert.test',RECOVERY_REQUIRED:'true',RECOVERY_EMAIL_PEPPER:'pepper-'.repeat(8),RECOVERY_EMAIL_API_KEY:'re_test_abcdef',RECOVERY_EMAIL_FROM:'support@actero.test',RECOVERY_PAGE_URL:'https://mypape-dot.github.io/actero-site/recuperare.html'};
const mail=[];globalThis.fetch=async(url,options)=>{if(String(url).includes('api.resend.com')){mail.push(JSON.parse(options.body));return {ok:true,status:200}}if(String(url).includes('alert.test'))return{ok:true,status:204};throw Error('Unexpected network')};
const state={route:'B1_FIRST_CRDS',answers:{residence_country:'CH',goal:'ESTABLISH_FOREIGN_DOMICILE',documents:['CRDS_PASSPORT']},docs:{CRDS_PASSPORT:'EXPIRED'},status:'GREEN',clarified:{Q109:1}};
async function request(path,body,token){const r=await worker.fetch(new Request('https://example.test'+path,{method:'POST',headers:{Origin:'https://mypape-dot.github.io','Content-Type':'application/json',...(token?{'X-Actero-Access-Token':token}:{})},body:JSON.stringify(body)}),env);return {status:r.status,data:await r.json()}}
async function get(path,token){const r=await worker.fetch(new Request('https://example.test'+path,{headers:{Origin:'https://mypape-dot.github.io','X-Actero-Access-Token':token||''}}),env);return {status:r.status,data:await r.json()}}
async function paidCase(orderId){const caseId='AR-'+randomUUID();const co=await request('/checkout',{case_id:caseId,route:state.route,guide_key:'B1_CH',case_state:state});assert.equal(co.status,200);
 const id=JSON.parse(Buffer.from(new URL(co.data.checkoutUrl).searchParams.get('properties').replace(/-/g,'+').replace(/_/g,'/'),'base64').toString())._actero_checkout_id;
 const order={id:orderId,name:'#'+orderId,email:'Buyer@Example.com',financial_status:'paid',currency:'RON',total_price:'49.00',line_items:[{variant_id:67640764400007,quantity:1,price:'49.00',total_discount:0,properties:[{name:'_actero_checkout_id',value:id}]}]};
 const raw=JSON.stringify(order);const mac=createHmac('sha256',env.SHOPIFY_WEBHOOK_SECRET).update(raw).digest('base64');const r=await worker.fetch(new Request('https://example.test/webhooks/shopify/orders-paid',{method:'POST',headers:{'X-Shopify-Hmac-Sha256':mac,'X-Shopify-Shop-Domain':'gyfu4v-5q.myshopify.com','X-Shopify-Topic':'orders/paid','X-Shopify-Webhook-Id':randomUUID()},body:raw}),env);
 assert.equal((await r.json()).granted,true);return {caseId,oldToken:co.data.accessToken};}
let count=0;const check=(label,value)=>{assert.ok(value,label);count++;console.log('PASS '+label)};
const paid=await paidCase('4211');
let unknown=await request('/recover/request',{email:'wrong@example.com',order_name:'#4211'});check('no account enumeration on wrong email',unknown.status===202&&mail.length===0);
unknown=await request('/recover/request',{email:'buyer@example.com',order_name:'#9999'});check('no account enumeration on wrong order',unknown.status===202&&mail.length===0);
const requested=await request('/recover/request',{email:'BUYER@example.com',order_name:'4211'});check('generic response and email sent to order buyer',requested.status===202&&mail.length===1&&mail[0].to[0]==='buyer@example.com');
const link=mail[0].text.match(/https:\/\/\S+/)?.[0];const key=new URL(link).hash.slice('#token='.length);
check('fragment-only 256-bit link',!new URL(link).search&&/^[a-f0-9]{64}$/.test(key));
check('recovery plaintext token not in D1',db.prepare('SELECT token_hash FROM recovery_links').get().token_hash!==key);
const recovered=await request('/recover/consume',{token:key});
check('recovery restores exact evaluation',recovered.status===200&&recovered.data.case_id===paid.caseId&&recovered.data.case_state.clarified.Q109===1);
check('old access token revoked on recovery',(await get('/access?case_id='+paid.caseId,paid.oldToken)).data.paid===false);
check('new token opens paid access',(await get('/access?case_id='+paid.caseId,recovered.data.access_token)).data.paid===true);
check('single-use recovery link cannot be replayed',(await request('/recover/consume',{token:key})).status===400);
const exp=await paidCase('4212');await request('/recover/request',{email:'buyer@example.com',order_name:'4212'});const expiredKey=new URL(mail.at(-1).text.match(/https:\/\/\S+/)[0]).hash.slice('#token='.length);db.prepare('UPDATE recovery_links SET expires_at=unixepoch()-10 WHERE case_id=?').run(exp.caseId);
check('expired link rejected',(await request('/recover/consume',{token:expiredKey})).status===400);
const concurrent=await paidCase('4213');await request('/recover/request',{email:'buyer@example.com',order_name:'4213'});const oneKey=new URL(mail.at(-1).text.match(/https:\/\/\S+/)[0]).hash.slice('#token='.length);const attempts=await Promise.all([request('/recover/consume',{token:oneKey}),request('/recover/consume',{token:oneKey})]);
check('concurrent single-use redemption only one winner',attempts.filter(x=>x.status===200).length===1);
const throttle=await paidCase('4214');for(let i=0;i<4;i++)await request('/recover/request',{email:'buyer@example.com',order_name:'4214'});check('at most three emails per order per hour',db.prepare('SELECT COUNT(*) n FROM recovery_links WHERE case_id=?').get(throttle.caseId).n===3);
check('raw buyer email not stored in access grant',!JSON.stringify(db.prepare('SELECT * FROM access_grants WHERE case_id=?').get(paid.caseId)).includes('Buyer@Example.com'));
console.log('SUMMARY '+count+'/'+count+' passed — simulated SQLite/Shopify/Resend; no live services');
