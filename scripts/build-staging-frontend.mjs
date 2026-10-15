import {readFileSync,mkdirSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {resolve,relative,dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {httpsOrigin,LEGACY} from '../cloudflare/environment.js';

const root=fileURLToPath(new URL('../',import.meta.url));
export function frontendFiles({origin,apiOrigin}){
  assert(httpsOrigin(origin) && origin!==LEGACY.origin,'Separate HTTPS frontend origin required');
  assert(httpsOrigin(apiOrigin) && apiOrigin!==origin && apiOrigin!=='https://actero.actedsro.workers.dev','Separate HTTPS staging API origin required');
  const files={};
  for(const name of ['index.html','confirmare.html','recuperare.html']){
    const source=readFileSync(resolve(root,name),'utf8');
    files[name]=source.replace(/<body([^>]*)>/,'<body$1><aside style="padding:12px;text-align:center;background:#fff3cd;color:#332701">STAGING — numai date sintetice. Nu folosi carduri reale.</aside>');
  }
  files['actero-config.js']='// Generated staging-only public config. No secrets. Checkout remains disabled.\n'+
    'window.ACTERO_PAYMENT_API='+JSON.stringify(apiOrigin)+';\nwindow.ACTERO_CHECKOUT_ENABLED=false;\n';
  files['_headers']='/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n';
  files['robots.txt']='User-agent: *\nDisallow: /\n';
  files['staging-build.json']=JSON.stringify({environment:'staging',origin,apiOrigin,checkoutEnabled:false,files:Object.keys(files)},null,2)+'\n';
  return files;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {values}=parseArgs({options:{origin:{type:'string'},'api-origin':{type:'string'},out:{type:'string'}}});
  assert(values.out,'--out is required; choose a NEW directory outside the repository');
  const files=frontendFiles({origin:values.origin,apiOrigin:values['api-origin']});
  const out=resolve(values.out);
  // Never copy the repository or overwrite another build. Resolve symlinks in the existing parent.
  assert(!existsSync(out),'Output already exists; choose a new directory, do not overwrite');
  const physical=resolve(realpathSync(dirname(out)),out.split('/').at(-1));
  const rel=relative(realpathSync(root),physical);
  assert(rel.startsWith('..'+(process.platform==='win32'?'\\':'/')) || isAbsolute(rel),'Output must be outside the repository');
  mkdirSync(out);
  for(const [name,contents] of Object.entries(files))writeFileSync(resolve(out,name),contents,{flag:'wx'});
  console.log('Prepared '+Object.keys(files).length+' allowlisted public files. No deploy; checkout disabled.');
}
