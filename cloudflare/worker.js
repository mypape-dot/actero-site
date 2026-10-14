import {recoverRequest,recoverConsume,buyerEmail,buyerEmailHash,serializeCaseState,recoveryConfigured} from './recovery.js';
import {quota} from './quota.js';
import {issueEvaluationSession,ownsEvaluationSession} from './evaluation-session.js';
// ActeRO payment integration staging. Shopify test orders only until merchant review.
// NEVER publish a paid access grant from a browser redirect or unchecked webhook body.
const ORIGIN = 'https://mypape-dot.github.io';
const SHOP = 'gyfu4v-5q.myshopify.com';
const VARIANT = '67640764400007';
const PRICE_RON = 49;
const NOCACHE = { 'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache' };
const enc = new TextEncoder();

function cors(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin === ORIGIN ? ORIGIN : ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Actero-Access-Token, X-Actero-Session-Token',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}
function reply(request, value, status = 200) {
  return new Response(JSON.stringify(value), {status, headers: {'Content-Type':'application/json; charset=utf-8',...cors(request),...NOCACHE}});
}
const isCase = s => typeof s==='string' && /^AR-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
const isKey = s => typeof s==='string' && /^[A-Z0-9_]{3,120}$/.test(s);
const isRoute = isKey;
const safeId = s => typeof s==='string' && s.length>0 && s.length<128 && /^[a-zA-Z0-9_-]+$/.test(s);
const digest = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))].map(v=>v.toString(16).padStart(2,'0')).join('');
function constantTimeEqual(a,b){
  if(a.length!==b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++)diff |= a[i]^b[i]; return diff===0;
}
function base64urlText(s){return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function validWebhook(request,raw,secret){
  const b64=request.headers.get('X-Shopify-Hmac-Sha256');
  if(!b64 || !secret) return false;
  let bytes;
  try {bytes=Uint8Array.from(atob(b64),x=>x.charCodeAt(0))}catch{return false}
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,raw));
  return constantTimeEqual(bytes,mac);
}
function valueOfProperty(line,name){
  const x=Array.isArray(line?.properties) ? line.properties.find(p=>p?.name===name) : null;
  return typeof x?.value==='string'?x.value:null;
}
async function getAccess(env,caseId,accessToken){
  if(!isCase(caseId)||typeof accessToken!=='string'||accessToken.length<40||accessToken.length>160)return null;
  const row=await env.DB.prepare('SELECT case_id,status,route,guide_key,paid_at,revoked_at,access_token_hash FROM access_grants WHERE case_id = ? LIMIT 1').bind(caseId).first();
  if(!row?.access_token_hash || (await digest(accessToken))!==row.access_token_hash)return null;
  return row;
}
function forbiddenOrigin(request){return request.headers.has('Origin') && request.headers.get('Origin')!==ORIGIN}

// F-02: every valid Shopify payment event is durably recorded before acknowledgement.
// For needs_review we require delivery of an operator alert; on failure Shopify retries.
async function paymentOutcome(request,env,event,kind,reason){
  try{
    await env.DB.prepare(`INSERT INTO payment_events
      (event_id,shopify_order_id,checkout_id,case_id,result,reason,updated_at)
      VALUES (?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(event_id) DO UPDATE SET
        result=excluded.result,reason=excluded.reason,updated_at=datetime('now')`)
      .bind(event.id,event.orderId||null,event.checkoutId||null,event.caseId||null,kind,reason).run();
    if(kind==='needs_review'){
      const existing=await env.DB.prepare('SELECT alerted_at FROM payment_events WHERE event_id=?').bind(event.id).first();
      if(!existing?.alerted_at){
        if(!env.PAYMENT_ALERT_WEBHOOK_URL)
          return reply(request,{ok:false,error:'alert_not_configured'},503);
        const message=`ActeRO payment NEEDS REVIEW | order ${event.orderId||'unknown'} | case ${event.caseId||'unknown'} | ${reason}`;
        // Configure PAYMENT_ALERT_WEBHOOK_URL as a private Discord-compatible webhook.
        const alert=await fetch(env.PAYMENT_ALERT_WEBHOOK_URL,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({content:message})
        });
        if(!alert.ok)return reply(request,{ok:false,error:'alert_delivery_failed'},503);
        await env.DB.prepare(`UPDATE payment_events SET alerted_at=datetime('now')
          WHERE event_id=? AND alerted_at IS NULL`).bind(event.id).run();
      }
    }
    if(kind==='needs_review')return reply(request,{ok:true,needs_review:true,reason});
    if(kind==='granted')return reply(request,{ok:true,granted:true});
    if(kind==='duplicate')return reply(request,{ok:true,duplicate:true});
    return reply(request,{ok:true,ignored:reason});
  }catch(e){console.error('payment event persistence/alert error',e);return reply(request,{ok:false,error:'payment_event_failed'},500)}
}

