// Local-only ActeRO B5 visual review. Never uploads or displays private guide JS.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,isAbsolute,sep} from 'node:path';
import {webkit} from 'playwright';
const [privateJson,outputFolder,countryList]=process.argv.slice(2);
const countries=countryList?countryList.split(','):['IT','GB'];
const allowed=new Set(['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH']);
assert.ok(countries.length>0&&new Set(countries).size===countries.length&&countries.every(c=>allowed.has(c)),'Invalid country selection');
assert.ok(privateJson&&outputFolder&&isAbsolute(privateJson)&&isAbsolute(outputFolder),'Two absolute paths required');
const repo=resolve(new URL('../',import.meta.url).pathname);
assert.ok(!resolve(outputFolder).startsWith(repo+sep)&&resolve(outputFolder)!==repo,'No screenshots in repository');
const raw=JSON.parse(readFileSync(privateJson,'utf8'));
const rows=Array.isArray(raw)?(raw.length===1&&raw[0].results?raw[0].results:raw):raw.results;
assert.equal(rows.length,2);
const guides=new Map(rows.map(r=>[r.guide_key,r]));
assert.equal(guides.size,2);
const first=guides.get('B5_DAMAGED'),second=guides.get('B5_DATA_CHANGE');
assert.ok(first&&second&&first.route==='B5_EXISTING_CRDS'&&second.route===first.route);
assert.equal(first.script_js,second.script_js);
assert.ok(first.script_js.includes('Certificatul românesc de naștere'),'Not a checklist draft');
const html=readFileSync(resolve(repo,'index.html'),'utf8');
const css=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
assert.ok(css.length>3000);
mkdirSync(outputFolder,{recursive:true,mode:0o700});
const browser=await webkit.launch({headless:true});
let good=0,bad=0;
try{
for(const country of countries)for(const mode of ['DAMAGED','DATA_CHANGE'])for(const width of [320,390,430]){
 const tag=country+'_'+mode+'_'+width;
 const ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
 const page=await ctx.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/*',r=>r.abort());
  await page.setContent('<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="app guide-mode"><main class="wrap"><section class="card"><div id="screen"></div></section></main></div></body></html>');
  await page.addStyleTag({content:css});
  await page.evaluate(({country,mode})=>{
   window.screen=document.getElementById('screen');
   window.S={answers:{residence_country:country,civil_change:mode==='DATA_CHANGE'?'YES':'NO',civil_sync:mode==='DATA_CHANGE'?'NO':'YES',current_foreign_proof:'YES'},docs:{CRDS_PASSPORT:mode==='DAMAGED'?'DAMAGED':'VALID'}};
   window.statusLabels={DAMAGED:'deteriorat',VALID:'valabil'};
   window.identityKnown=()=> 'PASS';
   window.$=id=>document.getElementById(id);
   window.showResult=()=>{throw Error('No fallback expected')};
   window.updateDebug=()=>{};window.reset=()=>{};
  },{country,mode});
  await page.addScriptTag({content:first.script_js});
  await page.evaluate(mode=>showB5VariantGuide(mode),mode);
  const m=await page.evaluate(()=>{
   const cards=[...document.querySelectorAll('.personal-check')];
   const overflow=cards.filter(c=>c.scrollWidth>c.clientWidth+2||c.querySelector('.pc-top').scrollWidth>c.querySelector('.pc-top').clientWidth+2).length;
   return {page:document.documentElement.scrollWidth,view:innerWidth,rows:cards.length,overflow};
  });
  const ok=m.page<=m.view+2&&!m.overflow&&m.rows===(mode==='DAMAGED'?5:6)&&!errors.length;
  if(width===390){
   await page.locator('.final-sidebar').screenshot({path:resolve(outputFolder,tag+'_checklist.png')});
   await page.screenshot({path:resolve(outputFolder,tag+'_full.png'),fullPage:true});
  }
  if(ok){good++;console.log('PASS '+tag)}
  else{bad++;console.log('REVIEW '+tag+' overflow='+m.overflow+' width='+m.page+'/'+m.view+' rows='+m.rows)}
 }catch(e){bad++;console.log('REVIEW '+tag+' '+String(e.message).split('\n')[0]);}
 finally{await ctx.close()}
}
}finally{await browser.close()}
console.log('B5 MOBILE LAYOUT: '+good+'/'+(countries.length*2*3)+' checks passed; '+bad+' issues. Screenshots kept on Mac.');
if(bad)process.exitCode=1;
