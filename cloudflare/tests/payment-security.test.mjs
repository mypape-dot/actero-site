import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,order,migrationSQL} from './helpers/payment-harness.mjs';

function setup(t){
  const h=harness();t.after(()=>h.close());
  const messages=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{messages.push({url:String(url),body:JSON.parse(options.body)});return new Response('{}',{status:200})});
  return {...h,messages};
}
for(const [label,modify] of [
  ['missing line price',o=>delete o.line_items[0].price],
  ['nonnumeric line price',o=>o.line_items[0].price='NaN'],
  ['missing order total',o=>delete o.total_price],
  ['nonnumeric order total',o=>o.total_price='bad'],
  ['infinite amount',o=>o.total_price='Infinity'],
  ['unexpected higher price',o=>{o.line_items[0].price='50.00';o.total_price='50.00'}],
  ['discount allocation despite zero line total_discount',o=>o.line_items[0].discount_allocations=[{amount:'1.00'}]],
  ['malformed discount allocation',o=>o.line_items[0].discount_allocations=[{}]],
])test(label+' cannot grant access',async t=>{
  const h=setup(t),co=await h.checkout(),payload=order(co.checkoutId);modify(payload);
  const r=await h.webhook(payload);
  assert.equal(r.data.needs_review,true);
  assert.equal(h.sql.prepare('SELECT status FROM access_grants').get().status,'pending');
});
for(const value of [false,undefined,'true'])test('test staging rejects order.test='+value,async t=>{
  const h=setup(t),co=await h.checkout();
  const r=await h.webhook(order(co.checkoutId,{test:value}));
  assert.equal(r.data.reason,'payment_mode_mismatch');
  assert.equal(h.sql.prepare('SELECT status FROM access_grants').get().status,'pending');
});
test('test mode is the default and invalid configuration blocks checkout',async t=>{
  const h=setup(t);delete h.env.SHOPIFY_PAYMENT_MODE;
  const co=await h.checkout();assert.equal((await h.webhook(order(co.checkoutId,{test:false}))).data.reason,'payment_mode_mismatch');
  h.env.SHOPIFY_PAYMENT_MODE='typo';
  assert.equal((await h.api('/checkout',{body:{}})).status,503);
});
test('explicit live mode refuses synthetic Shopify test orders',async t=>{
  const h=setup(t),co=await h.checkout();h.env.SHOPIFY_PAYMENT_MODE='live';
  assert.equal((await h.webhook(order(co.checkoutId))).data.reason,'payment_mode_mismatch');
});
test('same Shopify order cannot grant a second case',async t=>{
  const h=setup(t),a=await h.checkout(),b=await h.checkout();
  assert.equal((await h.webhook(order(a.checkoutId))).data.granted,true);
  const replay=await h.webhook(order(b.checkoutId));
  assert.equal(replay.data.reason,'order_already_bound');
  assert.equal(h.sql.prepare("SELECT count(*) n FROM access_grants WHERE status='paid'").get().n,1);
});
test('concurrent order deliveries cannot mark two grants or checkout intents paid',async t=>{
  const h=setup(t),a=await h.checkout(),b=await h.checkout();
  await Promise.all([h.webhook(order(a.checkoutId)),h.webhook(order(b.checkoutId))]);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM access_grants WHERE status='paid'").get().n,1);
  assert.equal(h.sql.prepare("SELECT count(*) n FROM checkout_intents WHERE status='paid'").get().n,1);
});
test('uniqueness migration stops on existing duplicate orders without deleting grants',async t=>{
  const h=setup(t);await h.checkout();await h.checkout();
  h.sql.exec('DROP INDEX idx_access_grants_unique_order');
  h.sql.exec("UPDATE access_grants SET shopify_order_id='12345'");
  assert.throws(()=>h.sql.exec(migrationSQL('010-order-uniqueness.sql')),/UNIQUE/);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM access_grants').get().n,2);
});
test('simultaneous recovery requests send at most three emails for one order',async t=>{
  const h=setup(t),co=await h.checkout();await h.webhook(order(co.checkoutId));
  const results=await Promise.all(Array.from({length:7},()=>h.api('/recover/request',{body:{email:'synthetic-buyer@example.test',order_name:'#100001'}})));
  assert.ok(results.every(r=>r.status===202));
  assert.equal(h.messages.filter(m=>m.url==='https://api.resend.com/emails').length,3);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM recovery_links').get().n,3);
});
