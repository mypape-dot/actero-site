// Verify a public, source-linked manual review matrix; no private scripts are imported.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const dir=new URL('../',import.meta.url);
const matrix=JSON.parse(readFileSync(new URL('four-country-b1-b5-editorial-matrix.json',dir)));
const catalog=JSON.parse(readFileSync(new URL('guide-catalog.json',dir)));
const tracker=readFileSync(new URL('guide-review-tracker.csv',dir),'utf8')
  .split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('#'));
const heading=tracker[0].split(',');
const tracked=new Map(tracker.slice(1).map(line=>{
 const row=Object.fromEntries(heading.map((k,i)=>[k,line.split(',')[i]]));
 return [row.guide_key,row];
}));
const expectedCountries=['FR','BE','NL','IE'];
const scenarios=[
 {prefix:'B1_',route:'B1_FIRST_CRDS',scenario:'first_crds'},
 {prefix:'B5_RENEWAL_',route:'B5_EXISTING_CRDS',scenario:'renewal'},
 {prefix:'B5_LOST_',route:'B5_EXISTING_CRDS',scenario:'lost'}
];
test('four-country independent review matrix maps exactly to 12 catalog keys',()=>{
 assert.equal(matrix.sale_approved,false);
 assert.equal(matrix.guide_checks.length,12);
 const expected=new Set(expectedCountries.flatMap(c=>scenarios.map(s=>s.prefix+c)));
 const actual=new Set(matrix.guide_checks.map(x=>x.guide_key));
 assert.equal(actual.size,12);
 assert.deepEqual(actual,expected);
 for(const row of matrix.guide_checks){
  const guide=catalog.guides.find(g=>g.key===row.guide_key);
  assert.ok(guide,'Unknown guide: '+row.guide_key);
  assert.equal(guide.route,row.route);
  assert.equal(guide.country,row.country);
  assert.equal(guide.scenario,row.scenario);
  assert.equal(row.editorial_clearance,'NO');
  assert.equal(row.consular_acceptance_confirmed,false);
  assert.equal(tracked.get(row.guide_key)?.sale_approved,'NO');
  assert.ok(row.review_questions.length>=3);
  const country=matrix.countries[row.country];
  assert.ok(country,'Missing country policy');
  assert.deepEqual(row.official_country_evidence,country.sources.map(s=>s.url));
  assert.ok(country.sources.some(s=>s.url.includes('pasapoarte.mai.gov.ro')));
  // France has a Romanian government country-specific evidence PDF.
  // For BE/NL/IE, foreign government sources establish local document meaning,
  // not Romanian acceptance; the Romanian DGP general rule is still required.
  if(row.country==='FR')
    assert.ok(country.sources.some(s=>s.kind==='DGP_COUNTRY_PDF_2022'));
  else
    assert.ok(country.sources.some(s=>!s.url.includes('pasapoarte.mai.gov.ro')));
 }
});
test('source categories distinguish foreign status from Romanian consular acceptance',()=>{
 assert.match(matrix.countries.FR.review_focus,/doar unui titular.*CRDS/);
 assert.ok(matrix.countries.FR.sources.some(s=>s.kind==='DGP_COUNTRY_PDF_2022'));
 assert.match(matrix.countries.BE.review_focus,/Anexa 19/);
 assert.match(matrix.countries.NL.review_focus,/RNI/);
 assert.match(matrix.countries.IE.review_focus,/PPS/);
 for(const [code,info] of Object.entries(matrix.countries)){
  assert.ok(expectedCountries.includes(code));
  assert.ok(info.sources.every(s=>/^https:\/\//.test(s.url)&&s.caveat?.length>20));
  assert.ok(info.conditions.length>=2);
 }
});
