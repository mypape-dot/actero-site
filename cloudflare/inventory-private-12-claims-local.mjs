// ActeRO READ-ONLY private wording inventory. Never log source snippets, URLs,
// JS bodies, secrets, SQL output, runtime exception messages, or client data.
// Counts only predefined editorial phrases in 12 authorized D1 scripts.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {EXPECTED,inspectPrivateExport} from './private-12-guide-preflight-local.mjs';

const BADGE='Procedură verificată';
const KNOWN_SOURCE=/Surse reverificate:\s*5 octombrie 2026/gi;
const GENERIC_VERIFIED=/Verificat.{0,80}5 octombrie 2026/gi;
const TYPES=[
 ['VERIFIED_ON_DATE',/^Verificat\s+la\s*:?\s*5 octombrie 2026$/i],
 ['VERIFIED_DATE_LABEL',/^Verificat\s*:?\s*5 octombrie 2026$/i],
 ['VERIFIED_SOURCES_LABEL',/^Verificat(?:e)?\s+surse.{0,50}5 octombrie 2026$/i]
];
function onlyRows(raw){
 const result=inspectPrivateExport(raw);
 if(!result.structure_ok||result.found!==EXPECTED.size)
   throw Error('INVALID_EXPECTED_GUIDE_SET');
 const rows=Array.isArray(raw)&&Array.isArray(raw[0]?.results)?raw[0].results:
   Array.isArray(raw?.results)?raw.results:raw;
 if(!Array.isArray(rows)||rows.length!==12)throw Error('INVALID_D1_SHAPE');
 return rows;
}
export function countEditorialClaims(raw){
 const rows=onlyRows(raw),out=[];
 for(const row of rows){
   const source=row.script_js;
   if(typeof source!=='string'||!EXPECTED.has(row.guide_key))
      throw Error('INVALID_GUIDE');
   const badgeCount=source.split(BADGE).length-1;
   const datedSourceCount=[...source.matchAll(KNOWN_SOURCE)].length;
   // Removal of the exact source label distinguishes overlapping generic
   // regex matches from separate, genuinely unreviewed dated references.
   const remainder=source.replace(KNOWN_SOURCE,'');
   const remaining=[...remainder.matchAll(GENERIC_VERIFIED)];
   const buckets=Object.fromEntries(TYPES.map(([id])=>[id,0]));
   buckets.UNCLASSIFIED_SEPARATE_DATE=0;
   for(const hit of remaining){
     const label=TYPES.find(([,rx])=>rx.test(hit[0]))?.[0]||'UNCLASSIFIED_SEPARATE_DATE';
     buckets[label]++;
   }
   out.push({
     guide_key:row.guide_key,
     badge_count:badgeCount,
     dated_source_count:datedSourceCount,
     separate_dated_claim_count:remaining.length,
     ...buckets
   });
 }
 return out.sort((a,b)=>a.guide_key.localeCompare(b.guide_key));
}
export function safeLines(raw){
 const rows=countEditorialClaims(raw);
 return ['PRIVATE CLAIM INVENTORY: '+rows.length+'/12 guides inspected, D1 read-only.',
   ...rows.map(x=>
      'CLAIM_COUNT '+x.guide_key+
      ' | badge='+x.badge_count+
      ' | source_date='+x.dated_source_count+
      ' | separate_dated='+x.separate_dated_claim_count+
      ' | verified_on='+x.VERIFIED_ON_DATE+
      ' | verified_label='+x.VERIFIED_DATE_LABEL+
      ' | verified_sources='+x.VERIFIED_SOURCES_LABEL+
      ' | unclassified='+x.UNCLASSIFIED_SEPARATE_DATE),
   'NO CHANGES. Counts are text-level heuristics, NOT proof the claims are customer-visible.',
   'Do not upload premium guide content. Share only CLAIM_COUNT lines.'
 ];
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.slice(2).join()!=='--stdin')throw Error('STDIN_ONLY');
  const input=readFileSync(0,'utf8');
  if(input.length>16*1024*1024)throw Error('TOO_LARGE');
  for(const line of safeLines(JSON.parse(input)))console.log(line);
 }catch{
  console.error('CLAIM INVENTORY BLOCKED: unsafe or incompatible input. No private source printed.');
  process.exitCode=2;
 }
}
