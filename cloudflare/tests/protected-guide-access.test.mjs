// Run: node --test cloudflare/tests/protected-guide-access.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import worker from '../worker.js';

const caseId='AR-12345678-1234-4123-8123-123456789012';
const token='authorized-token-'+('x'.repeat(50));
const hash=createHash('sha256').update(token).digest('hex');
const origin='https://mypape-dot.github.io';
function envFor({revoked=false,approved=true,changed=false}={}){
  let guideQueries=0;
  const DB={
    prepare(sql){
      return {bind(...params){
        return {async first(){
          if(sql.includes('FROM access_grants WHERE case_id'))
            return {case_id:caseId,status:'paid',route:'B1_FIRST_CRDS',
              guide_key:'B1_IT',access_token_hash:hash,revoked_at:revoked?'2026-10-12':null};
          if(sql.includes('FROM guide_scripts AS g INNER JOIN guide_approvals AS a')){
            guideQueries++;
            return approved?{route:'B1_FIRST_CRDS',
              script_js:changed?'window.changed=true;':'window.verified=true;',
              script_sha256:createHash('sha256').update('window.verified=true;').digest('hex')}:null;
          }
          throw Error('Unexpected query: '+sql);
        }};
      }};
    }
  };
  return {DB,guideQueries:()=>guideQueries};
}
async function get(path,env,headerToken){
  const response=await worker.fetch(new Request('https://worker.invalid'+path,{
    headers:{Origin:origin,...(headerToken?{'X-Actero-Access-Token':headerToken}:{})}
  }),env);
  return {status:response.status,text:await response.text()};
}
test('legacy route-level paid guide endpoint is permanently unavailable',async()=>{
  const env=envFor();
  const r=await get('/guide?case_id='+caseId,env,token);
  assert.equal(r.status,410);
  assert.equal(env.guideQueries(),0);
});
test('access token is ignored in URL query strings',async()=>{
  const env=envFor();
  const a=await get('/access?case_id='+caseId+'&access_token='+encodeURIComponent(token),env);
  assert.equal(a.status,200);
  assert.equal(JSON.parse(a.text).paid,false);
  const b=await get('/guide-script?case_id='+caseId+'&guide_key=B1_IT&access_token='+encodeURIComponent(token),env);
  assert.equal(b.status,402);
  assert.equal(env.guideQueries(),0);
});
test('a paid B1_IT token cannot fetch another country within the same route',async()=>{
  const env=envFor();
  const denied=await get('/guide-script?case_id='+caseId+'&guide_key=B1_ES',env,token);
  assert.equal(denied.status,403);
  assert.equal(env.guideQueries(),0);
  const allowed=await get('/guide-script?case_id='+caseId+'&guide_key=B1_IT',env,token);
  assert.equal(allowed.status,200);
  assert.equal(allowed.text,'window.verified=true;');
  assert.equal(env.guideQueries(),1);
});
test('revoked token cannot retrieve any private guide script',async()=>{
  const env=envFor({revoked:true});
  const res=await get('/guide-script?case_id='+caseId+'&guide_key=B1_IT',env,token);
  assert.equal(res.status,402);
  assert.equal(env.guideQueries(),0);
});

test('a paid token cannot receive guide content after review approval is withdrawn',async()=>{
  const env=envFor({approved:false});
  const result=await get('/guide-script?case_id='+caseId+'&guide_key=B1_IT',env,token);
  assert.equal(result.status,503);
});
test('editing an approved guide invalidates its review fingerprint',async()=>{
  const env=envFor({changed:true});
  const result=await get('/guide-script?case_id='+caseId+'&guide_key=B1_IT',env,token);
  assert.equal(result.status,503);
});
