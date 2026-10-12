// F-06: The checkout case ID and its ownership token are issued by the backend,
// never guessed or chosen by a browser. Both are independent of a later access token.
import {quota} from './quota.js';
const ORIGIN='https://mypape-dot.github.io';
const enc=new TextEncoder();
async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
  'Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin'
}});
const isSessionToken=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
export async function issueEvaluationSession(request,env){
  if(request.headers.has('Origin')&&request.headers.get('Origin')!==ORIGIN)
    return respond({ok:false,error:'origin_not_allowed'},403);
  if(env.SHOPIFY_CHECKOUT_ENABLED!=='true')return respond({ok:false,error:'checkout_disabled'},503);
  if(!env.DB)return respond({ok:false,error:'database_not_configured'},503);
  const q=await quota(request,env,'create-session',{limit:8,windowSeconds:3600});
  if(!q.allowed)return respond({ok:false,error:q.error||'too_many_requests'},q.error?503:429);
  const caseId='AR-'+crypto.randomUUID();
  const random=new Uint8Array(32);crypto.getRandomValues(random);
  const secret=[...random].map(x=>x.toString(16).padStart(2,'0')).join('');
  const expiresAt=Math.floor(Date.now()/1000)+48*3600;
  try{
    await env.DB.prepare('INSERT INTO evaluation_sessions (case_id,session_token_hash,expires_at) VALUES (?,?,?)')
      .bind(caseId,await hash(secret),expiresAt).run();
    return respond({ok:true,case_id:caseId,session_token:secret,expires_at:expiresAt});
  }catch(e){
    console.error('ActeRO evaluation session storage unavailable');
    return respond({ok:false,error:'session_unavailable'},503);
  }
}
export async function ownsEvaluationSession(request,env,caseId){
  const secret=request.headers.get('X-Actero-Session-Token');
  if(!isSessionToken(secret)||!env.DB)return false;
  try{
    const row=await env.DB.prepare(`SELECT 1 AS valid FROM evaluation_sessions
      WHERE case_id=? AND session_token_hash=? AND expires_at>unixepoch() LIMIT 1`)
      .bind(caseId,await hash(secret)).first();
    return !!row?.valid;
  }catch(e){console.error('ActeRO evaluation session verification failed');return false}
}
