// Run: node --test cloudflare/tests/public-runtime-config.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const config=readFileSync(new URL('actero-config.js',root),'utf8');
const pages=['index.html','confirmare.html','recuperare.html'];
const texts=new Map(pages.map(p=>[p,readFileSync(new URL(p,root),'utf8')]));

test('public API is disabled by default in draft, with no secret values',()=>{
  assert.match(config,/window\.ACTERO_PAYMENT_API\s*=\s*''\s*;/);
  assert.doesNotMatch(config,/workers\.dev|sk_(?:test|live)|shpat_|api\.resend\.com/);
});
test('all three pages load the same public config before their inline application script',()=>{
  for(const [name,html] of texts){
    const configAt=html.indexOf('<script src="./actero-config.js"></script>');
    const inlineAt=html.indexOf('<script>',configAt);
    assert.ok(configAt>0&&inlineAt>configAt,'runtime config missing/misordered: '+name);
    assert.doesNotMatch(html,/https:\/\/actero\.actedsro\.workers\.dev/,'hardcoded live API in '+name);
  }
});
test('paywall refuses checkout without configured HTTPS API',()=>{
  const html=texts.get('index.html');
  assert.match(html,/function paymentApiConfigured\(\)[\s\S]{0,130}\^https/);
  assert.match(html,/disabled aria-disabled="true"/);
});
test('confirmation does not poll payment status if API is absent',()=>{
  const html=texts.get('confirmare.html');
  assert.match(html,/if\(!\/\^https:.*test\(API\)\)\{/);
  assert.match(html,/Verificarea plății nu este disponibilă/);
});
test('recovery does not consume a one-time token without a configured API',()=>{
  const html=texts.get('recuperare.html');
  assert.match(html,/Linkul nu a fost consumat/);
  assert.match(html,/Recuperarea accesului nu este disponibilă/);
});
