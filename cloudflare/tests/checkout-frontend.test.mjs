// Run with: node --test cloudflare/tests/checkout-frontend.test.mjs
// Exercises the REAL startShopifyCheckout function extracted from index.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const start=html.indexOf('async function startShopifyCheckout(button){');
const end=html.indexOf('\n// One click on the paywall',start);
assert.ok(start>=0&&end>start,'checkout function must exist in index.html');
const functionSource=html.slice(start,end);

function harness({token='',reply={ok:true,data:{checkoutUrl:'https://shop.test/checkout',accessToken:'new-token'}},configured=true,storageFails=false}={}){
  const values=new Map(), calls=[], redirects=[];
  const box={textContent:'',classList:{remove(){} }};
  const button={disabled:false,textContent:'Plătește'};
  const caseId='AR-12345678-1234-4123-8123-123456789012';
  if(token)values.set('actero_access_'+caseId,token);
  const localStorage={
    getItem:k=>values.get(k)||null,
    setItem(k,v){if(storageFails)throw new Error('storage_unavailable');values.set(k,v)}
  };
  const context={
    S:{caseId,route:'B1_FIRST_CRDS',answers:{residence_country:'CH'}},
    paymentApiConfigured:()=>configured,
    paymentApiBase:()=> 'https://api.example.test',
    accessTokenForCase:()=>localStorage.getItem('actero_access_'+caseId)||'',
    acteroReturnUrl:()=> 'https://example.test/confirmare.html?case_id='+caseId,
    guideKeyForCurrent:()=> 'B1_CH',
    localStorage,
    persistCase(){},
    fetch:async(url,options)=>{
      calls.push({url,options});
      if(reply instanceof Error)throw reply;
      return {ok:reply.ok,status:reply.status??(reply.ok?200:409),json:async()=>reply.data};
    },
    window:{location:{assign:u=>redirects.push(u)}},
    $:()=>box,
    console:{error(){}}
  };
  const execute=vm.runInNewContext(functionSource+'\nstartShopifyCheckout;',context,{timeout:1000});
  return {run:()=>execute(button),button,calls,redirects,box,values,caseId};
}

test('first checkout has no token header and saves token before redirect',async()=>{
  const h=harness();await h.run();
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].options.headers['X-Actero-Access-Token'],undefined);
  assert.equal(h.values.get('actero_access_'+h.caseId),'new-token');
  assert.equal(h.redirects[0],'https://shop.test/checkout');
  assert.equal(JSON.parse(h.calls[0].options.body).guide_key,'B1_CH');
});

test('repeat checkout sends stored token and replaces it only after success',async()=>{
  const h=harness({token:'original-token'});await h.run();
  assert.equal(h.calls[0].options.headers['X-Actero-Access-Token'],'original-token');
  assert.equal(h.values.get('actero_access_'+h.caseId),'new-token');
  assert.equal(h.redirects.length,1);
});

for(const [code,expected] of [
 ['case_in_progress','Există deja o încercare'],
 ['case_route_changed','Ai modificat răspunsurile'],
 ['already_paid','deja ca plătită']
]){
  test('409 '+code+' stops redirect and explains the condition',async()=>{
    const h=harness({token:'old-token',reply:{ok:false,status:409,data:{error:code}}});
    await h.run();
    assert.equal(h.redirects.length,0);
    assert.equal(h.values.get('actero_access_'+h.caseId),'old-token');
    assert.ok(h.box.textContent.includes(expected));
    assert.equal(h.button.disabled,false);
  });
}

test('network error does not erase token or redirect',async()=>{
  const h=harness({token:'old-token',reply:new Error('timeout')});await h.run();
  assert.equal(h.redirects.length,0);
  assert.equal(h.values.get('actero_access_'+h.caseId),'old-token');
  assert.equal(h.button.disabled,false);
});

test('missing API configuration does not call checkout',async()=>{
  const h=harness({configured:false});await h.run();
  assert.equal(h.calls.length,0);
  assert.equal(h.redirects.length,0);
});

test('unable to persist the token blocks redirect after server success',async()=>{
  const h=harness({storageFails:true});await h.run();
  assert.equal(h.redirects.length,0);
  assert.equal(h.button.disabled,false);
});

test('the client never places the access token in checkout URL or body',async()=>{
  const h=harness({token:'old-token'});await h.run();
  assert.equal(h.redirects[0].includes('new-token'),false);
  assert.equal(h.calls[0].options.body.includes('old-token'),false);
});
