import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import crypto from 'node:crypto';
import worker from '../worker.js';
const ORIGIN='https://mypape-dot.github.io',SHOP='gyfu4v-5q.myshopify.com',SECRET='test-secret';
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE access_grants(case_id TEXT PRIMARY KEY,status TEXT NOT NULL,route TEXT,shopify_order_id TEXT,shopify_order_name TEXT,paid_at TEXT,created_at TEXT,updated_at TEXT); CREATE TABLE guides(route TEXT PRIMARY KEY,title TEXT,guide_json TEXT,updated_at TEXT)');
for(const n of ['001-guide-variants.sql','002-shopify-checkout.sql','003-payment-events.sql'])db.exec(fs.readFileSync(new URL('../'+n,import.meta.url),'utf8'));
db.exec("INSERT INTO guide_scripts(guide_key,route,title,script_js) VALUES('B1_IT','B1_FIRST_CRDS','Italy','window.ok=true')");
const stmt=(sql,args=[])=>({bind:(...v)=>stmt(sql,v),first:async()=>db.prepare(sql).get(...args)??null,run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}}),exec:()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});
const DB={prepare:sql=>stmt(sql),batch:async statements=>{db.exec('BEGIN');try{const out=statements.map(x=>x.exec());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
let alerts=0,alertFail=false;
globalThis.fetch=async()=>{alerts++;return {ok:!alertFail,status:alertFail?503:204}};
const env={DB,SHOPIFY_CHECKOUT_ENABLED:'true',SHOPIFY_WEBHOOK_SECRET:SECRET,PAYMENT_ALERT_WEBHOOK_URL:'https://example.invalid/mock-discord'};
async function api(method,path,body,headers={}){const res=await worker.fetch(new Request('https://worker.test'+path,{method,headers:{Origin:ORIGIN,'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined}),env);return {status:res.status,data:await res.json()}};
const makeCase=()=>`AR-${crypto.randomUUID()}`;
const checkout=(case_id,token)=>api('POST','/checkout',{case_id,route:'B1_FIRST_CRDS',guide_key:'B1_IT'},token?{'X-Actero-Access-Token':token}:{});
const checkoutId=url=>JSON.parse(Buffer.from(new URL(url).searchParams.get('properties').replace(/-/g,'+').replace(/_/g,'/'),'base64').toString())._actero_checkout_id;
function order(cid,id='123456',extra={}){return {id,name:'#'+id,financial_status:'paid',currency:'RON',total_price:'49.00',line_items:[{variant_id:67640764400007,quantity:1,price:'49.00',total_discount:0,properties:cid?[{name:'_actero_checkout_id',value:cid}]:[]}],...extra}}
async function webhook(body,eventId=crypto.randomUUID(),badSecret=false){const raw=JSON.stringify(body);const mac=crypto.createHmac('sha256',badSecret?'wrong':SECRET).update(raw).digest('base64');const response=await worker.fetch(new Request('https://worker.test/webhooks/shopify/orders-paid',{method:'POST',headers:{'X-Shopify-Hmac-Sha256':mac,'X-Shopify-Shop-Domain':SHOP,'X-Shopify-Topic':'orders/paid','X-Shopify-Webhook-Id':eventId},body:raw}),env);return {status:response.status,data:await response.json()}}
let passed=0;function check(label,ok){if(!ok)throw Error('FAILED: '+label);passed++;console.log('PASS '+label)}
const a=makeCase(),initial=await checkout(a);check('initial checkout',initial.status===200);
const stolen=await checkout(a);check('F-05 no anonymous token rotation',stolen.status===409&&stolen.data.error==='case_in_progress');
const pending=await api('GET','/access?case_id='+a,undefined,{'X-Actero-Access-Token':initial.data.accessToken});check('original token survives',pending.data.status==='pending');
const wrong=await checkout(a,'wrong');check('fake retry token rejected',wrong.status===409);
const fresh=await checkout(a,initial.data.accessToken);check('authenticated retry allowed',fresh.status===200);
const cid=checkoutId(initial.data.checkoutUrl);const sigFail=await webhook(order(cid),undefined,true);check('invalid HMAC rejected',sigFail.status===401);
const pay=await webhook(order(cid));check('paid order grants access',pay.data.granted===true);
check('successful event logged',db.prepare("SELECT count(*) n FROM payment_events WHERE result='granted'").get().n===1);
const other=await webhook(order(cid,'654321'));check('second paid order flagged',other.data.needs_review===true&&alerts===1);
const b=makeCase(),bco=await checkout(b);const missing=await webhook(order(null,'777777'));check('missing checkout ID flagged and alerted',missing.data.reason==='missing_checkout_id'&&alerts===2);
const c=makeCase(),cco=await checkout(c);alertFail=true;const eid=crypto.randomUUID();const bad=await webhook(order(checkoutId(cco.data.checkoutUrl),'888888',{total_price:'44.10'}),eid);check('alert failure causes retryable 503',bad.status===503);
check('failed alert still records incident',db.prepare('SELECT result FROM payment_events WHERE event_id=?').get(eid).result==='needs_review');
alertFail=false;const retry=await webhook(order(checkoutId(cco.data.checkoutUrl),'888888',{total_price:'44.10'}),eid);check('webhook retry completes incident alert',retry.status===200);
console.log(`SUMMARY ${passed}/${passed} PASS — simulated D1/Shopify, not production`);
