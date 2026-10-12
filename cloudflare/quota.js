// F-06: atomic D1 fixed-window quotas. Do not store raw IP addresses.
// Only trust CF-Connecting-IP from Cloudflare's Worker runtime, never X-Forwarded-For.
const encoder=new TextEncoder();
async function hash(s){const d=await crypto.subtle.digest('SHA-256',encoder.encode(s));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function quota(request,env,action,{limit,windowSeconds,identity}={}){
  if(!env.DB||typeof env.ABUSE_HASH_PEPPER!=='string'||env.ABUSE_HASH_PEPPER.length<32)
    return {allowed:false,error:'quota_not_configured'};
  const ip=request.headers.get('CF-Connecting-IP');
  if(!ip||ip.length>100)return {allowed:false,error:'client_ip_unavailable'};
  const now=Math.floor(Date.now()/1000);
  const bucketIndex=Math.floor(now/windowSeconds);
  const raw=action+'|'+bucketIndex+'|'+ip+'|'+(identity||'');
  const bucket=await hash(env.ABUSE_HASH_PEPPER+'|'+raw);
  try{
    const result=await env.DB.prepare(`INSERT INTO request_quotas(bucket,count,updated_at) VALUES (?,1,?)
      ON CONFLICT(bucket) DO UPDATE SET count=count+1,updated_at=excluded.updated_at
      WHERE count < ?`).bind(bucket,now,limit).run();
    return {allowed:Number(result?.meta?.changes||0)===1};
  }catch(e){
    console.error('ActeRO quota storage unavailable');
    return {allowed:false,error:'quota_database_unavailable'};
  }
}
