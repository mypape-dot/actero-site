import {readFileSync,writeFileSync} from 'node:fs';
const page=new URL('../index.html',import.meta.url);
const source=readFileSync(new URL('../shared/eligibility.mjs',import.meta.url),'utf8');
const begin='// BEGIN GENERATED ELIGIBILITY — edit shared/eligibility.mjs, then run node scripts/sync-eligibility.mjs';
const end='// END GENERATED ELIGIBILITY';
const html=readFileSync(page,'utf8');
if(html.split(begin).length!==2||html.split(end).length!==2)throw Error('Eligibility markers missing or duplicated');
const generated=begin+'\n'+source.replace(/^export /gm,'').trimEnd()+'\n'+end;
const expected=html.slice(0,html.indexOf(begin))+generated+html.slice(html.indexOf(end)+end.length);
if(process.argv.includes('--check')){
  if(expected!==html)throw Error('Client/server eligibility drift: run node scripts/sync-eligibility.mjs');
  console.log('PASS: browser eligibility matches shared server module exactly');
}else writeFileSync(page,expected);
