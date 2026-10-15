import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// b5-review-draft is a CLI validator requiring a generated private/synthetic file.
// The existing browser CI job generates its synthetic input and runs it separately.
const tests=readdirSync('cloudflare/tests').filter(name=>name.endsWith('.test.mjs')&&name!=='b5-review-draft.test.mjs').sort();
const result=spawnSync(process.execPath,['--test',...tests.map(name=>'cloudflare/tests/'+name)],{stdio:'inherit'});
process.exitCode=result.status??1;
