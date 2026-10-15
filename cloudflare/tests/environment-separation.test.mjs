import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import worker from '../worker.js';
import {LEGACY,appOrigin,shopifyConfig} from '../environment.js';
import {recoveryConfigured} from '../recovery.js';
import {harness,order,state,checkoutId,bindings} from './helpers/payment-harness.mjs';
import {STAGING} from './fixtures/staging-environment.mjs';
import {frontendFiles} from '../../scripts/build-staging-frontend.mjs';
import {syntheticSeed} from '../staging/prepare-synthetic-seed.mjs';
import {validateConfig} from '../staging/check-config.mjs';

function setup(t){
  const h=harness();Object.assign(h.env,STAGING);t.after(()=>h.close());
  const mail=[];t.mock.method(globalThis,'fetch',async(url,options)=>{mail.push({url:String(url),body:JSON.parse(options.body)});return new Response('{}')});
  const api=(path,options={})=>h.api(path,{...options,headers:{Origin:STAGING.APP_ORIGIN,...options.headers}});
  const webhook=(payload,options={})=>h.webhook(payload,{shop:STAGING.SHOPIFY_SHOP_DOMAIN,secret:STAGING.SHOPIFY_WEBHOOK_SECRET,...options});
  const paid=(cid,extra={})=>{const data=order(cid,extra);data.line_items[0].variant_id=STAGING.SHOPIFY_VARIANT_ID;return data};
  const checkout=async()=>{
    const session=await api('/session');assert.equal(session.status,200);
    const response=await api('/checkout',{headers:{'X-Actero-Session-Token':session.data.session_token},body:{case_id:session.data.case_id,route:state.route,guide_key:'B1_ES',case_state:state}});
    assert.equal(response.status,200);
    return {...response.data,caseId:session.data.case_id,checkoutId:checkoutId(response.data.checkoutUrl)};
  };
  return {...h,api,webhook,paid,checkout,mail};
}

test('production defaults stay unchanged; staging never inherits shop or origin',()=>{
  assert.equal(appOrigin({}),LEGACY.origin);assert.deepEqual(shopifyConfig({}),{shop:LEGACY.shop,variant:LEGACY.variant});
  assert.equal(appOrigin({ACTERO_ENVIRONMENT:'staging'}),null);assert.equal(shopifyConfig({ACTERO_ENVIRONMENT:'staging'}),null);
  for(const origin of [LEGACY.origin,'http://staging.test','https://user:pass@staging.test','https://staging.test/path','https://staging.test?x=1','https://staging.test#x','*','null'])assert.equal(appOrigin({...STAGING,APP_ORIGIN:origin}),null);
  for(const change of [{SHOPIFY_SHOP_DOMAIN:LEGACY.shop},{SHOPIFY_VARIANT_ID:LEGACY.variant},{SHOPIFY_SHOP_DOMAIN:'evil.test'},{SHOPIFY_VARIANT_ID:'1?x=2'},{SHOPIFY_PAYMENT_MODE:'live'},{ACTERO_ENVIRONMENT:'stagign'}])assert.equal(shopifyConfig({...STAGING,...change}),null);
});

test('CORS permits only the selected origin on preflight, session, access and recovery',async t=>{
  const h=setup(t);h.env.SHOPIFY_CHECKOUT_ENABLED='false';
  for(const path of ['/session','/checkout','/recover/request','/recover/consume','/access']){
    const method=path==='/access'?'GET':'POST';
    const wrong=await worker.fetch(new Request('https://api.actero.test'+path,{method,headers:{Origin:LEGACY.origin}}),h.env);
    assert.equal(wrong.status,403);assert.equal(wrong.headers.get('Access-Control-Allow-Origin'),null);
    const preflight=await worker.fetch(new Request('https://api.actero.test'+path,{method:'OPTIONS',headers:{Origin:STAGING.APP_ORIGIN}}),h.env);
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),STAGING.APP_ORIGIN);
    assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/X-Actero-Access-Token/);
    const blocked=await worker.fetch(new Request('https://api.actero.test'+path,{method:'OPTIONS',headers:{Origin:'https://attacker.test'}}),h.env);
    assert.equal(blocked.status,403);
  }
  assert.equal((await h.api('/session')).data.error,'checkout_disabled');
});

test('interleaved environments never share request CORS configuration',async()=>{
  const responses=await Promise.all([{},STAGING,{},STAGING].map(env=>worker.fetch(new Request('https://api.test/health'),env)));
  assert.deepEqual(responses.map(r=>r.headers.get('Access-Control-Allow-Origin')),[LEGACY.origin,STAGING.APP_ORIGIN,LEGACY.origin,STAGING.APP_ORIGIN]);
});

