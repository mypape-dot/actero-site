// LOCAL ONLY. Produces a review draft; does NOT write to Cloudflare or GitHub.
// Usage: node cloudflare/prepare-b5-uk-review.mjs ABSOLUTE_INPUT_JSON ABSOLUTE_OUTPUT_JSON
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,realpathSync,existsSync} from 'node:fs';
import {resolve,dirname,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const [input,output]=process.argv.slice(2);
assert.ok(input&&output&&isAbsolute(input)&&isAbsolute(output),'Two absolute paths are required');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dir=realpathSync(dirname(output));
assert.ok(dir!==root&&!dir.startsWith(root+sep),'Refusing private guide output inside GitHub checkout');
assert.notEqual(resolve(input),resolve(output),'Never overwrite private source');
assert.ok(!existsSync(output),'Output exists; not overwriting');
const data=JSON.parse(readFileSync(input,'utf8'));
const rows=Array.isArray(data)&&data.length===1&&Array.isArray(data[0]?.results)?data[0].results:
  Array.isArray(data)&&data.every(x=>x&&typeof x==='object'&&'guide_key' in x)?data:
  Array.isArray(data?.results)?data.results:null;
assert.ok(Array.isArray(rows)&&rows.length===2,'Exactly two B5 records expected');
const entries=new Map(rows.map(x=>[x.guide_key,x]));
assert.equal(entries.size,2,'Duplicate guide keys');
for(const key of ['B5_DAMAGED','B5_DATA_CHANGE']){
  const row=entries.get(key);
  assert.ok(row&&row.route==='B5_EXISTING_CRDS','Wrong route or missing '+key);
  assert.ok(typeof row.script_js==='string'&&row.script_js.length>500,'Empty script '+key);
}
const original=entries.get('B5_DAMAGED').script_js;
assert.equal(original,entries.get('B5_DATA_CHANGE').script_js,'Scripts differ; manual review needed');
let draft=original;
function replaceOnce(label,before,after){
  const parts=draft.split(before);
  assert.equal(parts.length,2,'Anchor changed or repeated: '+label);
  draft=parts.join(after);
}
replaceOnce('UK residency explanation',
  "proof:'Pașaport britanic/cetățenie; BRP; NINo; council tax; P60/P45; anumite dovezi de școlarizare; ori dovada settled/pre-settled verificată consular.'",
  "proof:'Pentru domiciliul în Regatul Unit, verifică documentele acceptate în fișa DGP: cetățenie britanică, dovezi fiscale, muncă ori școlarizare, în condițiile oficiale. Pentru settled/pre-settled, consultă statutul digital UKVI (eVisa) la https://www.gov.uk/evisa. Un share code permite verificarea statutului, dar nu este automat o dovadă admisă pentru CRDS; fișa DGP descrie dovezi electronice rezultate din verificări consulare. Cardurile BRP fizice au expirat și nu sunt, singure, dovada actuală a statutului. Confirmă documentul concret acceptat prin eConsulat/consulat.'");
replaceOnce('unapproved badge',
  '<span class="validated-route-badge"><i></i> Procedură verificată</span>',
  '<span class="guide-eyebrow">Ghid personalizat · verifică sursele oficiale</span>');
replaceOnce('unapproved dated claim',
  '<div class="route-fact"><b>Verificat</b><span>5 octombrie 2026</span></div>',
  '<div class="route-fact"><b>Surse</b><span>DGP și eConsulat</span></div>');
replaceOnce('unapproved source date',
  '<div class="guide-date">Surse reverificate: 5 octombrie 2026.</div>',
  '<div class="guide-date">Condițiile se pot schimba. Verifică sursele oficiale înainte de depunere.</div>');
replaceOnce('consular fee context',
  'eConsulat publică în prezent 53 EUR sau echivalent local.',
  'Pentru cererile consulare CRDS, eConsulat indică 53 EUR sau echivalent local. Confirmă taxa la consulatul ales înainte de plată.');
assert.ok(draft.includes('eVisa')&&draft.includes('share code'));
assert.ok(!draft.includes('5 octombrie 2026'));
const result=rows.map(x=>({guide_key:x.guide_key,route:x.route,script_js:draft}));
writeFileSync(output,JSON.stringify([{results:result}]),{flag:'wx',mode:0o600});
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
console.log('PRIVATE REVIEW DRAFT ONLY: 2 scripts prepared. D1 and Shopify unchanged.');
console.log('Original SHA-256: '+sha(original));
console.log('Draft SHA-256: '+sha(draft));
console.log('NOT APPROVED FOR SALE: legal and editorial review still required.');
