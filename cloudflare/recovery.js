// F-03: order-email based guide recovery. Every route fails closed when prerequisites are absent.
// The raw purchaser email and recovery secret are never persisted in D1 or logged.
const enc=new TextEncoder();
const GENERIC={ok:true,message:'Dacă datele corespund unei comenzi eligibile, vei primi un email cu instrucțiuni.'};
const noCache={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache'};
function reply(req,body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'https://mypape-dot.github.io','Vary':'Origin',...noCache}})}
function originAllowed(req){return !req.headers.has('Origin')||req.headers.get('Origin')==='https://mypape-dot.github.io'}
function safeObj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype}
export function buyerEmail(email){
  if(typeof email!=='string')return '';
  const e=email.trim().toLowerCase();
  return e.length>=5&&e.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e)?e:'';
}
export function orderReference(input){
  if(typeof input!=='string')return '';
  const s=input.trim().replace(/^#+/,'');
  return s.length>0&&s.length<=63&&/^[a-zA-Z0-9-]+$/.test(s)?'#'+s:'';
}
export function recoveryConfigured(env){
  try{
    const u=new URL(String(env.RECOVERY_PAGE_URL||''));
    return !!env.DB && typeof env.RECOVERY_EMAIL_PEPPER==='string'&&env.RECOVERY_EMAIL_PEPPER.length>=32
      &&typeof env.RECOVERY_EMAIL_API_KEY==='string'&&env.RECOVERY_EMAIL_API_KEY.length>=8
      &&typeof env.RECOVERY_EMAIL_FROM==='string'&&!!buyerEmail(env.RECOVERY_EMAIL_FROM)
      &&u.protocol==='https:'&&u.origin==='https://mypape-dot.github.io'&&u.pathname.endsWith('/recuperare.html')
      &&!u.search&&!u.hash;
  }catch{return false}
}
export async function buyerEmailHash(env,email){
  const e=buyerEmail(email);
  if(!e||!env.RECOVERY_EMAIL_PEPPER||env.RECOVERY_EMAIL_PEPPER.length<32)return null;
  const key=await crypto.subtle.importKey('raw',enc.encode(env.RECOVERY_EMAIL_PEPPER),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(e)));
  return [...sig].map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function tokenHash(t){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(t)));return [...bytes].map(n=>n.toString(16).padStart(2,'0')).join('')}