test('checkout permalink uses the selected development shop and variant',async t=>{
  const h=setup(t),co=await h.checkout(),url=new URL(co.checkoutUrl);
  assert.equal(url.host,STAGING.SHOPIFY_SHOP_DOMAIN);assert.equal(url.pathname,'/cart/'+STAGING.SHOPIFY_VARIANT_ID+':1');
  assert(!co.checkoutUrl.includes(LEGACY.shop));assert(!co.checkoutUrl.includes(co.accessToken));
});

test('pending test payment and refund are processed with checkout DISABLED',async t=>{
  const h=setup(t),co=await h.checkout();h.env.SHOPIFY_CHECKOUT_ENABLED='false';
  assert.equal((await h.api('/checkout',{body:{}})).data.error,'checkout_disabled');
  assert.equal((await h.api('/session')).data.error,'checkout_disabled');
  assert.equal((await h.webhook(h.paid(co.checkoutId))).data.granted,true);
  const guide='/guide-script?case_id='+co.caseId+'&guide_key=B1_ES';
  const get=()=>worker.fetch(new Request('https://api.test'+guide,{headers:{Origin:STAGING.APP_ORIGIN,'X-Actero-Access-Token':co.accessToken}}),h.env);
  assert.equal((await get()).status,200);
  const refund={order_id:'100001',refund_line_items:[{quantity:1,line_item:{variant_id:STAGING.SHOPIFY_VARIANT_ID}}]};
  assert.equal((await h.webhook(refund,{topic:'refunds/create'})).data.outcome,'revoked');
  assert.equal((await get()).status,402);
  assert.equal((await h.webhook(h.paid(co.checkoutId))).data.ignored,'revoked_prior_to_payment');
});

for(const topic of ['orders/cancelled','disputes/create'])test(topic+' remains authenticated and effective with checkout disabled',async t=>{
  const h=setup(t),co=await h.checkout();await h.webhook(h.paid(co.checkoutId));h.env.SHOPIFY_CHECKOUT_ENABLED='false';
  const body={id:'100001',order_id:'100001',line_items:[{variant_id:STAGING.SHOPIFY_VARIANT_ID}]};
  assert.equal((await h.webhook(body,{topic,shop:LEGACY.shop})).status,403);
  assert.equal((await h.webhook(body,{topic,secret:bindings.SHOPIFY_WEBHOOK_SECRET})).status,401);
  assert.equal((await h.webhook(body,{topic})).data.outcome,'revoked');
});

test('staging rejects production signatures, shop, product and live orders',async t=>{
  const h=setup(t),co=await h.checkout();h.env.SHOPIFY_CHECKOUT_ENABLED='false';
  assert.equal((await h.webhook(h.paid(co.checkoutId),{secret:bindings.SHOPIFY_WEBHOOK_SECRET})).status,401);
  assert.equal((await h.webhook(h.paid(co.checkoutId),{shop:LEGACY.shop})).status,403);
  assert.equal((await h.webhook(order(co.checkoutId))).data.ignored,'not_actero_product');
  assert.equal((await h.webhook(h.paid(co.checkoutId,{test:false}))).data.reason,'payment_mode_mismatch');
  assert.equal(h.sql.prepare('SELECT status FROM access_grants').get().status,'pending');
});

test('unbound staging commerce blocks webhooks without touching the database',async t=>{
  const h=setup(t);delete h.env.SHOPIFY_SHOP_DOMAIN;
  assert.equal((await h.webhook(h.paid('synthetic-intent'))).status,503);
  assert.equal(h.sql.prepare('SELECT COUNT(*) AS n FROM payment_events').get().n,0);
});

