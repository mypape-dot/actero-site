import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import worker from '../../worker.js';

export const ORIGIN='https://mypape-dot.github.io';
export const SHOP='gyfu4v-5q.myshopify.com';
export const VARIANT=67640764400007;
export const state={route:'B1_FIRST_CRDS',answers:{residence_country:'ES'},docs:{PASSPORT:'VALID'},status:'GREEN',clarified:{}};
export const syntheticScript="window.acteroSyntheticGuide=true;";
export const migrations=()=>readdirSync(new URL('../../',import.meta.url)).filter(n=>/^\d{3}-.*\.sql$/.test(n)).sort();
export const migrationSQL=name=>readFileSync(new URL('../../'+name,import.meta.url),'utf8');
export const baseline=()=>readFileSync(new URL('../fixtures/local-baseline.sql',import.meta.url),'utf8');
export const bindings={SHOPIFY_CHECKOUT_ENABLED:'true',SHOPIFY_PAYMENT_MODE:'test',
  SHOPIFY_WEBHOOK_SECRET:'synthetic-webhook-secret-only',PAYMENT_ALERT_WEBHOOK_URL:'https://alerts.invalid/mock',
  ABUSE_HASH_PEPPER:'synthetic-abuse-pepper-00000000000000000000',RECOVERY_REQUIRED:'true',
  RECOVERY_EMAIL_PEPPER:'synthetic-email-pepper-00000000000000000000',RECOVERY_EMAIL_API_KEY:'synthetic-email-api-key',
  RECOVERY_EMAIL_FROM:'support@example.test',RECOVERY_PAGE_URL:ORIGIN+'/actero-site/recuperare.html'};
export const checkoutId=url=>JSON.parse(Buffer.from(new URL(url).searchParams.get('properties'),'base64url'))._actero_checkout_id;
export function order(cid,extra={}){
  return {id:'100001',name:'#100001',email:'synthetic-buyer@example.test',test:true,financial_status:'paid',currency:'RON',total_price:'49.00',
    line_items:[{variant_id:VARIANT,quantity:1,price:'49.00',total_discount:'0.00',discount_allocations:[],properties:[{name:'_actero_checkout_id',value:cid}]}],...extra};
}
export function signedRequest(body,{topic='orders/paid',secret=bindings.SHOPIFY_WEBHOOK_SECRET,id=randomUUID(),shop=SHOP}={}){
  const raw=JSON.stringify(body);
  return new Request('https://api.actero.test/webhooks/shopify/'+topic.replace('/','-'),{method:'POST',body:raw,headers:{
    'X-Shopify-Hmac-Sha256':createHmac('sha256',secret).update(raw).digest('base64'),
    'X-Shopify-Shop-Domain':shop,'X-Shopify-Topic':topic,'X-Shopify-Webhook-Id':id}});
}
export function harness({stagingSchema=false,script=syntheticScript}={}){
  const sql=new DatabaseSync(':memory:');
  if(stagingSchema)sql.exec(readFileSync(new URL('../../staging/migrations/0001-empty-staging.sql',import.meta.url),'utf8'));
  else{sql.exec(baseline());for(const name of migrations())sql.exec(migrationSQL(name));}
  sql.prepare('INSERT INTO guide_scripts(guide_key,route,title,script_js) VALUES(?,?,?,?)').run('B1_ES',state.route,'SYNTHETIC ONLY',script);
  sql.prepare("INSERT INTO guide_approvals(guide_key,route,script_sha256,status,reviewer_reference,approved_at) VALUES(?,?,?,'approved','synthetic-only',datetime('now'))")
    .run('B1_ES',state.route,createHash('sha256').update(script).digest('hex'));
  const statement=(query,args=[])=>({bind:(...values)=>statement(query,values),first:async()=>sql.prepare(query).get(...args)??null,
    run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}}),
    exec:()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})});
  const DB={prepare:query=>statement(query),batch:async statements=>{sql.exec('BEGIN');try{const out=statements.map(s=>s.exec());sql.exec('COMMIT');return out}catch(error){sql.exec('ROLLBACK');throw error}}};
  const env={...bindings,DB};let address=0;
  async function api(path,{method='POST',body,headers={}}={}){
    const response=await worker.fetch(new Request('https://api.actero.test'+path,{method,headers:{Origin:ORIGIN,'CF-Connecting-IP':'192.0.2.'+(++address),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env);
    return {status:response.status,data:await response.json()};
  }
  async function checkout(){
    const session=await api('/session');
    const result=await api('/checkout',{body:{case_id:session.data.case_id,route:state.route,guide_key:'B1_ES',case_state:state},headers:{'X-Actero-Session-Token':session.data.session_token}});
    if(result.status!==200)throw Error('Synthetic checkout failed: '+JSON.stringify(result));
    return {...result.data,caseId:session.data.case_id,checkoutId:checkoutId(result.data.checkoutUrl)};
  }
  async function webhook(body,options){const r=await worker.fetch(signedRequest(body,options),env);return {status:r.status,data:await r.json()}}
  return {sql,env,api,checkout,webhook,close:()=>sql.close()};
}
