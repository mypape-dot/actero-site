// HISTORICAL renderer QA ONLY: executes existing public main branch generator,
// never private Cloudflare D1 content or a live paid request.
// Do not interpret PASS as verification of D1 byte-for-byte or legal guidance.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';

const legacy=execFileSync('git',['show','origin/main:index.html'],{
  encoding:'utf8',maxBuffer:8*1024*1024
});
const getFunction=(name,next)=>{
  const start=legacy.indexOf('function '+name+'(');
  const end=legacy.indexOf('\nfunction '+next+'(',start+15);
  assert.ok(start>=0&&end>start,'Historical function missing: '+name);
  return legacy.slice(start,end);
};
const functions=getFunction('b5CountryConfig','showB5VariantGuide')+
  '\n'+getFunction('showB5VariantGuide','showB5MovedCountryCompositeGuide');
const cases=[
  {country:'ES',name:'Spania',source:'PDF-Spania.pdf'},
  {country:'IT',name:'Italia',source:'PDF-Italia.pdf'},
  {country:'DE',name:'Germania',source:'PDF-Germania.pdf'},
  {country:'AT',name:'Austria',source:'PDF-Austria.pdf'},
  {country:'FR',name:'Franța',source:'PDF-Franta.pdf'},
  {country:'GB',name:'Regatul Unit',source:'PDF-Marea-Britanie.pdf'},
  {country:'BE',name:'Belgia',source:'dofi.ibz.be'},
  {country:'NL',name:'Țările de Jos',source:'government.nl'},
  {country:'IE',name:'Irlanda',source:'irishimmigration.ie'},
  {country:'CH',name:'Elveția',source:'sem.admin.ch'}
];
const modes=[
  {mode:'DAMAGED',label:'deteriorat',mainStep:'Păstrează și prezintă pașaportul deteriorat'},
  {mode:'DATA_CHANGE',label:'date actualizate',mainStep:'Rezolvă mai întâi schimbarea în actele românești'}
];
let passed=0,failed=0;
for(const [browserType,kind] of [[chromium,'chromium-desktop'],[webkit,'webkit-mobile']]){
  const browser=await browserType.launch({headless:true});
  try{
    for(const region of cases)for(const scenario of modes){
      const label=kind+' '+region.country+' '+scenario.mode;
      const context=await browser.newContext({
        viewport:{width:kind.includes('mobile')?390:1280,height:850},
        isMobile:kind.includes('mobile'),hasTouch:kind.includes('mobile')
      });
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      try{
        await page.setContent('<!doctype html><html lang="ro"><meta charset="UTF-8"><body><main id="screen"></main></body></html>');
        await page.evaluate(({country,mode})=>{
          window.screen=document.getElementById('screen');
          window.S={answers:{residence_country:country,civil_change:mode==='DATA_CHANGE'?'YES':'NO',
              civil_sync:mode==='DATA_CHANGE'?'NO':'YES',current_foreign_proof:'YES'},
            docs:{CRDS_PASSPORT:mode==='DAMAGED'?'DAMAGED':'VALID'}};
          window.statusLabels={DAMAGED:'deteriorat',VALID:'valabil'};
          window.identityKnown=()=> 'PASS';
          window.$=id=>document.getElementById(id);
          window.showResult=()=>{throw Error('Unexpected fallback')};
          window.updateDebug=()=>{};
          window.reset=()=>{};
        },{country:region.country,mode:scenario.mode});
        await page.addScriptTag({content:functions});
        await page.evaluate(mode=>showB5VariantGuide(mode),scenario.mode);
        const title=await page.locator('#screen .guide-hero h1').innerText();
        assert.ok(title.includes(region.name),label+' wrong country heading: '+title);
        assert.ok(title.includes(scenario.label),label+' wrong incident heading: '+title);
        const stepHeadings=await page.locator('#screen .real-guide-step h3').allInnerTexts();
        assert.ok(stepHeadings.includes(scenario.mainStep),
          label+' incident step missing: '+JSON.stringify(stepHeadings));
        assert.equal(stepHeadings.length,8,label+' incomplete procedural steps');
        const text=await page.locator('#screen').innerText();
        assert.ok(text.includes('Dovada actuală din '+region.name),
          label+' did not show country-specific proof');
        assert.ok(text.includes('Starea civilă / datele de identificare'),
          label+' missing checklist of civil data');
        assert.ok(text.includes('În cazul tău:'),label+' missing personal situation');
        assert.ok(text.includes('Verifică taxa și termenul'),label+' fee and timing step absent');
        assert.ok(text.includes('eConsulat'),label+' eConsulat steps absent');
        const href=await page.locator('#screen .verified-source').first().getAttribute('href');
        assert.ok(href?.includes(region.source),label+' wrong evidence source: '+href);
        if(scenario.mode==='DATA_CHANGE'){
          assert.ok(text.includes('înscrierea schimbării în actele de stare civilă românești'),
            label+' failed to explain Romanian civil registry prerequisite');
          assert.ok(text.includes('trebuie actualizată/confirmată'),
            label+' failed to flag unsynchronized civil records');
          assert.ok(!title.includes('deteriorat'),label+' inherited damaged heading');
        }else{
          assert.ok(text.includes('Nu îl arunca.'),label+' missing damaged-passport warning');
          assert.ok(!title.includes('date actualizate'),label+' inherited data-change heading');
        }
        // Re-evaluate the same paid-guide UI when a required residence proof is missing.
        // The guide must disclose the blocker instead of retaining an old "confirmed" state.
        await page.evaluate(mode=>{
          S.answers.current_foreign_proof='NO';
          if(mode==='DATA_CHANGE')S.answers.civil_sync='YES';
          showB5VariantGuide(mode);
        },scenario.mode);
        const revised=await page.locator('#screen').innerText();
        assert.ok(revised.includes('Nu ai confirmat încă această dovadă.'),
          label+' missing-proof warning absent');
        if(scenario.mode==='DATA_CHANGE'){
          assert.ok(revised.includes('nu apare o schimbare de stare civilă rămasă neînregistrată'),
            label+' confirmed civil-sync status not reflected in result');
          assert.ok(!revised.includes('trebuie actualizată/confirmată'),
            label+' stale civil-change warning despite confirmed registration');
        }
        assert.deepEqual(errors,[],label+' browser JavaScript errors');
        console.log('PASS '+label+' | incident + missing-proof + civil-sync matrix');
        passed++;
      }catch(e){
        failed++;
        console.error('FAIL '+label+'\n'+(e.stack||e));
      }finally{
        await context.close();
      }
    }
  }finally{await browser.close()}
}
console.log('HISTORICAL B5 RENDER QA: '+passed+'/'+(passed+failed)+
  ' passed for 10 countries × 2 incidents × 2 browser engines. Live D1 content NOT tested.');
if(failed)process.exitCode=1;
