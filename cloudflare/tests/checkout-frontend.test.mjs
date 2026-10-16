// Run: node --test cloudflare/tests/checkout-frontend.test.mjs
// Executes the REAL startShopifyCheckout() extracted from the repository's index.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const start=html.indexOf('async function startShopifyCheckout(button){');
const end=html.indexOf('\n// One click on the paywall',start);
assert.ok(start>=0&&end>start);
const source=html.slice(start,end);
const oldCase='AR-12345678-1234-4123-8123-123456789012';
const serverCase='AR-98765432-1234-4123-8123-123456789012';
const secret='a'.repeat(64);
function harness({access='',session='',sessionReply={ok:true,case_id:serverCase,session_token:secret},checkoutReply={checkoutUrl:'https://shop.test/checkout',accessToken:'new-access-token'},error=null,configured=true,storageFails=false}={}){
 const store=new Map(),requests=[],redirects=[];
 if(access)store.set('actero_access_'+oldCase,access);
 if(session)store.set('actero_session_'+oldCase,session);
 const button={disabled:false,textContent:'Plătește'};
 const box={textContent:'',classList:{remove(){}}};
 const context={
  S:{caseId:oldCase,route:'B1_FIRST_CRDS',answers:{residence_country:'IT'},docs:{},clarified:{},status:'GREEN'},
  paymentApiConfigured:()=>configured,paymentApiBase:()=> 'https://api.example.test',
  guideKeyForCurrent:()=> 'B1_IT',
  caseStorageKey:id=>'actero_case_'+id,
  accessTokenForCase:()=>store.get('actero_access_'+context.S.caseId)||'',
  acteroReturnUrl:()=> 'https://example.test/confirmare.html?case_id='+context.S.caseId,
  localStorage:{
   getItem:key=>store.get(key)||null,
   setItem(key,value){if(storageFails)throw Error('storage_unavailable');store.set(key,value)}
  },
  persistCase(){if(!storageFails)store.set('actero_case_'+context.S.caseId,'saved')},
  fetch:async(url,options)=>{
   requests.push({url,options});
   if(error)throw error;
   if(url.endsWith('/session')){
    return {ok:!!sessionReply?.ok,status:sessionReply?.ok?200:429,json:async()=>sessionReply};
   }
   if(url.endsWith('/checkout')){
    const good=!!checkoutReply?.checkoutUrl;
    return {ok:good,status:good?200:409,json:async()=>checkoutReply};
   }
   throw Error('Unexpected URL '+url);
  },
  window:{location:{assign:url=>redirects.push(url)}},
  $:()=>box,console:{error(){}}
 };
 const run=vm.runInNewContext(source+'\nstartShopifyCheckout;',context,{timeout:1000});
 return {run:()=>run(button),context,button,store,requests,redirects,box};
}
test('first purchase obtains backend session, persists case, then sends authenticated checkout',async()=>{
 const h=harness();await h.run();
 assert.equal(h.requests.length,2);
 assert.ok(h.requests[0].url.endsWith('/session'));
 assert.ok(h.requests[1].url.endsWith('/checkout'));
 assert.equal(h.context.S.caseId,serverCase);
 assert.equal(h.store.get('actero_session_'+serverCase),secret);
 assert.equal(h.requests[1].options.headers['X-Actero-Session-Token'],secret);
 assert.equal(JSON.parse(h.requests[1].options.body).case_id,serverCase);
 assert.equal(h.store.get('actero_access_'+serverCase),'new-access-token');
 assert.equal(h.redirects.length,1);
});
test('retry with access token skips session creation and rotates paid-access token',async()=>{
 const h=harness({access:'old-access'});await h.run();
 assert.equal(h.requests.length,1);
 assert.equal(h.requests[0].options.headers['X-Actero-Access-Token'],'old-access');
 assert.equal(h.store.get('actero_access_'+oldCase),'new-access-token');
});
test('existing server session is reused without new session call',async()=>{
 const h=harness({session:secret});await h.run();
 assert.equal(h.requests.length,1);
 assert.equal(h.requests[0].options.headers['X-Actero-Session-Token'],secret);
});
test('session failure prevents checkout and keeps original case',async()=>{
 const h=harness({sessionReply:{ok:false,error:'too_many_requests'}});await h.run();
 assert.equal(h.requests.length,1);
 assert.equal(h.redirects.length,0);
 assert.equal(h.context.S.caseId,oldCase);
 assert.ok(h.box.textContent.includes('prea multe încercări'));
});
test('malformed session token cannot open checkout',async()=>{
 const h=harness({sessionReply:{ok:true,case_id:serverCase,session_token:'bad'}});await h.run();
 assert.equal(h.requests.length,1);assert.equal(h.redirects.length,0);
});
test('local storage failure prevents checkout and redirect',async()=>{
 const h=harness({storageFails:true});await h.run();
 assert.equal(h.requests.length,1);assert.equal(h.redirects.length,0);
});
test('network errors do not redirect or charge',async()=>{
 const h=harness({error:new Error('offline')});await h.run();
 assert.equal(h.redirects.length,0);assert.equal(h.button.disabled,false);
});
test('missing configured API makes no network calls',async()=>{
 const h=harness({configured:false});await h.run();
 assert.equal(h.requests.length,0);
});
test('session secret and access token are never written into URL or checkout body',async()=>{
 const h=harness();await h.run();
 assert.equal(h.redirects[0].includes(secret),false);
 assert.equal(h.redirects[0].includes('new-access-token'),false);
 assert.equal(h.requests[1].options.body.includes(secret),false);
});

test('staging frontend checkout switch blocks new purchases even with API configured',async()=>{
 const h=harness();h.context.window.ACTERO_CHECKOUT_ENABLED=false;await h.run();assert.equal(h.requests.length,0);assert.equal(h.redirects.length,0);
});
