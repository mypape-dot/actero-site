// Existing deployments keep their defaults. Staging must explicitly select new targets.
export const LEGACY = Object.freeze({origin:'https://mypape-dot.github.io',shop:'gyfu4v-5q.myshopify.com',variant:'67640764400007'});
export const knownEnvironment = env => env.ACTERO_ENVIRONMENT === undefined || ['production','staging'].includes(env.ACTERO_ENVIRONMENT);
export function httpsOrigin(value){
  try{const u=new URL(value);return u.protocol==='https:' && u.origin===value && !u.username && !u.password ? u.origin : null}catch{return null}
}
export function appOrigin(env){
  if(!knownEnvironment(env))return null;
  const staging=env.ACTERO_ENVIRONMENT==='staging';
  const origin=httpsOrigin(env.APP_ORIGIN ?? (staging ? '' : LEGACY.origin));
  return staging && origin===LEGACY.origin ? null : origin;
}
export function shopifyConfig(env){
  if(!knownEnvironment(env))return null;
  const staging=env.ACTERO_ENVIRONMENT==='staging';
  const shop=env.SHOPIFY_SHOP_DOMAIN ?? (staging ? '' : LEGACY.shop);
  const variant=env.SHOPIFY_VARIANT_ID ?? (staging ? '' : LEGACY.variant);
  if(typeof shop!=='string'||!/^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/.test(shop))return null;
  if(typeof variant!=='string'||!/^\d{1,20}$/.test(variant)||/^0+$/.test(variant))return null;
  if(staging && (shop===LEGACY.shop || variant===LEGACY.variant || env.SHOPIFY_PAYMENT_MODE!=='test'))return null;
  return {shop,variant};
}
export function originAllowed(request,env){
  const origin=appOrigin(env);
  return !!origin && (!request.headers.has('Origin') || request.headers.get('Origin')===origin);
}
export function corsHeaders(request,env){
  const origin=appOrigin(env);
  return {
    ...(origin && originAllowed(request,env) ? {'Access-Control-Allow-Origin':origin} : {}),
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, X-Actero-Access-Token, X-Actero-Session-Token',
    'Vary':'Origin', 'X-Content-Type-Options':'nosniff'
  };
}
