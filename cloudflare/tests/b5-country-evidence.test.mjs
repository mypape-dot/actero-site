import test from 'node:test';
import assert from 'node:assert/strict';
import {evidence,inspectCountries,formatSummary} from '../b5-country-evidence-local.mjs';

const allCodes=['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH'];
const required=['ES','DE','AT','FR','BE','NL','IE','CH'];
const entryByCode=new Map(evidence.countries.map(x=>[x.code,x]));

function fixture(){
 return 'function b5CountryConfig(){return {\n'+allCodes.map(code=>{
   const e=entryByCode.get(code);
   const bits=e?[e.source_token,...e.nuance_terms].join(' / '):'general country reference';
   return code+':{name:\''+code+'\',proof:\''+bits+'\',source:\''+bits+'\'},';
 }).join('\n')+'\n};}\n';
}

test('the eight countries have unique explicit source/risk entries without approval claims',()=>{
 assert.equal(evidence.sale_approval,'NO');
 assert.equal(evidence.countries.length,8);
 assert.deepEqual(evidence.countries.map(x=>x.code).sort(),required.sort());
 for(const e of evidence.countries){
   assert.match(e.source_url,/^https:\/\//);
   assert.ok(['DGP_COUNTRY_PDF_2022','FOREIGN_AUTHORITY_CONTEXT_ONLY'].includes(e.source_class));
   assert.ok(e.source_token && e.nuance_code && e.review_focus);
   assert.ok(e.nuance_terms.length>0);
 }
 assert.equal(evidence.countries.filter(x=>x.source_class==='DGP_COUNTRY_PDF_2022').length,4);
 assert.equal(evidence.countries.filter(x=>x.source_class==='FOREIGN_AUTHORITY_CONTEXT_ONLY').length,4);
});

test('scans each country block and returns source/keyword cues without guide text',()=>{
 const results=inspectCountries(fixture());
 assert.equal(results.length,8);
 assert.ok(results.every(x=>x.source_present&&x.nuance_present));
 assert.deepEqual(Object.keys(results[0]).sort(),['code','nuance_code','nuance_present','source_present'].sort());
});

test('missing official country token yields REVIEW, not false approval',()=>{
 const s=fixture().replaceAll('PDF-Franta.pdf','not-listed-here');
 const results=inspectCountries(s);
 assert.equal(results.find(x=>x.code==='FR').source_present,false);
 assert.equal(formatSummary(results),2);
});

test('missing a nuance stays advisory while official source still exists',()=>{
 const s=fixture().replaceAll('annex 19','pending verification');
 const results=inspectCountries(s);
 assert.equal(results.find(x=>x.code==='BE').nuance_present,false);
 assert.equal(results.find(x=>x.code==='BE').source_present,true);
 assert.equal(formatSummary(results),0);
});

test('a missing complete country entry cannot silently pass',()=>{
 const s=fixture().replace('CH:{name:', 'XX:{name:');
 const results=inspectCountries(s);
 assert.equal(results.find(x=>x.code==='CH').source_present,false);
 assert.equal(results.find(x=>x.code==='CH').nuance_present,false);
});
