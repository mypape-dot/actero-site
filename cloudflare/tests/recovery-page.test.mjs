// Browser-like smoke test without network or Playwright, using the real recuperare.html script.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../../recuperare.html',import.meta.url),'utf8');
const code=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(code,'recovery page must contain client script');
let count=0;const check=(name,condition)=>{assert.ok(condition,name);count++;console.log('PASS '+name)};
async function run({fragment='',blocked=false,respond=true,configured=true}={}){
  const token='a'.repeat(64),url='https://mypape-dot.github.io/actero-site/recuperare.html';
  const elems=new Map(),storage=new Map(),requests=[],redirects=[],replaced=[];
  for(const key of ['requestSection','consumeSection','message','send','email','order','recoveryForm'])
    elems.set(key,{hidden:key==='consumeSection',disabled:false,textContent:'',value:key==='email'?'buyer@example.com':key==='order'?'#1001':'',addEventListener(name,fn){this[name]=fn}});
  const localStorage={setItem(k,v){if(blocked)throw Error('storage blocked');storage.set(k,v)},removeItem(k){storage.delete(k)}};
  const location={hash:fragment?'#token='+token:'',pathname:'/actero-site/recuperare.html',search:'',href:url+(fragment?'#token='+token:''),replace:u=>redirects.push(u)};
  const context={window:{ACTERO_PAYMENT_API:configured?'https://worker.invalid':''},location,history:{replaceState(...x){replaced.push(x)}},document:{getElementById:id=>elems.get(id)},localStorage,URL,URLSearchParams,console,
    fetch:async(url,opts)=>{requests.push({url,opts});return {ok:respond,json:async()=>({ok:true,case_id:'AR-11111111-1111-4111-8111-111111111111',access_token:'old.new',case_state:{route:'B1_FIRST_CRDS',answers:{residence_country:'CH'},docs:{},status:'GREEN',clarified:{Q109:1}}})}}
  };
  vm.runInNewContext(code,context,{timeout:1000});
  for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
  return {elems,storage,requests,redirects,replaced,token,location};
}
const pageReady=await run();check('request form available without token',pageReady.requests.length===0&&!pageReady.elems.get('requestSection').hidden);
const inactive=await run({fragment:true,configured:false});check('unconfigured API never consumes a recovery token',inactive.requests.length===0&&inactive.redirects.length===0);
const denied=await run({fragment:true,blocked:true});check('blocked storage prevents one-time token consumption',denied.requests.length===0&&denied.redirects.length===0);
const granted=await run({fragment:true});check('recovery link sent by POST, without token in URL',granted.requests.length===1&&granted.requests[0].opts.method==='POST'&&!granted.requests[0].url.includes(granted.token));
check('successful recovery saves case token and evaluation',granted.storage.has('actero_access_AR-11111111-1111-4111-8111-111111111111')&&granted.storage.has('actero_case_AR-11111111-1111-4111-8111-111111111111'));
check('successful recovery redirects to paid guide',granted.redirects.length===1&&granted.redirects[0].includes('open_guide=1'));
check('recovery secret removed from browser URL immediately',granted.replaced.length===1);
console.log(`SUMMARY ${count}/${count} PASS (synthetic browser)`);
