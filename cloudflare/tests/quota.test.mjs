import test from 'node:test';
import assert from 'node:assert/strict';
import {quota} from '../quota.js';

// Run with: node --test cloudflare/tests/quota.test.mjs
// D1 adapter models atomic INSERT...ON CONFLICT...WHERE count < limit.
function mockDb(){
  const rows=new Map();
  return {rows,prepare(sql){
    return {bind(bucket,now,limit){
      return {async run(){
        const row=rows.get(bucket);
        if(!row){rows.set(bucket,{count:1,updated_at:now});return {meta:{changes:1}}}
        if(row.count>=limit)return {meta:{changes:0}};
        row.count++;row.updated_at=now;return {meta:{changes:1}};
      }};
    }};
  }};
}
const pepper='long-secret-pepper-for-quota-tests-123456789';
const request=ip=>new Request('https://worker.example/checkout',{headers:ip?{'CF-Connecting-IP':ip}:{}});
test('quota allows first 8 and blocks ninth checkout per IP',async()=>{
  const DB=mockDb(),env={DB,ABUSE_HASH_PEPPER:pepper},req=request('198.51.100.12');
  for(let i=0;i<8;i++)assert.equal((await quota(req,env,'checkout',{limit:8,windowSeconds:3600})).allowed,true);
  assert.equal((await quota(req,env,'checkout',{limit:8,windowSeconds:3600})).allowed,false);
  assert.equal(DB.rows.size,1);
  const key=[...DB.rows.keys()][0];
  assert.ok(!key.includes('198.51.100.12'),'raw IP must never be persisted');
});
test('separate IP and action buckets',async()=>{
  const env={DB:mockDb(),ABUSE_HASH_PEPPER:pepper};
  for(let i=0;i<2;i++)assert.equal((await quota(request('198.51.100.1'),env,'recover',{limit:2,windowSeconds:3600})).allowed,true);
  assert.equal((await quota(request('198.51.100.1'),env,'recover',{limit:2,windowSeconds:3600})).allowed,false);
  assert.equal((await quota(request('198.51.100.2'),env,'recover',{limit:2,windowSeconds:3600})).allowed,true);
  assert.equal((await quota(request('198.51.100.1'),env,'checkout',{limit:2,windowSeconds:3600})).allowed,true);
});
test('quota fails closed if D1, pepper or trusted IP unavailable',async()=>{
  const DB=mockDb();
  for(const [req,env] of [[request('198.51.100.1'),{DB}],[request(),{DB,ABUSE_HASH_PEPPER:pepper}],[request('198.51.100.1'),{ABUSE_HASH_PEPPER:pepper}]]){
    assert.equal((await quota(req,env,'checkout',{limit:8,windowSeconds:3600})).allowed,false);
  }
});
test('D1 failure is not silently bypassed',async()=>{
  const env={DB:{prepare(){throw Error('db offline')}},ABUSE_HASH_PEPPER:pepper};
  assert.equal((await quota(request('198.51.100.1'),env,'checkout',{limit:8,windowSeconds:3600})).allowed,false);
});
test('concurrent requests do not exceed the configured quota',async()=>{
  const env={DB:mockDb(),ABUSE_HASH_PEPPER:pepper};
  const results=await Promise.all(Array.from({length:20},()=>quota(request('203.0.113.5'),env,'checkout',{limit:8,windowSeconds:3600})));
  assert.equal(results.filter(x=>x.allowed).length,8);
});
