// Offline validator for READ-ONLY Cloudflare D1 metadata exports.
// It never reads premium JS source. Do not place any private exports inside this repo.
import {readFileSync} from 'node:fs';
const input=process.argv[2];
if(!input){console.error('Usage: node cloudflare/audit-d1-metadata.mjs /PRIVATE/PATH/metadata.json');process.exit(2)}
const catalog=JSON.parse(readFileSync(new URL('guide-catalog.json',import.meta.url),'utf8'));
const raw=JSON.parse(readFileSync(input,'utf8'));
const rows=Array.isArray(raw)&&raw.length===1&&Array.isArray(raw[0]?.results)?raw[0].results:
  Array.isArray(raw)&&raw.every(x=>x&&typeof x==='object'&&'guide_key' in x)?raw:
  Array.isArray(raw?.results)?raw.results:null;
if(!rows){console.error('Unsupported metadata JSON: expected D1 Wrangler results[] or flat rows[]');process.exit(2)}
for(const row of rows){
  if(Object.keys(row).some(k=>/(^script_js$|^guide_json$|access_token|secret|^title$)/i.test(k))){
    console.error('Unsafe input: export only guide_key,route,script_chars; no private scripts/tokens.');
    process.exit(2)
  }
}
const expected=new Map(catalog.guides.map(g=>[g.key,g.route]));
const got=new Map(),duplicate=[],unknown=[],incorrect=[],empty=[];
for(const row of rows){
 const key=row.guide_key,route=row.route,n=Number(row.script_chars);
 if(typeof key!=='string'||typeof route!=='string'||!Number.isInteger(n)||n<0){
   console.error('Invalid export: expected guide_key, route, nonnegative script_chars only');process.exit(2)
 }
 if(got.has(key)){duplicate.push(key);continue}
 got.set(key,route);
 if(!expected.has(key))unknown.push(key);
 else if(expected.get(key)!==route)incorrect.push(key);
 if(n===0)empty.push(key);
}
const missing=[...expected.keys()].filter(x=>!got.has(x));
console.log(JSON.stringify({
 expected:expected.size,found:rows.length,
 exact_match:missing.length===0&&duplicate.length===0&&unknown.length===0&&incorrect.length===0&&empty.length===0,
 missing,unexpected:unknown,duplicate,route_mismatch:incorrect,empty_scripts:empty
},null,2));
if(missing.length||duplicate.length||unknown.length||incorrect.length||empty.length)process.exitCode=1;
