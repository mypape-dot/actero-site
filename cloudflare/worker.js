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
    'Access-Control-Allow-Headers': 'Content-Type, X-Actero-Access-Token',
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
  const row=await env.DB.prepare('SELECT case_id,status,route,guide_key,paid_at,access_token_hash FROM access_grants WHERE case_id = ? LIMIT 1').bind(caseId).first();
  if(!row?.access_token_hash || (await digest(accessToken))!==row.access_token_hash)return null;
  return row;
}
function forbiddenOrigin(request){return request.headers.has('Origin') && request.headers.get('Origin')!==ORIGIN}

export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==='OPTIONS')return forbiddenOrigin(request)?new Response(null,{status:403}):new Response(null,{status:204,headers:cors(request)});
    if(request.method==='GET'&&path==='/')return reply(request,{ok:true,service:'ActeRO API',status:'online'});
    if(request.method==='GET'&&path==='/health')return reply(request,{ok:true,service:'actero-api',version:'0.5.0',checkout_enabled:env.SHOPIFY_CHECKOUT_ENABLED==='true'});

    // Checkout link is disabled by default, even if the product happens to become active.
    if(request.method==='POST'&&path==='/checkout'){
      if(forbiddenOrigin(request))return reply(request,{ok:false,error:'origin_not_allowed'},403);
      if(env.SHOPIFY_CHECKOUT_ENABLED!=='true')return reply(request,{ok:false,error:'checkout_disabled'},503);
      let data;try{data=await request.json()}catch{return reply(request,{ok:false,error:'invalid_json'},400)}
      const caseId=data?.case_id,route=data?.route,guideKey=data?.guide_key;
      if(!isCase(caseId)||!isRoute(route)||!isKey(guideKey))return reply(request,{ok:false,error:'invalid_case'},400);
      if(!(env.DB && env.SHOPIFY_WEBHOOK_SECRET))return reply(request,{ok:false,error:'payment_not_configured'},503);
      try{
        const guide=await env.DB.prepare('SELECT guide_key,route FROM guide_scripts WHERE guide_key=? LIMIT 1').bind(guideKey).first();
        if(!guide||guide.route!==route)return reply(request,{ok:false,error:'guide_not_available'},409);
        const current=await env.DB.prepare('SELECT status,guide_key FROM access_grants WHERE case_id=? LIMIT 1').bind(caseId).first();
        if(current?.status==='paid')return reply(request,{ok:false,error:'already_paid'},409);
        if(current?.guide_key && current.guide_key!==guideKey)return reply(request,{ok:false,error:'case_route_changed'},409);
        const accessToken=crypto.randomUUID()+'.'+crypto.randomUUID();
        const tokenHash=await digest(accessToken);
        const checkoutId='ACO-'+crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO access_grants (case_id,status,route,guide_key,access_token_hash,created_at,updated_at)
          VALUES (?,'pending',?,?,?,datetime('now'),datetime('now'))
          ON CONFLICT(case_id) DO UPDATE SET updated_at=datetime('now'),access_token_hash=excluded.access_token_hash
          WHERE access_grants.status='pending' AND access_grants.guide_key=excluded.guide_key AND access_grants.route=excluded.route`)
            .bind(caseId,route,guideKey,tokenHash),
          env.DB.prepare('INSERT INTO checkout_intents (checkout_id,case_id,route,guide_key) VALUES (?,?,?,?)').bind(checkoutId,caseId,route,guideKey)
        ]);
        const props={_actero_checkout_id:checkoutId};
        const checkoutUrl=`https://${SHOP}/cart/${VARIANT}:1?properties=${encodeURIComponent(base64urlText(JSON.stringify(props)))}`;
        return reply(request,{ok:true,checkoutUrl,accessToken});
      }catch(e){console.error('checkout error',e);return reply(request,{ok:false,error:'checkout_database_error'},500)}
    }

    // Admin-created Shopify Notifications > Webhooks > Order payment, JSON.
    if(request.method==='POST'&&path==='/webhooks/shopify/orders-paid'){
      if(!env.SHOPIFY_WEBHOOK_SECRET)return reply(request,{ok:false,error:'webhook_not_configured'},503);
      const raw=await request.arrayBuffer();
      if(!await validWebhook(request,raw,env.SHOPIFY_WEBHOOK_SECRET))return reply(request,{ok:false,error:'invalid_signature'},401);
      if(request.headers.get('X-Shopify-Shop-Domain')!==SHOP || request.headers.get('X-Shopify-Topic')!=='orders/paid')
        return reply(request,{ok:false,error:'wrong_shop_or_topic'},403);
      let order;try{order=JSON.parse(new TextDecoder().decode(raw))}catch{return reply(request,{ok:false,error:'invalid_json'},400)}
      const paid=order?.financial_status==='paid' && !order?.cancelled_at;
      if(!paid || order?.currency!=='RON')return reply(request,{ok:true,ignored:'not_paid_or_wrong_currency'});
      const matching=(Array.isArray(order?.line_items)?order.line_items:[]).filter(x=>
        String(x?.variant_id)===VARIANT && Number(x?.quantity)===1 &&
        Number(x?.price)>=PRICE_RON && Number(x?.total_discount||0)===0 && safeId(valueOfProperty(x,'_actero_checkout_id'))
      );
      if(matching.length!==1||Number(order?.total_price)<PRICE_RON)return reply(request,{ok:true,ignored:'item_not_valid'});
      const checkoutId=valueOfProperty(matching[0],'_actero_checkout_id');
      const orderId=String(order?.id||'');
      if(!/^\d+$/.test(orderId))return reply(request,{ok:false,error:'invalid_order_id'},400);
      try{
        const intent=await env.DB.prepare('SELECT checkout_id,case_id,route,guide_key FROM checkout_intents WHERE checkout_id=? LIMIT 1').bind(checkoutId).first();
        if(!intent)return reply(request,{ok:true,ignored:'unknown_checkout'});
        const prev=await env.DB.prepare('SELECT status,route,guide_key,shopify_order_id FROM access_grants WHERE case_id=? LIMIT 1').bind(intent.case_id).first();
        if(prev?.status==='paid')return reply(request,{ok:true,duplicate:true});
        if(!prev||prev.status!=='pending'||prev.route!==intent.route||prev.guide_key!==intent.guide_key)
          return reply(request,{ok:true,ignored:'grant_mismatch'});
        const name=typeof order?.name==='string' ? order.name.slice(0,64):null;
        const r=await env.DB.prepare(`UPDATE access_grants SET status='paid',shopify_order_id=?,shopify_order_name=?,paid_at=datetime('now'),updated_at=datetime('now')
          WHERE case_id=? AND route=? AND guide_key=? AND status='pending'`).bind(orderId,name,intent.case_id,intent.route,intent.guide_key).run();
        if(!r.meta?.changes)return reply(request,{ok:false,error:'grant_not_updated'},500);
        await env.DB.prepare(`UPDATE checkout_intents SET status='paid' WHERE checkout_id=?`).bind(checkoutId).run();
        return reply(request,{ok:true,granted:true});
      }catch(e){console.error('paid webhook processing failure',e);return reply(request,{ok:false,error:'webhook_database_error'},500)}
    }
    if(request.method==='GET'&&['/access','/guide-script','/guide'].includes(path)){
      const caseId=url.searchParams.get('case_id');
      const token=request.headers.get('X-Actero-Access-Token') || url.searchParams.get('access_token');
      try{
        const grant=await getAccess(env,caseId,token);
        if(path==='/access')return grant?reply(request,{ok:true,paid:grant.status==='paid',status:grant.status,route:grant.route}):reply(request,{ok:true,paid:false,status:'not_found'});
        if(!grant||grant.status!=='paid')return reply(request,{ok:false,error:'payment_required'},402);
        if(path==='/guide-script'){
          const key=url.searchParams.get('guide_key');
          if(!isKey(key)||key!==grant.guide_key)return reply(request,{ok:false,error:'guide_not_authorized'},403);
          const guide=await env.DB.prepare('SELECT route,script_js FROM guide_scripts WHERE guide_key=? LIMIT 1').bind(key).first();
          if(!guide||guide.route!==grant.route)return reply(request,{ok:false,error:'guide_not_found'},404);
          return new Response(guide.script_js,{status:200,headers:{...cors(request),...NOCACHE,'Content-Type':'application/javascript; charset=utf-8'}});
        }
        const row=await env.DB.prepare('SELECT route,title,guide_json,updated_at FROM guides WHERE route=? LIMIT 1').bind(grant.route).first();
        if(!row)return reply(request,{ok:false,error:'guide_not_found'},404);
        return reply(request,{ok:true,route:row.route,title:row.title,guide:JSON.parse(row.guide_json),updated_at:row.updated_at});
      }catch(e){console.error('access error',e);return reply(request,{ok:false,error:'database_error'},500)}
    }
    return reply(request,{ok:false,error:'not_found'},404);
  }
};