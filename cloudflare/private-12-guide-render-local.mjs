// ActeRO private visual QA: 12 FR/BE/NL/IE guides, two offline browser sizes.
// Read only Cloudflare SELECT piped on authorized operator's own Mac. No D1 writes.
// Screenshots contain proprietary guide text and MUST remain outside public repo.
// This is a diagnostic harness, NOT proof of legal validity or live paid flow.
import {readFileSync,mkdirSync,existsSync,realpathSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
import {inspectPrivateExport} from './private-12-guide-preflight-local.mjs';
import {rendererFor,diagnosticEntrypoints,scriptShape} from './private-12-render-selector.mjs';

const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const countries={FR:'Franța',BE:'Belgia',NL:'Țările de Jos',IE:'Irlanda'};
const modes=[
 {name:'chromium-1280',browser:chromium,width:1280,height:900,mobile:false},
 {name:'webkit-390',browser:webkit,width:390,height:844,mobile:true}
];
function privateFolder(p){
 if(!p||!isAbsolute(p))throw Error('ABSOLUTE_OUTPUT_DIRECTORY_REQUIRED');
 const parent=realpathSync(dirname(p));
 if(parent===root||parent.startsWith(root+sep))throw Error('OUTPUT_INSIDE_PUBLIC_REPO');
 if(existsSync(p))throw Error('OUTPUT_ALREADY_EXISTS');
 mkdirSync(p,{mode:0o700});
 return p;
}
function extractRows(data){
 const raw=JSON.parse(data);
 const rows=Array.isArray(raw)&&raw.length===1&&Array.isArray(raw[0]?.results)?raw[0].results:
   Array.isArray(raw)&&raw.every(x=>x&&typeof x==='object'&&'guide_key' in x)?raw:
   Array.isArray(raw?.results)?raw.results:null;
 if(!Array.isArray(rows))throw Error('UNSUPPORTED_D1_SHAPE');
 return {raw,rows};
}
function visibleCss(){
 const html=readFileSync(join(root,'index.html'),'utf8');
 return [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('\n');
}
// Use the EXACT publicly shipped helper, never an invented stand-in.
// The private D1 scripts reference it as an external frontend dependency.
export function publicMiniFormPreviewSource(html){
 const needle='function miniFormPreview(title,anexa){';
 const start=html.indexOf(needle);
 if(start<0||html.indexOf(needle,start+needle.length)!==-1)
   throw Error('PUBLIC_HELPER_MISSING_OR_AMBIGUOUS');
 const end=html.indexOf('\n}\n',start);
 if(end<0||end-start>4000)throw Error('PUBLIC_HELPER_CHANGED');
 const helper=html.slice(start,end+2);
 if(!helper.includes('real-doc-page')||!helper.includes('doc-mini'))
   throw Error('PUBLIC_HELPER_SIGNATURE_CHANGED');
 return helper;
}
function baseAnswers(country,key){
 const first=key.startsWith('B1_');
 const lost=key.startsWith('B5_LOST_');
 return {
   residence_country:country,residence_country_name:countries[country],
   age:'YES',citizenship:'YES',foreign_basis:'RESIDENCE',
   foreign_proof:'YES',current_foreign_proof:'YES',
   birth_cert:'READY',civil_change:'NO',civil_sync:'YES',
   same_country:'YES',passport_domicile:first?'ROMANIA':'CURRENT',
   ever_crds:first?'NO':'YES',
   b5case:lost?'LOST':'RENEWAL',travel_urgent_basis:'CONTINUE_JOURNEY'
 };
}
async function renderOne(browser,scenario,row,outputDir,css,publicHelper,claimsOnly=false){
 const {guide_key:key,script_js:script}=row;
 const selected=rendererFor(key,script);
 const label=key+'-'+scenario.name;
 if(!selected.entrypoint)return {
   guide_key:key,viewport:scenario.name,status:'REVIEW',
   flags:['RENDER_ENTRYPOINT_'+selected.reason],
   candidate_function_identifiers:diagnosticEntrypoints(script),
   script_shape:scriptShape(script)
 };
 const context=await browser.newContext({
   viewport:{width:scenario.width,height:scenario.height},
   isMobile:scenario.mobile,hasTouch:scenario.mobile
 });
 const page=await context.newPage();
 const pageErrors=[];
 let phase='CONTEXT_SETUP';
 page.on('pageerror',()=>pageErrors.push('EXCEPTION'));
 await page.route('**/*',route=>route.abort()); // Strictly offline: no remote requests.
 try{
   phase='HTML_SETUP';
   await page.setContent('<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+css+'</head><body><main id="screen"></main></body></html>');
   phase='FIXTURE_SETUP';
   await page.evaluate(({country,key,answers})=>{
     window.screen=document.getElementById('screen');
     window.S={route:key.startsWith('B1_')?'B1_FIRST_CRDS':'B5_EXISTING_CRDS',
       current:'RESULT',status:'GREEN',answers,
       docs:key.startsWith('B1_')?{PASSPORT:'VALID'}:
         {CRDS_PASSPORT:key.startsWith('B5_LOST_')?'LOST':'EXPIRED'},
       blockers:[],unknowns:[],clarified:{}};
     window.statusLabels={VALID:'valabil',EXPIRED:'expirat',LOST:'pierdut',UNKNOWN:'nu știu'};
     window.docLabels={PASSPORT:'pașaport',CRDS_PASSPORT:'pașaport CRDS'};
     window.identityKnown=()=> 'PASS';
     window.$=id=>document.getElementById(id);
     window.updateDebug=()=>{};
     window.updateCaseSide=()=>{};
     window.setChrome=()=>{};
     window.showResult=()=>{throw Error('FALLBACK_TO_UNPAID_RESULT')};
     window.reset=()=>{};
   },{country:selected.country,key,answers:baseAnswers(selected.country,key)});
   phase='PUBLIC_HELPER_LOAD';
   await page.addScriptTag({content:publicHelper});
   phase='PRIVATE_SCRIPT_LOAD';
   await page.addScriptTag({content:script});
   phase='GUIDE_ENTRYPOINT_CALL';
   // Catch errors INSIDE the browser; Playwright errors otherwise include
   // source excerpts or proprietary function bodies. Only sanitized categories escape.
   const invocation=await page.evaluate(async ({name,mode})=>{
     const fn=window[name];
     if(typeof fn!=='function')return {called:false,kind:'ENTRYPOINT_NOT_EXPOSED'};
     try{
       await fn(mode);
       return {called:true};
     }catch(error){
       const value=String(error?.message||'');
       const knownTypes=['ReferenceError','TypeError','SyntaxError','RangeError','Error'];
       const kind=knownTypes.includes(error?.name)?error.name:'OTHER';
       let detail='UNCLASSIFIED';
       const ref=/^([a-zA-Z_$][\w$]{0,50}) is not defined$/.exec(value);
       if(ref)detail='UNDEFINED_IDENTIFIER_'+ref[1];
       else if(/^Cannot read properties of (undefined|null)/.test(value))
         detail='NULL_OR_MISSING_OBJECT';
       else if(/ is not a function$/.test(value))
         detail='NOT_CALLABLE';
       else if(/Cannot set properties of (undefined|null)/.test(value))
         detail='MISSING_DOM_OR_STATE';
       return {called:false,kind,detail};
     }
   },{name:selected.entrypoint,mode:selected.mode});
   if(!invocation.called)return {
     guide_key:key,viewport:scenario.name,status:'REVIEW',
     flags:[invocation.kind==='ENTRYPOINT_NOT_EXPOSED'?'ENTRYPOINT_NOT_EXPOSED':
       'INVOCATION_'+invocation.kind+'_'+invocation.detail]
   };
   phase='RENDER_INSPECTION';
   const result=await page.evaluate(()=>{
     const root=document.querySelector('#screen');
     const text=(root.innerText||'').trim();
     const links=[...root.querySelectorAll('a[href]')];
     const cards=[...root.querySelectorAll('.personal-check,.document-card,.real-guide-step')];
     const overflow=document.documentElement.scrollWidth>window.innerWidth+2;
     const clipped=cards.some(el=>el.clientWidth>0&&el.scrollWidth>el.clientWidth+3);
     return {
       chars:text.length,
       heading:!!root.querySelector('h1,h2'),
       headingText:(root.querySelector('h1,h2')?.innerText||'').trim(),
       steps:root.querySelectorAll('.real-guide-step,.guide-step,[data-step]').length,
       documents:root.querySelectorAll('.personal-check,.document-card').length,
       links:links.length,
       suspiciousLinks:links.filter(a=>{
         const href=a.getAttribute('href')||'';
         return /^(?:javascript:|data:)/i.test(href)||href==='#'||href.trim()==='';
       }).length,
       verificationBadge:/Procedură verificată|Surse reverificate/i.test(text),
       visibleClaimCounts:(()=>{
         const badges=(text.match(/Procedură verificată/gi)||[]).length;
         const datedSources=(text.match(/Surse reverificate:\s*5 octombrie 2026/gi)||[]).length;
         // Count all rendered date mentions independently; no proximity regex
         // can accidentally create duplicate "separate" matches here.
         const datedMentions=(text.match(/5 octombrie 2026/gi)||[]).length;
         return {badge:badges,dated_source:datedSources,
           date_mentions:datedMentions,
           other_date_mentions:Math.max(0,datedMentions-datedSources)};
       })(),
       placeholders:/\b(?:TODO|FIXME|undefined|UNRESOLVED|OUT_OF_SCOPE)\b/i.test(text),
       overflow,clipped
     };
   });
   const flags=[];
   if(result.chars<400||!result.heading)flags.push('RESULT_EMPTY_OR_MISSING_HEADING');
   if(result.heading&&!result.headingText.toLocaleLowerCase('ro-RO').includes(countries[selected.country].toLocaleLowerCase('ro-RO')))
     flags.push('REVIEW_COUNTRY_HEADING_MISMATCH');
   if(result.steps<1)flags.push('REVIEW_STEP_STRUCTURE');
   if(result.links<1||result.suspiciousLinks)flags.push('REVIEW_OFFICIAL_LINKS');
   if(result.verificationBadge)flags.push('REVIEW_VISIBLE_VERIFICATION_CLAIM');
   if(result.placeholders)flags.push('REVIEW_VISIBLE_TECHNICAL_TEXT');
   if(result.overflow)flags.push('PAGE_HORIZONTAL_OVERFLOW');
   if(result.clipped)flags.push('CARD_CONTENT_OVERFLOW');
   if(pageErrors.length)flags.push('BROWSER_JAVASCRIPT_EXCEPTION');
   if(result.chars>0&&!claimsOnly){
     // This image is proprietary paid-guide content. Never upload to GitHub/ChatGPT.
     phase='PRIVATE_SCREENSHOT';
     await page.screenshot({path:join(outputDir,label+'.png'),fullPage:true,timeout:15000});
   }
   return {
     guide_key:key,viewport:scenario.name,
     status:flags.length?'REVIEW':'RENDER_OK',
     rendered:result.chars>0&&result.heading,
     flags,claim_counts:result.visibleClaimCounts,
     summary:{step_count:result.steps,document_count:result.documents,link_count:result.links}
   };
 }catch(error){
   // Never display error.message or error.stack; they can contain private code.
   const safeName=['TypeError','ReferenceError','SyntaxError','TimeoutError'].includes(error?.name)?error.name:'OTHER';
   return {guide_key:key,viewport:scenario.name,status:'REVIEW',
     flags:['BROWSER_RENDER_FAILED_'+phase,'BROWSER_EXCEPTION_'+safeName]};
 }finally{
   await context.close();
 }
}
async function main(){
 let outdir;
 try{
   const argv=process.argv.slice(2);
   if(argv.length!==1)throw Error('ONE_OUTPUT_ARGUMENT_REQUIRED');
   const claimsOnly=argv[0]==='--claims-only';
   // Read the private source only from stdin; no exported JS gets saved to disk.
   const input=readFileSync(0,'utf8');
   if(input.length>16*1024*1024)throw Error('PRIVATE_EXPORT_TOO_LARGE');
   const {raw,rows}=extractRows(input);
   const preflight=inspectPrivateExport(raw);
   if(!preflight.structure_ok)throw Error('PRECHECK_NOT_PASSED');
   if(!claimsOnly)outdir=privateFolder(argv[0]);
   const css=visibleCss();
   const publicHelper=publicMiniFormPreviewSource(readFileSync(join(root,'index.html'),'utf8'));
   const results=[];
   for(const scenario of modes){
     const browser=await scenario.browser.launch({headless:true});
     try{
       for(const row of rows){
         results.push(await renderOne(browser,scenario,row,outdir,css,publicHelper,claimsOnly));
       }
     }finally{await browser.close()}
   }
   const summary={
     checked:results.length,render_ok:results.filter(x=>x.status==='RENDER_OK').length,
     visually_rendered:results.filter(x=>x.rendered===true).length,
     review:results.filter(x=>x.status==='REVIEW').length,
     notes:'VISUAL STRUCTURE ONLY. NOT LEGAL/CONSULAR APPROVAL. NO PAID CHECKOUT TEST.',
     results
   };
   if(claimsOnly){
     const ordered=[...new Set(results.map(r=>r.guide_key))].sort();
     console.log('VISIBLE CLAIM AUDIT: '+results.filter(r=>r.rendered===true).length+
       '/24 offline renders inspected; NO source code printed.');
     for(const key of ordered){
       const pair=results.filter(r=>r.guide_key===key);
       const desktop=pair.find(r=>r.viewport==='chromium-1280');
       const mobile=pair.find(r=>r.viewport==='webkit-390');
       if(!desktop?.claim_counts||!mobile?.claim_counts){
         console.log('VISIBLE_CLAIMS '+key+' | INCOMPLETE_RENDER');
         continue;
       }
       const a=desktop.claim_counts,b=mobile.claim_counts;
       console.log('VISIBLE_CLAIMS '+key+
         ' | badge='+a.badge+
         ' | source_date='+a.dated_source+
         ' | other_dates='+a.other_date_mentions+
         ' | mobile_match='+JSON.stringify(a)===JSON.stringify(b));
     }
     console.log('NO D1 WRITES. NO SCREENSHOTS. THIS DOES NOT APPROVE LEGAL CONTENT.');
     if(results.some(r=>!r.claim_counts))process.exitCode=2;
     return;
   }
   writeFileSync(join(outdir,'diagnostic-summary.json'),JSON.stringify(summary,null,2),{mode:0o600,flag:'wx'});
   console.log('PRIVATE VISUAL QA: '+summary.render_ok+'/'+summary.checked+' renders without automatic review flags.');
   console.log('VISUALLY DISPLAYED (including review flags): '+summary.visually_rendered+'/'+summary.checked+'.');
   for(const result of results){
     console.log(result.status+' '+result.guide_key+' '+result.viewport+' | '+(result.flags.join(',')||'STRUCTURAL_RENDER_ONLY'));
     if(result.candidate_function_identifiers)
       console.log('  FUNCTION_IDENTIFIERS_ONLY '+result.guide_key+' | '+
         (result.candidate_function_identifiers.join(',')||'NONE'));
     if(result.script_shape)
       console.log('  SCRIPT_SHAPE '+result.guide_key+' | '+
         Object.entries(result.script_shape).map(([k,v])=>k+'='+v).join(','));
   }
   console.log('Screenshots and diagnostics saved privately outside repository. DO NOT upload premium screenshots/code.');
   console.log('NO SALE APPROVAL. D1, Shopify and deployment unchanged.');
   if(summary.review)process.exitCode=2;
 }catch{
   console.error('PRIVATE VISUAL QA BLOCKED: prerequisites, browser setup, or private input failed. No premium content printed.');
   process.exitCode=2;
 }
}
await main();
