import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {syntheticGuide} from '../tests/fixtures/synthetic-guide.mjs';
import {validateConfig} from './check-config.mjs';

export function syntheticSeed(){
  const sql=value=>"'"+value.replaceAll("'","''")+"'";
  const hash=createHash('sha256').update(syntheticGuide).digest('hex');
  return '-- SYNTHETIC STAGING ONLY. Never execute against production. No UPDATE or overwrite.\n'+
    'INSERT INTO guide_scripts(guide_key,route,title,script_js) VALUES(\'B1_ES\',\'B1_FIRST_CRDS\',\'SYNTHETIC TEST ONLY\','+sql(syntheticGuide)+');\n'+
    "INSERT INTO guide_approvals(guide_key,route,script_sha256,status,reviewer_reference,approved_at) VALUES('B1_ES','B1_FIRST_CRDS',"+sql(hash)+",'approved','synthetic-staging-only',datetime('now'));\n";
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {values}=parseArgs({options:{config:{type:'string'},'production-d1-id':{type:'string'},out:{type:'string'}}});
  assert(values.config && values.out,'--config and --out required');
  validateConfig(JSON.parse(readFileSync(values.config,'utf8')),{productionD1Id:values['production-d1-id'],requireReady:true});
  writeFileSync(values.out,syntheticSeed(),{flag:'wx'});
  console.log('Generated SQL locally for ONE synthetic guide; no D1 connection or execution.');
}
