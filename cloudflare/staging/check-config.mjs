import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {appOrigin,shopifyConfig} from '../environment.js';

const accountPlaceholder = 'UNBOUND_REQUIRES_OWNER_APPROVAL';
const databasePlaceholder = 'UNBOUND_REQUIRES_SEPARATE_STAGING_DATABASE';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keys = (value, expected, label) => {
  assert(value && typeof value === 'object' && !Array.isArray(value), label + ': object required');
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label + ': unexpected/missing configuration fields');
};
const closed = (value, label) => {
  assert.equal(value.workers_dev, false, label + ': public workers.dev must remain disabled');
  assert.equal(value.preview_urls, false, label + ': preview URLs must remain disabled');
  assert.deepEqual(value.routes, [], label + ': no production or custom routes allowed');
};

// This checks a file, never Cloudflare. It does not attest that operator-supplied IDs are authentic.
// Strictly validates the initial CLOSED staging configuration; later activation needs a reviewed change.
export function validateConfig(config, {template = false, productionD1Id, requireReady = false} = {}) {
  keys(config, ['name', 'main', 'compatibility_date', 'account_id', 'workers_dev', 'preview_urls', 'routes', 'env'], 'root');
  assert.equal(config.name, 'actero-unbound-do-not-deploy', 'root must stay unbound; use explicit staging environment');
  assert.equal(config.main, '../worker.js');
  assert.equal(config.compatibility_date, '2025-09-27');
  closed(config, 'root');
  keys(config.env, ['staging'], 'environments');
  const stage = config.env.staging;
  keys(stage, ['name', 'workers_dev', 'preview_urls', 'routes', 'vars', 'd1_databases'], 'staging');
  assert.equal(stage.name, 'actero-staging', 'protected/unknown Worker target');
  closed(stage, 'staging');
  keys(stage.vars, ['ACTERO_ENVIRONMENT','APP_ORIGIN','SHOPIFY_SHOP_DOMAIN','SHOPIFY_VARIANT_ID',
    'SHOPIFY_CHECKOUT_ENABLED','SHOPIFY_PAYMENT_MODE','RECOVERY_REQUIRED','RECOVERY_PAGE_URL'], 'staging vars');
  assert.equal(stage.vars.ACTERO_ENVIRONMENT,'staging');
  assert.equal(stage.vars.SHOPIFY_CHECKOUT_ENABLED,'false','checkout must remain disabled');
  assert.equal(stage.vars.SHOPIFY_PAYMENT_MODE,'test');
  assert.equal(stage.vars.RECOVERY_REQUIRED,'true');
  assert(appOrigin(stage.vars),'a separate HTTPS staging origin is required');
  assert.equal(stage.vars.RECOVERY_PAGE_URL,appOrigin(stage.vars)+'/recuperare.html');
  const unbound=stage.vars.SHOPIFY_SHOP_DOMAIN==='UNBOUND_STAGING_SHOP' && stage.vars.SHOPIFY_VARIANT_ID==='UNBOUND_STAGING_VARIANT';
  assert(shopifyConfig(stage.vars) || (!requireReady && unbound),'a separate test shop and variant are required; no production fallback');
  assert(Array.isArray(stage.d1_databases) && stage.d1_databases.length === 1, 'exactly one staging D1 binding required');
  const db = stage.d1_databases[0];
  keys(db, ['binding', 'database_name', 'database_id', 'migrations_dir'], 'D1');
  assert.equal(db.binding, 'DB');
  assert.equal(db.database_name, 'actero-staging-db', 'protected/unknown D1 target');
  assert.equal(db.migrations_dir, './migrations');
  if (template) {
    assert.equal(config.account_id, accountPlaceholder);
    assert.equal(db.database_id, databasePlaceholder);
  } else {
    assert.match(config.account_id, /^[0-9a-f]{32}$/i, 'a verified account ID is required');
    assert.match(db.database_id, uuid, 'a verified staging D1 UUID is required');
    assert.match(productionD1Id ?? '', uuid, 'independently verified production D1 UUID is required for comparison');
    assert.notEqual(db.database_id.toLowerCase(), productionD1Id.toLowerCase(), 'BLOCKED: staging binding points at production D1');
  }
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {values} = parseArgs({options: {template: {type: 'boolean'}, config: {type: 'string'}, 'production-d1-id': {type: 'string'}, 'require-ready': {type: 'boolean'}}});
  try {
    assert(values.config, '--config is required');
    assert(!(values.template && values['production-d1-id']), 'choose template check OR bound configuration check');
    validateConfig(JSON.parse(readFileSync(values.config, 'utf8')), {template: !!values.template, productionD1Id: values['production-d1-id'], requireReady: !!values['require-ready']});
    console.log(values.template ? 'PASS: unbound closed staging template; not ready for deployment.' :
      'PASS: closed staging file has different D1 IDs. Verify actual Dashboard bindings; this is not deployment approval.');
  } catch (error) {
    // Do not dump configuration values (a mistakenly added secret must not enter logs).
    console.error('BLOCKED: ' + (error.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : 'invalid/unreadable configuration'));
    process.exitCode = 1;
  }
}