// A revocation is recorded by *order id*, so out-of-order orders/paid cannot restore access.
// Keep status='paid' and use revoked_at to avoid relying on unknown production CHECK(status).
async function recordRevocation(request,env,event,reason,mode){
  try{
    const prior=await env.DB.prepare('SELECT event_id,outcome,alerted_at FROM revocation_events WHERE event_id=? LIMIT 1').bind(event.id).first();
    let outcome=prior?.outcome||mode;
    if(!prior){
      // Affected events create a tombstone before (or simultaneously with) any grant revocation.
      const changes=await env.DB.batch([
        ...(mode==='revoked'||mode==='pending_order' ? [
          env.DB.prepare(`INSERT INTO order_revocations (order_id,event_id,reason)
            VALUES (?,?,?) ON CONFLICT(order_id) DO NOTHING`).bind(event.orderId,event.id,reason),
          env.DB.prepare(`UPDATE access_grants SET revoked_at=COALESCE(revoked_at,datetime('now')),
            revoked_reason=COALESCE(revoked_reason,?),updated_at=datetime('now')
            WHERE shopify_order_id=? AND status='paid' AND revoked_at IS NULL`).bind(reason,event.orderId)
        ] : []),
        env.DB.prepare(`INSERT INTO revocation_events
          (event_id,shopify_order_id,topic,outcome,reason,case_id) VALUES (?,?,?,?,?,?)
          ON CONFLICT(event_id) DO NOTHING`)
          .bind(event.id,event.orderId,event.topic,mode,reason,event.caseId||null)
      ]);
      // If the order wasn't already paid, the marker blocks late payment delivery.
      // No automatic reinstatement is performed if the dispute or refund is later reversed.
    }
    if(['revoked','pending_order','needs_review'].includes(outcome)){
      const row=await env.DB.prepare('SELECT alerted_at FROM revocation_events WHERE event_id=?').bind(event.id).first();
      if(!row?.alerted_at){
        if(!env.PAYMENT_ALERT_WEBHOOK_URL)return reply(request,{ok:false,error:'alert_not_configured'},503);
        const msg=`ActeRO Shopify ${event.topic} | order ${event.orderId} | ${outcome} | ${reason}`;
        const alert=await fetch(env.PAYMENT_ALERT_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:msg})});
        if(!alert.ok)return reply(request,{ok:false,error:'alert_delivery_failed'},503);
        await env.DB.prepare(`UPDATE revocation_events SET alerted_at=datetime('now') WHERE event_id=? AND alerted_at IS NULL`).bind(event.id).run();
      }
    }
    return reply(request,{ok:true,outcome,reason});
  }catch(e){console.error('revocation event processing failure',e);return reply(request,{ok:false,error:'revocation_database_error'},500)}
}

