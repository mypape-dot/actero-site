// Only CI synthetic fixtures should reach this test. Do not pass real D1 guide scripts into CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=process.argv[2];
assert.ok(file,'Expected local synthetic draft JSON path');
const rows=JSON.parse(readFileSync(file,'utf8'))[0].results;
test('draft preserves two matching guide keys, route and shared script',()=>{
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.guide_key).sort(),['B5_DAMAGED','B5_DATA_CHANGE']);
 assert.ok(rows.every(x=>x.route==='B5_EXISTING_CRDS'));
 assert.equal(rows[0].script_js,rows[1].script_js);
});
test('draft contains contextual UKVI eVisa and no misleading blanket review claims',()=>{
 const s=rows[0].script_js;
 assert.match(s,/statutul digital UKVI \(eVisa\)/);
 assert.match(s,/href="https:\/\/www.gov.uk\/evisa"/);
 assert.match(s,/share code permite verificarea statutului, dar nu este automat/);
 assert.match(s,/Cardurile BRP fizice au expirat/);
 assert.doesNotMatch(s,/5 octombrie 2026/);
 assert.doesNotMatch(s,/Procedură verificată/);
 assert.match(s,/cererile consulare CRDS, eConsulat indică 53 EUR/);
});
test('ten existing country-specific proof branches remain available',()=>{
 const s=rows[0].script_js;
 for(const country of ['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH'])
   assert.match(s,new RegExp('(?:^|\\s)'+country+':\\{name:'),country);
});
