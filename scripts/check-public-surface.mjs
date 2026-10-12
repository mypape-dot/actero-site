// Run: node scripts/check-public-surface.mjs
// Prevents accidental publication of full premium guide implementations.
// This is a regression guard, NOT a guarantee against leakage or Git-history exposure.
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const publicHtml=new Set(['index.html','confirmare.html','recuperare.html']);
const exceptions=new Set(['.git','node_modules','.github','scripts']);
const violations=[];
function walk(dir){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    const rel=relative(root,path).split(sep).join('/');
    if(entry.isDirectory()){
      if(exceptions.has(entry.name)&&dir===root)continue;
      if(rel==='backend')violations.push('Obsolete backend/ is not allowed in the public release branch');
      if(rel==='qa'||rel.startsWith('qa/'))violations.push('Public QA copies are prohibited: '+rel);
      if(rel==='cloudflare/tests')continue; // test fixtures may intentionally refer to premium function names
      walk(path);continue;
    }
    if(!entry.isFile())continue;
    if(/\.html?$/i.test(rel) && !publicHtml.has(rel))
      violations.push('Unexpected HTML file exposed by GitHub: '+rel);
    if(/(?:^|\/)(?:paid[-_]?guides?|private[-_]?guides?|guide[-_]?text)\b[^/]*\.(?:html?|m?js|json)$/i.test(rel))
      violations.push('Private paid-guide payload must not be committed: '+rel);
    if(!/\.(?:html?|m?js|json)$/i.test(rel))continue;
    const text=readFileSync(path,'utf8');
    const patterns=[
      ['premium guide function',/\b(?:async\s+)?function\s+show[A-Za-z0-9_]*(?:ValidatedGuide|VariantGuide|MovedCountryCompositeGuide)\s*\(/],
      ['premium guide variable',/\b(?:const|let|var)\s+show[A-Za-z0-9_]*(?:ValidatedGuide|VariantGuide|MovedCountryCompositeGuide)\s*=/],
      ['premium guide registry',/\b(?:const|let|var)\s+(?:PREMIUM_GUIDES|PAID_GUIDE_SCRIPTS|FULL_GUIDE_TEMPLATES)\s*=/]
    ];
    for(const [label,re] of patterns)if(re.test(text))violations.push(label+' found in '+rel);
  }
}
if(!existsSync(join(root,'index.html')))violations.push('Missing public index.html');
walk(root);
const index=existsSync(join(root,'index.html'))?readFileSync(join(root,'index.html'),'utf8'):'';
if(!index.includes('/guide-script?case_id=')||!index.includes('X-Actero-Access-Token'))
  violations.push('The protected guide request and header-token check are missing from public index.html');
if(violations.length){
  for(const issue of violations)console.error('FAIL: '+issue);
  console.error('Release guard failed. Historical Git commits must ALSO be handled through a fresh public repository.');
  process.exitCode=1;
}else{
  console.log('PASS public-surface guard: no known premium implementations or QA copies in this working tree.');
  console.log('NOTE this does not remove copies in Git history, caches, already-published sites or the default branch.');
}
