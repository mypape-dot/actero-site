import {Miniflare,Response as LocalResponse} from 'miniflare';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {baseline,bindings,migrations,migrationSQL} from './payment-harness.mjs';

// Entirely synthetic renderer; no private guide source is read or exported.
const script=`const ACTERO_SYNTHETIC_ONCE=true;
function showB1ESValidatedGuide(){
  screen.innerHTML='<h1 id="syntheticGuide">Ghid sintetic de test</h1><p id="syntheticCountry"></p>';
  document.getElementById('syntheticCountry').textContent=S.answers.residence_country;
}`;
export async function localWorker(){
  const bundle=await build({entryPoints:[fileURLToPath(new URL('../../worker.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser'});
  const mail=[],alerts=[],unexpected=[];
  let emailUnavailable=false,alertUnavailable=false;
  const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2025-09-27',
    host:'127.0.0.1',port:0,d1Databases:['DB'],bindings,cf:false,
    // Deny all real egress. Only local in-process mail and alert sinks exist.
    outboundService:async request=>{
      const url=new URL(request.url);
      if(url.href==='https://api.resend.com/emails'){
        if(emailUnavailable)return new LocalResponse('{}',{status:503});
        mail.push(await request.json());return new LocalResponse('{"id":"synthetic-mail"}');
      }
      if(url.href===bindings.PAYMENT_ALERT_WEBHOOK_URL){
        if(alertUnavailable)return new LocalResponse('{}',{status:503});
        alerts.push(await request.json());return new LocalResponse('{}');
      }
      unexpected.push(url.origin);return new LocalResponse('External access blocked by test harness',{status:502});
    }});
  try{
    const db=await mf.getD1Database('DB');
    for(const source of [baseline(),...migrations().map(migrationSQL)]){
      const statements=source.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean);
      await db.batch(statements.map(sql=>db.prepare(sql)));
    }
    await db.prepare('INSERT INTO guide_scripts(guide_key,route,title,script_js) VALUES(?,?,?,?)')
      .bind('B1_ES','B1_FIRST_CRDS','SYNTHETIC LOCAL FIXTURE',script).run();
    await db.prepare("INSERT INTO guide_approvals(guide_key,route,script_sha256,status,reviewer_reference,approved_at) VALUES(?,?,?,'approved','synthetic-only',datetime('now'))")
      .bind('B1_ES','B1_FIRST_CRDS',createHash('sha256').update(script).digest('hex')).run();
    const dispatch=async request=>mf.dispatchFetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),
      ...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}: {})});
    return {db,dispatch,mail,alerts,unexpected,dispose:()=>mf.dispose(),
      setEmailUnavailable:value=>{emailUnavailable=value},setAlertUnavailable:value=>{alertUnavailable=value}};
  }catch(error){await mf.dispose();throw error}
}
