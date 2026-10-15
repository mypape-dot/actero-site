import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {validateConfig} from '../staging/check-config.mjs';
import {buildSchema,schemaURL} from '../staging/build-schema.mjs';
import {baseline,migrations,migrationSQL,ORIGIN} from './helpers/payment-harness.mjs';
import {localWorker} from './helpers/local-worker.mjs';

const template=()=>JSON.parse(readFileSync(new URL('../staging/wrangler.json.example',import.meta.url),'utf8'));
const prodId='11111111-1111-4111-8111-111111111111'; // Synthetic identifiers only.
const stageId='abcdefab-2222-4222-8222-222222222222';
const bound=()=>{const config=template();config.account_id='0'.repeat(32);config.env.staging.d1_databases[0].database_id=stageId;return config};
const validate=config=>validateConfig(config,{productionD1Id:prodId});

test('unbound template is valid only as a template, never as a verified resource configuration',()=>{
  assert.equal(validateConfig(template(),{template:true}),true);
  assert.throws(()=>validate(template()));
  assert.equal(validate(bound()),true);
  assert.throws(()=>validateConfig(bound()),/production D1 UUID/);
});
for(const [name,change] of [
  ['production Worker',c=>{c.env.staging.name='actero'}],
  ['production database name',c=>{c.env.staging.d1_databases[0].database_name='actero-db'}],
  ['production database ID under staging name',c=>{c.env.staging.d1_databases[0].database_id=prodId}],
  ['second D1 binding',c=>{c.env.staging.d1_databases.push({...c.env.staging.d1_databases[0],binding:'OTHER'})}],
  ['root D1 binding',c=>{c.d1_databases=c.env.staging.d1_databases}],
  ['service binding to production',c=>{c.env.staging.services=[{binding:'PRODUCTION',service:'actero'}]}],
  ['production route',c=>{c.env.staging.routes=['example.test/*']}],
  ['public workers.dev endpoint',c=>{c.env.staging.workers_dev=true}],
  ['preview URL',c=>{c.env.staging.preview_urls=true}],
  ['enabled checkout',c=>{c.env.staging.vars.SHOPIFY_CHECKOUT_ENABLED='true'}],
  ['live payment mode',c=>{c.env.staging.vars.SHOPIFY_PAYMENT_MODE='live'}],
  ['secret in vars',c=>{c.env.staging.vars.SHOPIFY_WEBHOOK_SECRET='synthetic-only'}],
  ['unexpected remote migrations directory',c=>{c.env.staging.d1_databases[0].migrations_dir='..'}]
])test('staging preflight blocks '+name,()=>{const config=bound();change(config);assert.throws(()=>validate(config))});

test('D1 ID comparison is case insensitive',()=>{
  assert.throws(()=>validateConfig(bound(),{productionD1Id:stageId.toUpperCase()}),/production D1/);
});

test('committed bootstrap is reproducible and yields the historical schema without any seeded data',()=>{
  const prepared=readFileSync(schemaURL,'utf8');assert.equal(prepared,buildSchema());
  const actual=new DatabaseSync(':memory:');const reference=new DatabaseSync(':memory:');
  try{
    actual.exec(prepared);reference.exec(baseline());for(const name of migrations())reference.exec(migrationSQL(name));
    const structure=db=>db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    assert.deepEqual(structure(actual),structure(reference));
    for(const {name} of actual.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
      assert.equal(actual.prepare('SELECT COUNT(*) AS n FROM "'+name+'"').get().n,0,name+' must start empty');
    }
    actual.prepare("INSERT INTO access_grants(case_id,status,shopify_order_id) VALUES('synthetic-1','paid','synthetic-order')").run();
    assert.throws(()=>actual.prepare("INSERT INTO access_grants(case_id,status,shopify_order_id) VALUES('synthetic-2','paid','synthetic-order')").run(),/UNIQUE/);
  }finally{actual.close();reference.close()}
});

test('bootstrap fails on an initialized ActeRO DB and preserves existing rows',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec(readFileSync(schemaURL,'utf8'));
    db.exec("INSERT INTO access_grants(case_id,status) VALUES('synthetic-existing','pending')");
    assert.throws(()=>db.exec(readFileSync(schemaURL,'utf8')),/already exists/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM access_grants').get().n,1);
  }finally{db.close()}
});

test('prepared empty D1 boots in workerd with checkout closed and no guide approvals',async()=>{
  const app=await localWorker({checkoutEnabled:false,seed:false});
  try{
    for(const path of ['/session','/checkout']){
      const response=await app.dispatch(new Request('https://api.actero.test'+path,{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:'{}'}));
      assert.equal(response.status,503,path);
    }
    for(const table of ['access_grants','checkout_intents','guide_scripts','guide_approvals','guide_country_approvals']){
      assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n,0);
    }
    assert.deepEqual(app.mail,[]);assert.deepEqual(app.alerts,[]);assert.deepEqual(app.unexpected,[]);
  }finally{await app.dispose()}
});