export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==='OPTIONS')return forbiddenOrigin(request)?new Response(null,{status:403}):new Response(null,{status:204,headers:cors(request)});
    if(request.method==='GET'&&path==='/')return reply(request,{ok:true,service:'ActeRO API',status:'online'});
    if(request.method==='GET'&&path==='/health')return reply(request,{ok:true,service:'actero-api',version:'0.5.0',checkout_enabled:env.SHOPIFY_CHECKOUT_ENABLED==='true'});

    if(request.method==='POST'&&path==='/session')return issueEvaluationSession(request,env);
    if(request.method==='POST'&&path==='/recover/request')return recoverRequest(request,env);
    if(request.method==='POST'&&path==='/recover/consume')return recoverConsume(request,env);

    // Checkout link is disabled by default, even if the product happens to become active.
    if(request.method==='POST'&&path==='/checkout'){
      if(forbiddenOrigin(request))return reply(request,{ok:false,error:'origin_not_allowed'},403);
      if(env.SHOPIFY_CHECKOUT_ENABLED!=='true')return reply(request,{ok:false,error:'checkout_disabled'},503);
      const checkoutQuota=await quota(request,env,'checkout',{limit:8,windowSeconds:3600});
      if(!checkoutQuota.allowed)return reply(request,{ok:false,error:checkoutQuota.error||'too_many_requests'},checkoutQuota.error?503:429);
      let data;try{data=await request.json()}catch{return reply(request,{ok:false,error:'invalid_json'},400)}
      const caseId=data?.case_id,route=data?.route,guideKey=data?.guide_key;
      if(!isCase(caseId)||!isRoute(route)||!isKey(guideKey))return reply(request,{ok:false,error:'invalid_case'},400);
      if(!(env.DB && env.SHOPIFY_WEBHOOK_SECRET && env.PAYMENT_ALERT_WEBHOOK_URL))return reply(request,{ok:false,error:'payment_not_configured'},503);
      const caseState=serializeCaseState(data?.case_state,route);
      if(data?.case_state && !caseState)return reply(request,{ok:false,error:'invalid_case_state'},400);
      if(env.RECOVERY_REQUIRED==='true'&&(!recoveryConfigured(env)||!caseState))
        return reply(request,{ok:false,error:'recovery_not_ready'},503);
      try{
        // A present script is NOT automatically sellable. A reviewer must explicitly
        // approve the exact UTF-8 script bytes and route stored in private D1.
        const guide=await env.DB.prepare(`SELECT g.route,g.script_js,a.script_sha256
          FROM guide_scripts AS g INNER JOIN guide_approvals AS a
          ON a.guide_key=g.guide_key AND a.route=g.route AND a.status='approved'
          WHERE g.guide_key=? LIMIT 1`).bind(guideKey).first();
        if(!guide||guide.route!==route||typeof guide.script_js!=='string'||!guide.script_js.trim()||
          typeof guide.script_sha256!=='string'||(await digest(guide.script_js))!==guide.script_sha256)
          return reply(request,{ok:false,error:'guide_not_available'},409);
        const current=await env.DB.prepare('SELECT status,route,guide_key,access_token_hash FROM access_grants WHERE case_id=? LIMIT 1').bind(caseId).first();
        // New checkouts must prove a server-issued evaluation session.
        // Existing pending checkouts can still be retried with their access token,
        // including purchases started before this migration.
        if(!current && !(await ownsEvaluationSession(request,env,caseId)))
          return reply(request,{ok:false,error:'session_required'},403);
        if(current?.status==='paid')return reply(request,{ok:false,error:'already_paid'},409);
        if(current && (current.status!=='pending'||current.route!==route||current.guide_key!==guideKey))
          return reply(request,{ok:false,error:'case_route_changed'},409);
        // F-05: a case_id is not a secret. Reissuing a checkout requires the EXISTING token.
        // A client without it must never replace the pending access token.
        const previousToken=request.headers.get('X-Actero-Access-Token');
        if(current && (!previousToken||!current.access_token_hash||
          (await digest(previousToken))!==current.access_token_hash))
          return reply(request,{ok:false,error:'case_in_progress'},409);
        const accessToken=crypto.randomUUID()+'.'+crypto.randomUUID();
        const tokenHash=await digest(accessToken);
        const checkoutId='ACO-'+crypto.randomUUID();
        // Conditional CAS prevents simultaneous unauthenticated requests from stealing a token.
        // The checkout intent is inserted only if the token update really took effect.
        const saved=await env.DB.batch([
          env.DB.prepare(`INSERT INTO access_grants (case_id,status,route,guide_key,access_token_hash,evaluation_json,created_at,updated_at)
          VALUES (?,'pending',?,?,?,?,datetime('now'),datetime('now'))
          ON CONFLICT(case_id) DO UPDATE SET updated_at=datetime('now'),access_token_hash=excluded.access_token_hash,
            evaluation_json=COALESCE(excluded.evaluation_json,access_grants.evaluation_json)
          WHERE access_grants.status='pending' AND access_grants.guide_key=excluded.guide_key
            AND access_grants.route=excluded.route AND access_grants.access_token_hash = ?`)
            .bind(caseId,route,guideKey,tokenHash,caseState,current?.access_token_hash||null),
          env.DB.prepare(`INSERT INTO checkout_intents (checkout_id,case_id,route,guide_key)
            SELECT ?,case_id,route,guide_key FROM access_grants
            WHERE case_id=? AND status='pending' AND access_token_hash=?`)
            .bind(checkoutId,caseId,tokenHash)
        ]);
        if(saved[0]?.meta?.changes!==1||saved[1]?.meta?.changes!==1)
          return reply(request,{ok:false,error:'case_in_progress'},409);
        const props={_actero_checkout_id:checkoutId};
        const checkoutUrl=`https://${SHOP}/cart/${VARIANT}:1?properties=${encodeURIComponent(base64urlText(JSON.stringify(props)))}`;
        return reply(request,{ok:true,checkoutUrl,accessToken});
      }catch(e){console.error('checkout error',e);return reply(request,{ok:false,error:'checkout_database_error'},500)}
    }

    // Shopify orders/paid: authenticated, auditable and never silently drop a paid ActeRO item.
    if(request.method==='POST'&&path==='/webhooks/shopify/orders-paid'){
      if(!env.SHOPIFY_WEBHOOK_SECRET)return reply(request,{ok:false,error:'webhook_not_configured'},503);
      const raw=await request.arrayBuffer();
      if(!await validWebhook(request,raw,env.SHOPIFY_WEBHOOK_SECRET))return reply(request,{ok:false,error:'invalid_signature'},401);
      if(request.headers.get('X-Shopify-Shop-Domain')!==SHOP || request.headers.get('X-Shopify-Topic')!=='orders/paid')
        return reply(request,{ok:false,error:'wrong_shop_or_topic'},403);
      if(!env.DB)return reply(request,{ok:false,error:'database_not_configured'},503);
      let order;try{order=JSON.parse(new TextDecoder().decode(raw))}catch{return reply(request,{ok:false,error:'invalid_json'},400)}
      const webhookId=request.headers.get('X-Shopify-Webhook-Id');
      const event={id:webhookId&&safeId(webhookId)?webhookId:`sha256-${await digest(new TextDecoder().decode(raw))}`,
        orderId:String(order?.id||''),checkoutId:null,caseId:null};
      const lines=Array.isArray(order?.line_items)?order.line_items:[];
      const productLines=lines.filter(x=>String(x?.variant_id)===VARIANT);
      if(productLines.length===0)return paymentOutcome(request,env,event,'ignored','not_actero_product');
      if(order?.financial_status!=='paid')return paymentOutcome(request,env,event,'ignored','not_paid');
      const line=productLines.length===1?productLines[0]:null;
      const cid=line?valueOfProperty(line,'_actero_checkout_id'):null;
      event.checkoutId=safeId(cid)?cid:null;
      const review=reason=>paymentOutcome(request,env,event,'needs_review',reason);
      if(order?.cancelled_at)return review('paid_but_cancelled');
      if(order?.currency!=='RON')return review('unexpected_currency');
      if(!line||Number(line.quantity)!==1)return review('unexpected_line_quantity');
      if(Number(line.price)<PRICE_RON||Number(line.total_discount||0)!==0||Number(order.total_price)<PRICE_RON)
        return review('amount_or_discount_mismatch');
      if(!event.checkoutId)return review('missing_checkout_id');
      if(!/^\d+$/.test(event.orderId))return review('invalid_order_id');
      try{
        const revokedOrder=await env.DB.prepare('SELECT reason FROM order_revocations WHERE order_id=? LIMIT 1').bind(event.orderId).first();
        if(revokedOrder)return paymentOutcome(request,env,event,'ignored','revoked_prior_to_payment');
        const intent=await env.DB.prepare('SELECT checkout_id,case_id,route,guide_key FROM checkout_intents WHERE checkout_id=? LIMIT 1').bind(event.checkoutId).first();
        if(!intent)return review('unknown_checkout');
        event.caseId=intent.case_id;
        const prev=await env.DB.prepare('SELECT status,route,guide_key,shopify_order_id,revoked_at FROM access_grants WHERE case_id=? LIMIT 1').bind(intent.case_id).first();
        if(prev?.status==='paid'){
          if(String(prev.shopify_order_id)===event.orderId)
            return paymentOutcome(request,env,event,'duplicate','same_order_already_granted');
          return review('second_paid_order_for_case');
        }
        if(!prev||prev.status!=='pending'||prev.route!==intent.route||prev.guide_key!==intent.guide_key)
          return review('grant_mismatch');
        // Checkout and payment can happen hours apart. Re-check the exact approved
        // D1 content here; otherwise Shopify could charge for a now-withdrawn guide.
        // On mismatch, flag the genuine paid order for a human refund/resolution.
        // Never auto-deliver unapproved code, and never silently acknowledge it.
        const currentGuide=await env.DB.prepare(`SELECT g.script_js,a.script_sha256
          FROM guide_scripts AS g INNER JOIN guide_approvals AS a
          ON a.guide_key=g.guide_key AND a.route=g.route AND a.status='approved'
          WHERE g.guide_key=? AND g.route=? LIMIT 1`).bind(intent.guide_key,intent.route).first();
        if(!currentGuide||typeof currentGuide.script_js!=='string'||!currentGuide.script_js.trim()||
          typeof currentGuide.script_sha256!=='string'||
          (await digest(currentGuide.script_js))!==currentGuide.script_sha256)
          return review('guide_unavailable_after_checkout');
        const name=typeof order.name==='string'?order.name.slice(0,64):null;
        const paidEmail=buyerEmail(order.email||order.contact_email||order.customer?.email);
        const buyerHash=paidEmail ? await buyerEmailHash(env,paidEmail) : null;
        const changes=await env.DB.batch([
          env.DB.prepare(`UPDATE access_grants SET status='paid',shopify_order_id=?,shopify_order_name=?,recovery_email_hash=?,paid_at=datetime('now'),updated_at=datetime('now')
            WHERE case_id=? AND route=? AND guide_key=? AND status='pending' AND revoked_at IS NULL
            AND NOT EXISTS(SELECT 1 FROM order_revocations WHERE order_id=?)`)
            .bind(event.orderId,name,buyerHash,intent.case_id,intent.route,intent.guide_key,event.orderId),
          env.DB.prepare(`UPDATE checkout_intents SET status='paid' WHERE checkout_id=? AND status='pending'`).bind(event.checkoutId)
        ]);
        if(changes[0]?.meta?.changes!==1){
          // The database state may have changed concurrently; log instead of silently acking.
          return review('grant_not_updated');
        }
        return paymentOutcome(request,env,event,'granted','paid_and_granted');
      }catch(e){console.error('paid webhook processing failure',e);return reply(request,{ok:false,error:'webhook_database_error'},500)}
    }
    if(request.method==='POST'&&[
      '/webhooks/shopify/refunds-create','/webhooks/shopify/orders-cancelled','/webhooks/shopify/disputes-create'
    ].includes(path)){
      const expected={
        '/webhooks/shopify/refunds-create':'refunds/create',
        '/webhooks/shopify/orders-cancelled':'orders/cancelled',
        '/webhooks/shopify/disputes-create':'disputes/create'
      }[path];
      if(!env.SHOPIFY_WEBHOOK_SECRET||!env.DB)return reply(request,{ok:false,error:'webhook_not_configured'},503);
      const raw=await request.arrayBuffer();
      if(!await validWebhook(request,raw,env.SHOPIFY_WEBHOOK_SECRET))return reply(request,{ok:false,error:'invalid_signature'},401);
      if(request.headers.get('X-Shopify-Shop-Domain')!==SHOP||request.headers.get('X-Shopify-Topic')!==expected)
        return reply(request,{ok:false,error:'wrong_shop_or_topic'},403);
      let data;try{data=JSON.parse(new TextDecoder().decode(raw))}catch{return reply(request,{ok:false,error:'invalid_json'},400)}
      const orderId=String(expected==='orders/cancelled'?data?.id:data?.order_id||'');
      if(!/^\d+$/.test(orderId))return reply(request,{ok:false,error:'invalid_order_id'},400);
      const webhookId=request.headers.get('X-Shopify-Webhook-Id');
      const event={id:webhookId&&safeId(webhookId)?webhookId:`sha256-${await digest(expected+':'+new TextDecoder().decode(raw))}`,
        orderId,topic:expected,caseId:null};
      try{
        const grant=await env.DB.prepare('SELECT case_id,status,revoked_at FROM access_grants WHERE shopify_order_id=? LIMIT 1').bind(orderId).first();
        event.caseId=grant?.case_id||null;
        if(expected==='refunds/create'){
          // Shopify supplies refunded line items, including the purchased variant.
          // A purely monetary or ambiguous refund requires manual review, not automatic revocation.
          const lines=Array.isArray(data?.refund_line_items)?data.refund_line_items:[];
          if(lines.some(x=>String(x?.line_item?.variant_id)===VARIANT&&Number(x?.quantity)>=1))
            return recordRevocation(request,env,event,'actero_product_refunded',grant?'revoked':'pending_order');
          if(!lines.length||lines.some(x=>!x?.line_item||x.line_item.variant_id==null)){
            // If the refund arrives BEFORE orders/paid, block a later accidental grant.
            // Once an order is granted, don't revoke on an unidentifiable monetary-only refund.
            if(grant)return recordRevocation(request,env,event,'refund_without_identifiable_actero_item','needs_review');
            return recordRevocation(request,env,event,'ambiguous_refund_before_grant','pending_order');
          }
          return recordRevocation(request,env,event,'refund_for_other_product','ignored');
        }
        if(expected==='orders/cancelled'){
          const product=Array.isArray(data?.line_items)&&data.line_items.some(x=>String(x?.variant_id)===VARIANT);
          if(!grant&&!product)return recordRevocation(request,env,event,'unrelated_order_cancelled','ignored');
          return recordRevocation(request,env,event,'shopify_order_cancelled',grant?'revoked':'pending_order');
        }
        // disputes/create: temporarily revoke / prevent late grant until reviewed manually.
        return recordRevocation(request,env,event,'shopify_dispute_opened',grant?'revoked':'pending_order');
      }catch(e){console.error('refund/cancel/dispute webhook error',e);return reply(request,{ok:false,error:'revocation_processing_failed'},500)}
    }
    // The retired route-only endpoint could expose other guide variants on the same route.
    // All paid guidance must be served exclusively by the purchased guide_key.
    if(request.method==='GET'&&path==='/guide')
      return reply(request,{ok:false,error:'legacy_guide_endpoint_removed'},410);
    if(request.method==='GET'&&['/access','/guide-script'].includes(path)){
      const caseId=url.searchParams.get('case_id');
      // Never accept access secrets from URL query strings (logs, history and referrers).
      const token=request.headers.get('X-Actero-Access-Token');
      try{
        const grant=await getAccess(env,caseId,token);
        if(path==='/access'){
          if(!grant)return reply(request,{ok:true,paid:false,status:'not_found'});
          const paid=grant.status==='paid'&&!grant.revoked_at;
          // Paid entitlement and approved content availability are different facts.
          // Do not tell a customer their guide is ready if its approval was withdrawn.
          let guideAvailable=false;
          if(paid){
            const ready=await env.DB.prepare(`SELECT g.script_js,a.script_sha256
              FROM guide_scripts AS g INNER JOIN guide_approvals AS a
              ON a.guide_key=g.guide_key AND a.route=g.route AND a.status='approved'
              WHERE g.guide_key=? AND g.route=? LIMIT 1`).bind(grant.guide_key,grant.route).first();
            guideAvailable=!!(ready&&typeof ready.script_js==='string'&&ready.script_js.trim()&&
              typeof ready.script_sha256==='string'&&(await digest(ready.script_js))===ready.script_sha256);
          }
          return reply(request,{ok:true,paid,guide_available:guideAvailable,
            status:grant.revoked_at?'revoked':grant.status,route:grant.route});
        }
        if(!grant||grant.status!=='paid'||grant.revoked_at)return reply(request,{ok:false,error:'payment_required'},402);
        if(path==='/guide-script'){
          const key=url.searchParams.get('guide_key');
          if(!isKey(key)||key!==grant.guide_key)return reply(request,{ok:false,error:'guide_not_authorized'},403);
          // Never replace a purchased approved guide with an unreviewed script version.
          // On review revocation or content drift, withhold it for manual support.
          const guide=await env.DB.prepare(`SELECT g.route,g.script_js,a.script_sha256
            FROM guide_scripts AS g INNER JOIN guide_approvals AS a
            ON a.guide_key=g.guide_key AND a.route=g.route AND a.status='approved'
            WHERE g.guide_key=? LIMIT 1`).bind(key).first();
          if(!guide||guide.route!==grant.route||typeof guide.script_js!=='string'||!guide.script_js.trim()||
            typeof guide.script_sha256!=='string'||(await digest(guide.script_js))!==guide.script_sha256)
            return reply(request,{ok:false,error:'guide_not_available'},503);
          return new Response(guide.script_js,{status:200,headers:{...cors(request),...NOCACHE,'Content-Type':'application/javascript; charset=utf-8'}});
        }
        return reply(request,{ok:false,error:'not_found'},404);
      }catch(e){console.error('access error',e);return reply(request,{ok:false,error:'database_error'},500)}
    }
    return reply(request,{ok:false,error:'not_found'},404);
  }
};