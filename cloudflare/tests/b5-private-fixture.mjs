// CI-only synthetic fixture: copies historical already-public generator into a private-JSON-shaped
// temporary file. Never uses Cloudflare D1 or real paid guide content.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const dest=process.argv[2];
assert.ok(dest,'Usage: node b5-private-fixture.mjs /tmp/b5-demo.json');
const main=execFileSync('git',['show','origin/main:index.html'],{encoding:'utf8',maxBuffer:8*1024*1024});
const piece=(name,next)=>{
  const a=main.indexOf('function '+name+'(');
  const b=main.indexOf('\nfunction '+next+'(',a+12);
  assert.ok(a>=0&&b>a,'Cannot find '+name);
  return main.slice(a,b);
};
const script=piece('b5CountryConfig','showB5VariantGuide')+
  '\n'+piece('showB5VariantGuide','showB5MovedCountryCompositeGuide');
writeFileSync(dest,JSON.stringify([{results:[
  {guide_key:'B5_DAMAGED',route:'B5_EXISTING_CRDS',script_js:script},
  {guide_key:'B5_DATA_CHANGE',route:'B5_EXISTING_CRDS',script_js:script}
]}]),{mode:0o600});
console.log('Created synthetic local B5 test fixture (no D1 access).');
