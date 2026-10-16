// Browser parity and pre-checkout tampering checks; interception denies all egress.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {frontendFiles} from '../../scripts/build-staging-frontend.mjs';
import {checkoutDecisionFor} from '../../shared/eligibility.mjs';
import {state} from './helpers/payment-harness.mjs';

const origin='https://actero-eligibility.invalid',apiOrigin='https://api-eligibility.invalid';
const files=frontendFiles({origin,apiOrigin});
const fixtures=[structuredClone(state)];
for(const patch of [{birth_cert:'MISSING'},{residence_country:'BE',local_proof_type:'PERMANENT'},{citizenship:'UNKNOWN'},{goal:'ID_PROBLEM',can_come:'YES',ro_address:'OWN'}]){
 const s=structuredClone(state);Object.assign(s.answers,patch);
 if(patch.goal)s.route='A1_PERSONAL_ROMANIA';fixtures.push(s);
}
const forged=structuredClone(state);forged.route='B5_EXISTING_CRDS';fixtures.push(forged);
let failures=0;
for(const [name,engine] of Object.entries({chromium,webkit})){
 let browser;
 try{
  browser=await engine.launch({headless:true,...(name==='chromium'&&process.env.ACTERO_CHROMIUM_EXECUTABLE?{executablePath:process.env.ACTERO_CHROMIUM_EXECUTABLE}:{})});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:name==='webkit'?390:1280,height:900}});
  const apiCalls=[],pageErrors=[];
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin===apiOrigin)apiCalls.push(url.pathname);
   const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(url.origin===origin&&Object.hasOwn(files,file)){
    const body=file==='actero-config.js'?files[file].replace('ACTERO_CHECKOUT_ENABLED=false','ACTERO_CHECKOUT_ENABLED=true'):files[file];
    return route.fulfill({status:200,contentType:file.endsWith('.js')?'text/javascript':'text/html',body});
   }
   return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(origin);await page.waitForFunction(()=>window.__ACTERO_BOOTED===true);
  for(const fixture of fixtures){
   const expected=checkoutDecisionFor(fixture);
   assert.deepEqual(await page.evaluate(s=>checkoutDecisionFor(s),fixture),expected,name+' parity');
   if(!expected.allowed||!expected.legalBasisConfirmed){
    await page.evaluate(async s=>{
     Object.assign(S,s,{caseId:'AR-12345678-1234-4123-8123-123456789012'});
     await startShopifyCheckout(null);
    },fixture);
   }
  }
  assert.deepEqual(apiCalls,[],name+' rejected cases must not open sessions or checkout');
  assert.deepEqual(pageErrors,[]);
  console.log('PASS '+name+': '+fixtures.length+' parity cases, no request for rejected cases');
 }catch(error){failures++;console.error('FAIL '+name+': '+error.message)}
 finally{await browser?.close()}
}
if(failures)process.exitCode=1;
