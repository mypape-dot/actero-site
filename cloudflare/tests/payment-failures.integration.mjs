// Real workerd + ephemeral D1; all outbound services are local sinks.
// No Wrangler, credentials, remote database or actual email/Shopify requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {localWorker} from './helpers/local-worker.mjs';
import {ORIGIN,VARIANT,state,checkoutId,order,signedRequest} from './helpers/payment-harness.mjs';

async function setup(t){
  const backend=await localWorker();
  t.after(async()=>{try{assert.deepEqual(backend.unexpected,[])}finally{await backend.dispose()}});
  const post=async(path,body={},headers={})=>backend.dispatch(new Request('https://api.actero.test'+path,{
    method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.10',...headers},body:JSON.stringify(body)}));
  async function checkout(){
    const session=await post('/session');assert.equal(session.status,200);const s=await session.json();
    const response=await post('/checkout',{case_id:s.case_id,guide_key:'B1_ES',route:state.route,case_state:state},{'X-Actero-Session-Token':s.session_token});
    assert.equal(response.status,200);const co=await response.json();
    return {...co,caseId:s.case_id,checkoutId:checkoutId(co.checkoutUrl)};
  }
  async function paid(){
    const co=await checkout();const response=await backend.dispatch(signedRequest(order(co.checkoutId)));
    assert.equal((await response.json()).granted,true);return co;
  }
  const recover=(headers={})=>post('/recover/request',{email:'synthetic-buyer@example.test',order_name:'#100001'},headers);
  const challenge=()=>new URLSearchParams(new URL(backend.mail.at(-1).text.match(/https:\/\/\S+/)[0]).hash.slice(1)).get('token');
  const guide=(co,token=co.accessToken)=>backend.dispatch(new Request('https://api.actero.test/guide-script?case_id='+co.caseId+'&guide_key=B1_ES',{
    headers:{Origin:ORIGIN,'X-Actero-Access-Token':token}}));
  return {...backend,post,checkout,paid,recover,challenge,guide};
}

test('email outage keeps response generic, releases the challenge and allows a successful retry',async t=>{
  const h=await setup(t);await h.paid();h.setEmailUnavailable(true);
  const failed=await h.recover();assert.equal(failed.status,202);const generic=await failed.json();
  assert.equal(h.mail.length,0);assert.equal(h.alerts.length,1);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM recovery_links').first()).n,0);
  const unknown=await h.post('/recover/request',{email:'unknown@example.test',order_name:'#100001'});
  assert.deepEqual(await unknown.json(),generic);
  h.setEmailUnavailable(false);assert.equal((await h.recover()).status,202);assert.equal(h.mail.length,1);
  const link=await h.db.prepare('SELECT delivered_at,consumed_at FROM recovery_links').first();
  assert.ok(link.delivered_at);assert.equal(link.consumed_at,null);
});

test('failed payment alert preserves the incident and retries once without granting access',async t=>{
  const h=await setup(t),co=await h.checkout();h.setAlertUnavailable(true);
  const event=()=>signedRequest(order(co.checkoutId,{total_price:'0.00'}),{id:'synthetic-alert-retry'});
  assert.equal((await h.dispatch(event())).status,503);
  const pending=await h.db.prepare("SELECT result,alerted_at FROM payment_events WHERE event_id='synthetic-alert-retry'").first();
  assert.equal(pending.result,'needs_review');assert.equal(pending.alerted_at,null);
  assert.equal((await h.guide(co)).status,402);
  h.setAlertUnavailable(false);
  assert.equal((await h.dispatch(event())).status,200);assert.equal(h.alerts.length,1);
  assert.equal((await h.dispatch(event())).status,200);assert.equal(h.alerts.length,1);
  assert.equal((await h.guide(co)).status,402);
});

test('revocation remains effective when its alert fails, including retry and a late paid webhook',async t=>{
  const h=await setup(t),co=await h.paid();h.setAlertUnavailable(true);
  const event=()=>signedRequest({order_id:'100001',refund_line_items:[{quantity:1,line_item:{variant_id:VARIANT}}]},
    {topic:'refunds/create',id:'synthetic-revoke-alert-retry'});
  assert.equal((await h.dispatch(event())).status,503);assert.equal((await h.guide(co)).status,402);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM order_revocations').first()).n,1);
  h.setAlertUnavailable(false);assert.equal((await h.dispatch(event())).status,200);
  assert.equal((await h.dispatch(event())).status,200);assert.equal(h.alerts.length,1);
  const late=await h.dispatch(signedRequest(order(co.checkoutId)));
  assert.equal((await late.json()).ignored,'revoked_prior_to_payment');assert.equal((await h.guide(co)).status,402);
});

for(const [topic,body] of [
  ['orders/cancelled',{id:'100001',line_items:[{variant_id:VARIANT}]}],
  ['disputes/create',{order_id:'100001',id:'synthetic-dispute'}],
])test(topic+' before payment blocks a delayed paid event',async t=>{
  const h=await setup(t),co=await h.checkout();
  const reversed=await h.dispatch(signedRequest(body,{topic}));
  assert.equal((await reversed.json()).outcome,'pending_order');
  const late=await h.dispatch(signedRequest(order(co.checkoutId)));
  assert.equal((await late.json()).ignored,'revoked_prior_to_payment');
  assert.equal((await h.guide(co)).status,402);
  assert.equal((await h.db.prepare("SELECT COUNT(*) n FROM access_grants WHERE status='paid'").first()).n,0);
});

test('expired recovery link cannot rotate a paid access token',async t=>{
  const h=await setup(t),co=await h.paid();await h.recover();const token=h.challenge();
  await h.db.prepare('UPDATE recovery_links SET expires_at=unixepoch()-1').run();
  assert.equal((await h.post('/recover/consume',{token})).status,400);
  assert.equal((await h.guide(co)).status,200);
  assert.equal((await h.db.prepare('SELECT consumed_at FROM recovery_links').first()).consumed_at,null);
});

test('recovery issued before cancellation cannot be consumed after revocation',async t=>{
  const h=await setup(t),co=await h.paid();await h.recover();const token=h.challenge();
  await h.dispatch(signedRequest({id:'100001',line_items:[{variant_id:VARIANT}]},{topic:'orders/cancelled'}));
  assert.equal((await h.post('/recover/consume',{token})).status,400);
  assert.equal((await h.guide(co)).status,402);
});

test('D1 enforces a single winner for simultaneous link consumption',async t=>{
  const h=await setup(t),co=await h.paid();await h.recover();const token=h.challenge();
  const attempts=await Promise.all([h.post('/recover/consume',{token}),h.post('/recover/consume',{token})]);
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,400]);
  const winner=await attempts.find(r=>r.status===200).json();
  assert.equal((await h.guide(co,winner.access_token)).status,200);
  assert.equal((await h.guide(co,co.accessToken)).status,402);
});

test('D1 limits simultaneous recovery requests across IPs to three emails per order',async t=>{
  const h=await setup(t);await h.paid();
  const results=await Promise.all(Array.from({length:7},(_,i)=>h.recover({'CF-Connecting-IP':'198.51.100.'+(i+1)})));
  assert.ok(results.every(r=>r.status===202));assert.equal(h.mail.length,3);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM recovery_links').first()).n,3);
});
