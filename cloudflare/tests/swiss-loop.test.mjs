// Run: node --test cloudflare/tests/swiss-loop.test.mjs
// Regression for F-07: OTHER Swiss document must not create an endless clarification loop.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');

function choiceFor(name){
  const start=html.indexOf(`function ${name}(){`);
  const end=html.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&end>start,`Cannot extract ${name} from index.html`);
  let config=null;
  vm.runInNewContext(html.slice(start,end)+`\n${name}();`,{choose:x=>{config=x}}, {timeout:1000});
  assert.ok(config?.next,`No routing callback for ${name}`);
  return config;
}

for(const [name,stopG,ordinaryRoute] of [['q109','STOP_CH_G','Q103'],['q125','STOP_CH_G_RENEW','Q040']]){
  test(`${name}: OTHER must end in a nonpaying clarification STOP`,()=>{
    assert.equal(choiceFor(name).next('OTHER'),'STOP_CH_OTHER');
    assert.match(html,/case'STOP_CH_OTHER':return showStop\(/);
  });
  test(`${name}: permit G retains dedicated stop`,()=>assert.equal(choiceFor(name).next('G'),stopG));
  test(`${name}: B C L follow original path`,()=>{for(const v of ['B','C','L'])assert.equal(choiceFor(name).next(v),ordinaryRoute)});
  test(`${name}: UNKNOWN retains its existing clarification handling`,()=>assert.equal(choiceFor(name).next('UNKNOWN'),ordinaryRoute));
}
