import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_NOTES,prepareCountryRevision,validateExactRevision} from '../prepare-b5-country-review-local.mjs';

const countries=['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH'];
const tokens={ES:'PDF-Spania.pdf',IT:'PDF-Italia.pdf',DE:'PDF-Germania.pdf',
 AT:'PDF-Austria.pdf',FR:'PDF-Franta.pdf',GB:'PDF-Marea-Britanie.pdf',
 BE:'dofi.ibz.be',NL:'government.nl',IE:'irishimmigration.ie',CH:'sem.admin.ch'};
const sample='const b5CountryConfig=()=>({\n'+countries.map(c=>
 c+":{name:'"+c+"',proof:'Dovadă test "+c+" (d\\'après) '+ 'referință',source:'"+tokens[c]+"'},"
).join('\n')+'\n});';

test('adds exactly four sourced conditional notes without rewriting other country sections',()=>{
 const {revised,insertions}=prepareCountryRevision(sample);
 assert.deepEqual(insertions.map(x=>x.code),['FR','BE','NL','IE']);
 assert.equal(validateExactRevision(sample,revised),4);
 for(const c of countries)assert.ok(revised.includes("name:'"+c+"'"));
 for(const [c,note] of Object.entries(COUNTRY_NOTES)){
  assert.equal(revised.split(note).length,2,c+' note inserted exactly once');
  assert.ok(note.includes('consulat'),c);
 }
 assert.ok(revised.includes("proof:'Dovadă test ES"));
 assert.ok(revised.includes("proof:'Dovadă test CH"));
 assert.ok(revised.includes("d\\'après"));
});
test('refuses adding notes twice',()=>{
 const {revised}=prepareCountryRevision(sample);
 assert.throws(()=>prepareCountryRevision(revised),/already applied/);
});
test('refuses missing country or source anchor',()=>{
 assert.throws(()=>prepareCountryRevision(sample.replace("IE:{name:","XX:{name:")),/Country anchor/);
 assert.throws(()=>prepareCountryRevision(sample.replaceAll('PDF-Franta.pdf','bad-source')),/Wrong country source/);
});
test('rejects unintended changes even if notes are present',()=>{
 const {revised}=prepareCountryRevision(sample);
 assert.throws(()=>validateExactRevision(sample,revised.replace('Dovadă test ES','Dovadă compromisă')),/Unexpected edits/);
});
