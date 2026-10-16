// Real frontend + workerd/D1 locally; Shopify checkout, signed webhook and email
// are SYNTHETIC. No network request reaches Shopify, Cloudflare or an email provider.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {localWorker} from './helpers/local-worker.mjs';
import {checkoutId,order as legacyOrder,signedRequest as legacySignedRequest} from './helpers/payment-harness.mjs';

import {STAGING} from './fixtures/staging-environment.mjs';
import {frontendFiles} from '../../scripts/build-staging-frontend.mjs';
const ORIGIN=STAGING.APP_ORIGIN,SHOP=STAGING.SHOPIFY_SHOP_DOMAIN,VARIANT=STAGING.SHOPIFY_VARIANT_ID;
const SITE=ORIGIN+'/',API='https://api-staging.actero.test';
const frontend=frontendFiles({origin:ORIGIN,apiOrigin:API});
const order=cid=>{const body=legacyOrder(cid);body.line_items[0].variant_id=VARIANT;return body};
const signedRequest=(body,options={})=>legacySignedRequest(body,{shop:SHOP,secret:STAGING.SHOPIFY_WEBHOOK_SECRET,...options});
let passed=0;
const pass=label=>{passed++;console.log('PASS '+label)};
const engines=process.env.ACTERO_TEST_BROWSERS?process.env.ACTERO_TEST_BROWSERS.split(','):['chromium','webkit'];
assert.ok(engines.length&&engines.every(e=>['chromium','webkit'].includes(e)),'Unknown browser selection');
for(const kind of engines){
  const backend=await localWorker({environment:STAGING});
  let browser;
  try{
    const executablePath=kind==='chromium'?process.env.ACTERO_CHROMIUM_EXECUTABLE:undefined;
    if(executablePath)assert.ok(existsSync(executablePath));
    browser=await ({chromium,webkit}[kind]).launch({headless:true,...(executablePath?{executablePath}:{})});
    const mobile=kind==='webkit';
    const context=await browser.newContext({viewport:{width:mobile?390:1280,height:900},isMobile:mobile,serviceWorkers:'block'});
    const pageErrors=[],checkoutUrls=[],apiStatuses=[],blockedRequests=[];
    async function waitGuide(target,label){
      try{await target.locator('#syntheticGuide').waitFor({timeout:10000})}
      catch(error){
        console.error('Synthetic journey diagnostic',JSON.stringify({kind,label,apiStatuses,pageErrors,blockedRequests,
          page:await target.evaluate(()=>({path:location.pathname,message:document.getElementById('message')?.textContent,
            checkoutError:document.getElementById('checkoutError')?.textContent,
            current:typeof S==='undefined'?null:S.current,route:typeof S==='undefined'?null:S.route,
            unlocked:typeof S==='undefined'?null:S.paymentUnlocked}))}));
        mkdirSync('browser-qa-screenshots',{recursive:true});
        await target.screenshot({path:'browser-qa-screenshots/payment-'+kind+'-'+label+'.png',fullPage:true}).catch(()=>{});
        throw error;
      }
    }
    async function routeContext(ctx){
      ctx.on('page',page=>page.on('pageerror',error=>pageErrors.push(error.message)));
      await ctx.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url());
        // WebKit may expose blob-script loads to interception. These are local
        // browser objects, not egress: allow the real protected loader to read them.
        if(url.protocol==='blob:'){await route.continue();return;}
        if(url.origin===API){
          const response=await backend.dispatch(new Request(request.url(),{method:request.method(),headers:{...await request.allHeaders(),'CF-Connecting-IP':'192.0.2.10'},body:request.postDataBuffer()??undefined}));
          apiStatuses.push({path:url.pathname,status:response.status});
          await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});return;
        }
        if(url.origin===ORIGIN){
          const name=url.pathname.slice(1)||'index.html';
          if(['index.html','confirmare.html','recuperare.html','actero-config.js'].includes(name)){
            // Enable checkout ONLY in the intercepted synthetic browser fixture. Generated artifacts stay closed.
            const body=name==='actero-config.js'?frontend[name].replace('ACTERO_CHECKOUT_ENABLED=false','ACTERO_CHECKOUT_ENABLED=true'):frontend[name];
            await route.fulfill({status:200,contentType:name.endsWith('.js')?'text/javascript':'text/html',body});return;
          }
        }
        if(url.hostname===SHOP){
          assert.equal(url.pathname,'/cart/'+VARIANT+':1');
          checkoutUrls.push(url.href);
          await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><h1>Checkout Shopify SIMULAT — 49 lei</h1><p>Nicio tranzacție nu este efectuată.</p>'});return;
        }
        blockedRequests.push({protocol:url.protocol,host:url.hostname});
        await route.abort(); // Fonts/other assets cannot cause external traffic either.
      });
    }
    await routeContext(context);
    const page=await context.newPage();page.setDefaultTimeout(10000);
    async function step(expected){await page.waitForFunction(value=>S.current===value,expected)}
    async function select(at,value,next){await step(at);await page.locator('#screen .option[data-value="'+value+'"]').click();if(next)await step(next)}
    await page.goto(SITE);await page.waitForFunction(()=>window.__ACTERO_BOOTED===true);
    await page.locator('#startEval').click();
    await select('Q001','YES','Q002');await select('Q002','YES','Q003');
    await page.locator('.country[data-code="ES"]').click();
    await select('Q004','ESTABLISH_FOREIGN_DOMICILE','Q005');
    await page.locator('.option[data-value="PASSPORT"]').click();await page.locator('#continue').click();
    await select('Q006','VALID','Q007');await select('Q007','ROMANIA','Q101');
    await select('Q101','RESIDENCE','Q102');await select('Q102','YES','Q103');
    await select('Q103','READY','Q040');await select('Q040','NO','RESULT');
    assert.match(await page.locator('#unlockResult').innerText(),/49 lei/);
    await page.locator('#unlockResult').click();await page.waitForURL('https://'+SHOP+'/**');
    assert.equal(checkoutUrls.length,1);
    const cid=checkoutId(checkoutUrls[0]);
    const grant=await backend.db.prepare('SELECT case_id FROM checkout_intents WHERE checkout_id=?').bind(cid).first();
    assert.ok(grant?.case_id);
    pass(kind+': questionnaire → 49 lei paywall → session → checkout intent → simulated Shopify');

    const confirmation=SITE+'confirmare.html?case_id='+grant.case_id;
    await page.goto(confirmation);
    const oldToken=await page.evaluate(id=>localStorage.getItem('actero_access_'+id),grant.case_id);
    assert.ok(oldToken);assert.ok(!checkoutUrls[0].includes(oldToken));
    assert.equal(await page.locator('#openGuide').isDisabled(),true);
    const get=async(path,token=oldToken)=>backend.dispatch(new Request(API+path,{headers:{Origin:ORIGIN,'X-Actero-Access-Token':token}}));
    const guidePath='/guide-script?case_id='+grant.case_id+'&guide_key=B1_ES';
    assert.equal((await get(guidePath)).status,402);
    assert.equal((await backend.dispatch(signedRequest(order(cid),{secret:'wrong'}))).status,401);
    assert.equal((await backend.dispatch(signedRequest(order(cid),{shop:'other.myshopify.com'}))).status,403);
    assert.equal((await get(guidePath)).status,402);
    pass(kind+': redirect and forged webhook cannot unlock an unpaid guide');

    const paid=await backend.dispatch(signedRequest(order(cid),{id:'synthetic-paid'}));
    assert.equal((await paid.json()).granted,true);
    assert.equal((await (await backend.dispatch(signedRequest(order(cid),{id:'synthetic-paid'}))).json()).duplicate,true);
    await page.reload();await page.waitForFunction(()=>!document.getElementById('openGuide').disabled);
    await page.locator('#openGuide').click();await waitGuide(page,'initial-delivery');
    assert.equal(await page.locator('#syntheticCountry').innerText(),'ES');
    assert.equal((await get(guidePath.replace('B1_ES','B1_IT'))).status,403);
    const delivered=await get(guidePath);assert.equal(delivered.status,200);assert.match(delivered.headers.get('Cache-Control'),/no-store/);
    const queryToken=await backend.dispatch(new Request(API+guidePath+'&access_token='+encodeURIComponent(oldToken)));
    assert.equal(queryToken.status,402);
    await page.reload();await waitGuide(page,'refresh');
    assert.equal(await page.evaluate(()=>loadProtectedPaidGuide()),true);
    pass(kind+': signed test payment → exact purchased guide → refresh; other keys and query tokens denied');

    // Temporarily withdrawing the synthetic approval must block even a cached tab.
    await backend.db.prepare("UPDATE guide_approvals SET status='revoked' WHERE guide_key='B1_ES'").run();
    assert.equal(await page.evaluate(()=>loadProtectedPaidGuide()),false);
    assert.equal(await page.evaluate(()=>S.paymentUnlocked),false);
    await backend.db.prepare("UPDATE guide_approvals SET status='approved' WHERE guide_key='B1_ES'").run();
    const storedScript=await backend.db.prepare("SELECT script_js FROM guide_scripts WHERE guide_key='B1_ES'").first();
    const revisedScript=storedScript.script_js+'\n// synthetic approved revision';
    await backend.db.batch([
      backend.db.prepare("UPDATE guide_scripts SET script_js=? WHERE guide_key='B1_ES'").bind(revisedScript),
      backend.db.prepare("UPDATE guide_approvals SET script_sha256=? WHERE guide_key='B1_ES'").bind(createHash('sha256').update(revisedScript).digest('hex'))
    ]);
    assert.equal(await page.evaluate(()=>loadProtectedPaidGuide()),false);
    await page.reload();await waitGuide(page,'approved-revision');
    pass(kind+': reopening rechecks approval; changed approved script requires a fresh document');

    const second=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await routeContext(second);const recovered=await second.newPage();
    await recovered.goto(SITE+'recuperare.html');
    await recovered.locator('#email').fill('synthetic-buyer@example.test');await recovered.locator('#order').fill('#100001');
    await recovered.locator('#send').click();
    await recovered.waitForFunction(()=>document.getElementById('message').textContent.includes('vei primi un link'));
    assert.equal(backend.mail.length,1);
    const link=backend.mail[0].text.match(/https:\/\/\S+/)[0];
    const challenge=new URLSearchParams(new URL(link).hash.slice(1)).get('token');
    await recovered.goto(link);
    await waitGuide(recovered,'recovery');
    const newToken=await recovered.evaluate(id=>localStorage.getItem('actero_access_'+id),grant.case_id);
    assert.notEqual(newToken,oldToken);assert.equal((await get(guidePath,oldToken)).status,402);
    assert.equal((await get(guidePath,newToken)).status,200);
    assert.ok(!recovered.url().includes(challenge));
    assert.equal(await recovered.locator('#syntheticCountry').innerText(),'ES');
    const consume=token=>backend.dispatch(new Request(API+'/recover/consume',{method:'POST',headers:{Origin:ORIGIN,'CF-Connecting-IP':'192.0.2.11','Content-Type':'application/json'},body:JSON.stringify({token})}));
    assert.equal((await consume(challenge)).status,400);
    pass(kind+': recovery in another browser context restores snapshot, rotates access and prevents replay');

    const reversal=await backend.dispatch(signedRequest({order_id:'100001',refund_line_items:[{quantity:1,line_item:{variant_id:VARIANT}}]},{topic:'refunds/create',id:'synthetic-refund'}));
    assert.equal((await reversal.json()).outcome,'revoked');
    assert.equal((await get(guidePath,newToken)).status,402);
    assert.equal(await recovered.evaluate(()=>loadProtectedPaidGuide()),false);
    await recovered.goto(confirmation);await recovered.getByRole('heading',{name:'Accesul la ghid a fost retras'}).waitFor();
    assert.equal(await recovered.locator('#openGuide').isDisabled(),true);
    await backend.dispatch(signedRequest(order(cid),{id:'synthetic-late-paid'}));
    assert.equal((await get(guidePath,newToken)).status,402);
    const emailCount=backend.mail.length;
    await recovered.goto(SITE+'recuperare.html');await recovered.locator('#email').fill('synthetic-buyer@example.test');await recovered.locator('#order').fill('100001');await recovered.locator('#send').click();
    await recovered.waitForFunction(()=>document.getElementById('message').textContent.includes('vei primi un link'));
    assert.equal(backend.mail.length,emailCount);
    pass(kind+': refund revokes delivery, cached reopening and recovery; delayed payment cannot restore access');
    assert.deepEqual(pageErrors,[]);assert.deepEqual(backend.unexpected,[]);
    await second.close();await context.close();
  }finally{await browser?.close();await backend.dispose()}
}
console.log(`LOCAL STAGING: ${passed}/${passed} checks passed. Real workerd/D1 + browser; simulated Shopify and email only.`);
