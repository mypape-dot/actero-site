// Real-browser ActeRO smoke tests (Chromium desktop + WebKit mobile emulation).
// No Shopify/Cloudflare calls, real payments, or private guide scripts are needed.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname, basename} from 'node:path';
import {chromium, webkit} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const server=createServer((request,response)=>{
  const name=new URL(request.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!['index.html','actero-config.js'].includes(name)){
    response.writeHead(404);response.end();return;
  }
  response.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});
  response.end(readFileSync(resolve(root,name)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/index.html';
const screenshotDir=resolve(root,'browser-qa-screenshots');
mkdirSync(screenshotDir,{recursive:true});
let failures=0,ran=0;

async function step(page,state){
  await page.waitForFunction(expected=>typeof S!=='undefined'&&S.current===expected,state,{timeout:7000});
}
async function select(page,state,value,next){
  await step(page,state);
  await page.locator('#screen .option[data-value="'+value+'"]').click();
  if(next)await step(page,next);
}
async function country(page,code){
  await step(page,'Q003');
  await page.locator('#countryList .country[data-code="'+code+'"]').click();
  await step(page,'Q004');
}
async function start(page){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__ACTERO_BOOTED===true);
  await page.locator('#startEval').click();
  await step(page,'Q001');
  await select(page,'Q001','YES','Q002');
  await select(page,'Q002','YES','Q003');
}
async function docs(page,ids,states={}){
  await step(page,'Q005');
  for(const id of ids)await page.locator('#screen .option[data-value="'+id+'"]').click();
  await page.locator('#continue').click();
  if(ids.some(d=>['PASSPORT','ROMANIAN_ID','CRDS_PASSPORT','CEI'].includes(d))){
    for(const id of ids.filter(d=>['PASSPORT','ROMANIAN_ID','CRDS_PASSPORT','CEI'].includes(d))){
      await step(page,'Q006');
      await page.locator('#screen .option[data-value="'+(states[id]||'VALID')+'"]').click();
    }
  }
}
async function snapshot(page){
  return page.evaluate(()=>({current:S.current,route:S.route,caseId:S.caseId,
    answers:{...S.answers},docs:{...S.docs},paymentConfigured:!!window.ACTERO_PAYMENT_API}));
}
async function assertNoOverflow(page){
  const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,
    viewport:window.innerWidth,body:document.body.scrollWidth}));
  assert.ok(sizes.scroll<=sizes.viewport+2,'Horizontal overflow '+JSON.stringify(sizes));
}
async function browserCase(browser,label,test,contextOptions={}){
  const context=await browser.newContext({viewport:{width:contextOptions.isMobile?390:1280,height:contextOptions.isMobile?844:900},
    isMobile:!!contextOptions.isMobile,hasTouch:!!contextOptions.isMobile});
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  try{
    await test(page);
    await assertNoOverflow(page);
    assert.deepEqual(pageErrors,[],'JavaScript exceptions: '+pageErrors.join('; '));
    console.log('PASS '+label);
  }catch(error){
    failures++;
    const filepath=resolve(screenshotDir,label.replace(/[^a-z0-9-]/gi,'_')+'.png');
    try{await page.screenshot({path:filepath,fullPage:true,timeout:5000})}catch{}
    console.error('FAIL '+label+': '+(error.stack||error));
  }finally{ran++;await context.close()}
}

async function firstCRDS(page,code='ES'){
  await start(page);
  await country(page,code);
  await select(page,'Q004','ESTABLISH_FOREIGN_DOMICILE','Q005');
  await docs(page,['PASSPORT']);
  await select(page,'Q007','ROMANIA','Q101');
  await select(page,'Q101','RESIDENCE','Q102');
  await select(page,'Q102','YES',code==='CH'?'Q109':'Q103');
}

try{
  for(const [engine,kind] of [[chromium,'chromium-desktop'],[webkit,'webkit-mobile']]){
    const browser=await engine.launch({headless:true});
    const mobile=kind.includes('mobile');
    try{
      await browserCase(browser,kind+'-paywall-refresh',async page=>{
        await firstCRDS(page,'ES');
        await select(page,'Q103','READY','Q040');
        await select(page,'Q040','NO','RESULT');
        const before=await snapshot(page);
        assert.equal(before.route,'B1_FIRST_CRDS');
        assert.equal(before.paymentConfigured,false);
        assert.equal(await page.locator('#unlockResult').count(),1);
        assert.equal(await page.locator('#unlockResult').isDisabled(),true);
        await page.reload({waitUntil:'domcontentloaded'});
        await step(page,'RESULT');
        const after=await snapshot(page);
        assert.equal(after.caseId,before.caseId);
        assert.equal(after.answers.residence_country,'ES');
        assert.equal(after.answers.birth_cert,'READY');
        assert.equal(await page.locator('#unlockResult').isDisabled(),true);
      },{isMobile:mobile});

      await browserCase(browser,kind+'-unresolved-before-pay',async page=>{
        await firstCRDS(page,'ES');
        await select(page,'Q103','UNKNOWN','RESULT');
        assert.equal(await page.locator('#unlockResult').count(),0);
        const clarification=page.locator('#clarifyNow');
        assert.equal(await clarification.count(),1);
        await clarification.click();
        await step(page,'Q103');
        await select(page,'Q103','UNKNOWN','RESULT');
        assert.equal(await page.locator('#unlockResult').count(),0);
        assert.equal(await page.locator('#clarifyNow').count(),0);
      },{isMobile:mobile});

      await browserCase(browser,kind+'-back-and-revise',async page=>{
        await start(page);
        await country(page,'ES');
        await select(page,'Q004','ESTABLISH_FOREIGN_DOMICILE','Q005');
        await page.locator('#screen .option[data-value="PASSPORT"]').click();
        await page.locator('#screen .option[data-value="ROMANIAN_ID"]').click();
        await page.locator('#continue').click();
        await select(page,'Q006','VALID','Q006');
        await select(page,'Q006','EXPIRED','Q007');
        const prior=await snapshot(page);
        assert.equal(prior.docs.PASSPORT,'VALID');
        let backClicks=0;
        while((await snapshot(page)).current!=='Q005'&&backClicks<7){
          await page.locator('#back').click();
          await page.waitForTimeout(80);
          backClicks++;
        }
        assert.equal((await snapshot(page)).current,'Q005','Could not return to document selection');
        await page.locator('#screen .option[data-value="PASSPORT"]').click();
        await page.locator('#continue').click();
        const revised=await snapshot(page);
        assert.equal(revised.docs.PASSPORT,undefined,'Deselected passport still has a saved status');
        assert.ok(!revised.answers.passport_domicile);
      },{isMobile:mobile});

      await browserCase(browser,kind+'-swiss-G-block',async page=>{
        await firstCRDS(page,'CH');
        await select(page,'Q109','G');
        await page.waitForFunction(()=>S.current.startsWith('STOP_'));
        assert.equal(await page.locator('#unlockResult').count(),0);
        assert.match(await page.locator('#screen h1').innerText(),/Permisul G/);
      },{isMobile:mobile});
    }finally{await browser.close()}
  }
}finally{server.close()}
console.log('BROWSER QA: '+(ran-failures)+'/'+ran+' passed');
if(failures)process.exitCode=1;