function acceptableString(s,max=220){return typeof s==='string'&&s.length<=max&&!/[<>\u0000-\u001f]/.test(s)}
function simpleDict(o,maxEntries=90){return safeObj(o)&&Object.keys(o).length<=maxEntries&&Object.entries(o).every(([k,v])=>
  acceptableString(k,80)&&(acceptableString(v)||typeof v==='boolean'||(Number.isInteger(v)&&v>=0&&v<=10)||(Array.isArray(v)&&v.length<=16&&v.every(x=>acceptableString(x)))));
}
export function serializeCaseState(raw,route){
  if(!safeObj(raw)||raw.route!==route||!simpleDict(raw.answers)||!simpleDict(raw.docs,12)||!simpleDict(raw.clarified||{},50))return null;
  if(raw.status!=null&&!acceptableString(raw.status,70))return null;
  // Do not store browser history, access tokens or free-form messages. The frontend recalculates blockers.
  const payload={answers:raw.answers,docs:raw.docs,route,status:raw.status||null,clarified:raw.clarified||{}};
  const out=JSON.stringify(payload);
  return out.length<=16000?out:null;
}
const secretToken=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')};
export async function recoverRequest(request,env){
  if(!originAllowed(request))return reply(request,{ok:false,error:'origin_not_allowed'},403);
  if(!recoveryConfigured(env))return reply(request,{ok:false,error:'recovery_not_configured'},503);
  let data;try{data=await request.json()}catch{return reply(request,GENERIC,202)}
  const email=buyerEmail(data?.email),name=orderReference(data?.order_name);
  if(!email||!name)return reply(request,GENERIC,202);
  try{
    const hash=await buyerEmailHash(env,email);
    // Only orders that Shopify has certified as paid, not revoked, with a saved evaluation qualify.
    const row=await env.DB.prepare(`SELECT case_id FROM access_grants
      WHERE shopify_order_name=? AND recovery_email_hash=?
        AND status='paid' AND revoked_at IS NULL AND evaluation_json IS NOT NULL LIMIT 1`).bind(name,hash).first();
    if(!row)return reply(request,GENERIC,202);
    const recent=await env.DB.prepare(`SELECT COUNT(*) AS n FROM recovery_links
      WHERE case_id=? AND created_at>unixepoch()-3600`).bind(row.case_id).first();
    if(Number(recent?.n||0)>=3)return reply(request,GENERIC,202);
    const token=secretToken(),hashToken=await tokenHash(token);
    const expires=Math.floor(Date.now()/1000)+1800;
    await env.DB.prepare(`INSERT INTO recovery_links(token_hash,case_id,expires_at) VALUES(?,?,?)`)
      .bind(hashToken,row.case_id,expires).run();
    const url=new URL(env.RECOVERY_PAGE_URL);
    url.hash='token='+token; // fragment is never sent to Pages or by the HTTP Referer
    const urlText=url.toString();
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:'Bearer '+env.RECOVERY_EMAIL_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({from:env.RECOVERY_EMAIL_FROM,to:[email],subject:'Recuperează accesul la ghidul ActeRO',
        text:'Ai solicitat recuperarea ghidului ActeRO. Deschide acest link în maximum 30 de minute: '+urlText+'\nDacă nu ai solicitat recuperarea, ignoră mesajul.'})
    });
    if(!response.ok){
      await env.DB.prepare('DELETE FROM recovery_links WHERE token_hash=? AND delivered_at IS NULL').bind(hashToken).run();
      console.error('ActeRO recovery mail provider unavailable; status',response.status);
    }else{
      await env.DB.prepare('UPDATE recovery_links SET delivered_at=unixepoch() WHERE token_hash=?').bind(hashToken).run();
    }
    return reply(request,GENERIC,202);
  }catch(e){console.error('ActeRO recovery request failed',e?.message||'error');return reply(request,GENERIC,202)}
}
export async function recoverConsume(request,env){
  if(!originAllowed(request))return reply(request,{ok:false,error:'origin_not_allowed'},403);
  if(!env.DB)return reply(request,{ok:false,error:'recovery_not_configured'},503);
  let data;try{data=await request.json()}catch{return reply(request,{ok:false,error:'invalid_or_expired_link'},400)}
  const token=data?.token;
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return reply(request,{ok:false,error:'invalid_or_expired_link'},400);
  try{
    const hash=await tokenHash(token);
    const row=await env.DB.prepare(`SELECT r.case_id,a.status,a.revoked_at,a.route,a.guide_key,a.evaluation_json
      FROM recovery_links r JOIN access_grants a ON a.case_id=r.case_id
      WHERE r.token_hash=? AND r.consumed_at IS NULL AND r.delivered_at IS NOT NULL
        AND r.expires_at>unixepoch() AND a.status='paid' AND a.revoked_at IS NULL LIMIT 1`).bind(hash).first();
    if(!row||!row.evaluation_json)return reply(request,{ok:false,error:'invalid_or_expired_link'},400);
    let caseState;try{caseState=JSON.parse(row.evaluation_json)}catch{return reply(request,{ok:false,error:'recovery_support_required'},409)}
    if(!safeObj(caseState)||!safeObj(caseState.answers)||!safeObj(caseState.docs)||caseState.route!==row.route)
      return reply(request,{ok:false,error:'recovery_support_required'},409);
    const accessToken=crypto.randomUUID()+'.'+crypto.randomUUID();
    const newHash=await tokenHash(accessToken),nonce=crypto.randomUUID();
    const result=await env.DB.batch([
      env.DB.prepare(`UPDATE recovery_links SET consumed_at=unixepoch(),consumed_by=?
        WHERE token_hash=? AND consumed_at IS NULL AND delivered_at IS NOT NULL AND expires_at>unixepoch()
        AND EXISTS (SELECT 1 FROM access_grants WHERE case_id=? AND status='paid' AND revoked_at IS NULL)`)
        .bind(nonce,hash,row.case_id),
      env.DB.prepare(`UPDATE access_grants SET access_token_hash=?,updated_at=datetime('now')
        WHERE case_id=? AND status='paid' AND revoked_at IS NULL
          AND EXISTS(SELECT 1 FROM recovery_links WHERE token_hash=? AND consumed_by=?)`)
        .bind(newHash,row.case_id,hash,nonce)
    ]);
    if(result[0]?.meta?.changes!==1||result[1]?.meta?.changes!==1)
      return reply(request,{ok:false,error:'invalid_or_expired_link'},400);
    return reply(request,{ok:true,case_id:row.case_id,guide_key:row.guide_key,access_token:accessToken,case_state:caseState});
  }catch(e){console.error('ActeRO recovery consume failed',e?.message||'error');return reply(request,{ok:false,error:'recovery_unavailable'},503)}
}