test('recovery uses staging origin, rotates access with checkout off and is revoked after refund',async t=>{
  const h=setup(t),co=await h.checkout();await h.webhook(h.paid(co.checkoutId));h.env.SHOPIFY_CHECKOUT_ENABLED='false';
  assert(recoveryConfigured(h.env));assert(!recoveryConfigured({...h.env,RECOVERY_PAGE_URL:LEGACY.origin+'/recuperare.html'}));
  assert(!recoveryConfigured({...h.env,RECOVERY_PAGE_URL:'https://user:pass@staging.actero.test/recuperare.html'}));
  const request={email:'synthetic-buyer@example.test',order_name:'#100001'};
  assert.equal((await h.api('/recover/request',{body:request})).status,202);
  const message=h.mail.find(m=>m.url==='https://api.resend.com/emails').body;
  const link=new URL(message.text.match(/https:\/\/\S+/)[0]);assert.equal(link.origin,STAGING.APP_ORIGIN);assert.equal(link.pathname,'/recuperare.html');
  const token=new URLSearchParams(link.hash.slice(1)).get('token');
  const consumed=await h.api('/recover/consume',{body:{token}});assert.equal(consumed.status,200);assert.notEqual(consumed.data.access_token,co.accessToken);
  assert.equal((await h.api('/recover/consume',{body:{token}})).status,400);
  await h.webhook({order_id:'100001',refund_line_items:[{quantity:1,line_item:{variant_id:STAGING.SHOPIFY_VARIANT_ID}}]},{topic:'refunds/create'});
  const before=h.mail.length;await h.api('/recover/request',{body:request});assert.equal(h.mail.length,before);
});

test('strict preflight distinguishes an unbound closed plan from configured test commerce',()=>{
  const c=JSON.parse(readFileSync(new URL('../staging/wrangler.json.example',import.meta.url),'utf8'));
  c.account_id='0'.repeat(32);c.env.staging.d1_databases[0].database_id='22222222-2222-4222-8222-222222222222';
  const options={productionD1Id:'11111111-1111-4111-8111-111111111111',requireReady:true};
  assert.throws(()=>validateConfig(c,options));
  Object.assign(c.env.staging.vars,{APP_ORIGIN:STAGING.APP_ORIGIN,RECOVERY_PAGE_URL:STAGING.RECOVERY_PAGE_URL,SHOPIFY_SHOP_DOMAIN:STAGING.SHOPIFY_SHOP_DOMAIN,SHOPIFY_VARIANT_ID:STAGING.SHOPIFY_VARIANT_ID});
  assert(validateConfig(c,options));c.env.staging.vars.SHOPIFY_CHECKOUT_ENABLED='true';assert.throws(()=>validateConfig(c,options));
});

test('synthetic seed contains one noncommercial guide with exact approval hash and refuses overwrite',()=>{
  const db=new DatabaseSync(':memory:');try{
    db.exec(readFileSync(new URL('../staging/migrations/0001-empty-staging.sql',import.meta.url),'utf8'));db.exec(syntheticSeed());
    const guide=db.prepare('SELECT * FROM guide_scripts').get();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM guide_scripts').get().n,1);
    assert.equal(db.prepare('SELECT script_sha256 FROM guide_approvals').get().script_sha256,createHash('sha256').update(guide.script_js).digest('hex'));
    assert.match(guide.script_js,/nu este un ghid comercial/);assert.throws(()=>db.exec(syntheticSeed()),/UNIQUE/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM guide_country_approvals').get().n,0);
  }finally{db.close()}
});

test('frontend builder copies only public pages, preserves application scripts and closes checkout',()=>{
  const files=frontendFiles({origin:STAGING.APP_ORIGIN,apiOrigin:'https://api-staging.actero.test'});
  assert.deepEqual(Object.keys(files).sort(),['_headers','actero-config.js','confirmare.html','index.html','recuperare.html','robots.txt','staging-build.json']);
  const context={window:{}};vm.runInNewContext(files['actero-config.js'],context);
  assert.equal(context.window.ACTERO_CHECKOUT_ENABLED,false);assert.equal(context.window.ACTERO_PAYMENT_API,'https://api-staging.actero.test');
  for(const page of ['index.html','confirmare.html','recuperare.html']){
    const scripts=html=>[...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]);
    assert.deepEqual(scripts(files[page]),scripts(readFileSync(new URL('../../'+page,import.meta.url),'utf8')));
    assert.match(files[page],/STAGING — numai date sintetice/);
  }
  assert.match(files['_headers'],/noindex/);
  assert.throws(()=>frontendFiles({origin:LEGACY.origin,apiOrigin:'https://api-staging.test'}));
  assert.throws(()=>frontendFiles({origin:STAGING.APP_ORIGIN,apiOrigin:'https://actero.actedsro.workers.dev'}));
});

test('closing frontend checkout does not disable paid-access API calls',()=>{
 const source=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 const start=source.indexOf('function paymentApiBase(){'),end=source.indexOf('function acteroReturnUrl()',start);
 assert.equal(vm.runInNewContext(source.slice(start,end)+'paymentApiConfigured();',{window:{ACTERO_PAYMENT_API:'https://api-staging.actero.test',ACTERO_CHECKOUT_ENABLED:false}}),true);
});
