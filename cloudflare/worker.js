// ActeRO Worker: checkout and webhook stay disabled until Shopify is verified.
const ALLOWED_ORIGINS=new Set(['https://mypape-dot.github.io']);
const noCache={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache'};
function cors(request){
 const origin=request.headers.get('Origin');
 return {'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGINS.has(origin)?origin:'https://mypape-dot.github.io',
 'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type',
 'Vary':'Origin','X-Content-Type-Options':'nosniff'};
}
function json(request,data,status=200,extra={}){
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...cors(request),...noCache,...extra}});
}
function validCaseId(s){return typeof s==='string'&&s.length>0&&s.length<=120&&/^[a-zA-Z0-9_-]+$/.test(s)}
function validGuideKey(s){return typeof s==='string'&&s.length>0&&s.length<=120&&/^[A-Z0-9_]+$/.test(s)}
async function getGrant(env,id){
 return env.DB.prepare('SELECT case_id,status,route,guide_key,paid_at FROM access_grants WHERE case_id = ? LIMIT 1').bind(id).first();
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
  if(request.method==='GET'&&path==='/')return json(request,{ok:true,service:'ActeRO API',status:'online'});
  if(request.method==='GET'&&path==='/health')return json(request,{ok:true,service:'actero-api',version:'0.4.0'});
  if(request.method==='POST'&&path==='/checkout')return json(request,{ok:false,error:'checkout_not_configured'},501);
  if(request.method==='POST'&&path==='/webhooks/shopify/orders-paid')return json(request,{ok:false,error:'webhook_not_configured'},501);
  if(request.method==='GET'&&['/access','/guide-script','/guide'].includes(path)){
   const id=url.searchParams.get('case_id');
   if(!validCaseId(id))return json(request,{ok:false,error:'invalid_case_id'},400);
   try{
    const grant=await getGrant(env,id);
    if(path==='/access')return json(request,{ok:true,paid:!!(grant&&grant.status==='paid'),status:grant?.status||'not_found',
      case_id:id,route:grant?.route||null,paid_at:grant?.paid_at||null});
    if(!grant||grant.status!=='paid')return json(request,{ok:false,error:'payment_required'},402);
    if(path==='/guide-script'){
      const requested=url.searchParams.get('guide_key');
      if(!validGuideKey(requested))return json(request,{ok:false,error:'invalid_guide_key'},400);
      // A grant is scoped to ONE guide variant. Fallback supports the existing A1 proof-of-concept.
      const permitted=grant.guide_key||(grant.route==='A1_PERSONAL_ROMANIA'?'A1_PERSONAL_ROMANIA':null);
      if(!permitted||permitted!==requested)return json(request,{ok:false,error:'guide_not_authorized'},403);
      const guide=await env.DB.prepare('SELECT route,script_js FROM guide_scripts WHERE guide_key = ? LIMIT 1').bind(permitted).first();
      if(!guide||guide.route!==grant.route)return json(request,{ok:false,error:'guide_not_found'},404);
      return new Response(guide.script_js,{status:200,headers:{...cors(request),...noCache,'Content-Type':'application/javascript; charset=utf-8'}});
    }
    const row=await env.DB.prepare('SELECT route,title,guide_json,updated_at FROM guides WHERE route = ? LIMIT 1').bind(grant.route).first();
    if(!row)return json(request,{ok:false,error:'guide_not_found'},404);
    let guide;try{guide=JSON.parse(row.guide_json)}catch{return json(request,{ok:false,error:'invalid_guide_data'},500)}
    return json(request,{ok:true,paid:true,case_id:id,route:row.route,title:row.title,updated_at:row.updated_at,guide});
   }catch(e){console.error('ActeRO DB error',e);return json(request,{ok:false,error:'database_error'},500)}
  }
  return json(request,{ok:false,error:'not_found'},404);
 }
};
