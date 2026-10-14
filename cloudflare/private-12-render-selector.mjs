// Conservative selection of country-specific functions in private paid scripts.
// A missing/unrecognized entrypoint is REVIEW, never an invented PASS.
const COUNTRY_CODES=['FR','BE','NL','IE'];
const EXPECTED_MODES={B1:'FIRST_CRDS',B5_RENEWAL:'RENEWAL',B5_LOST:'LOST'};
export function rendererFor(guideKey,script){
  if(typeof script!=='string'||!script.trim())return {entrypoint:null,reason:'EMPTY_SCRIPT'};
  const match=/^(B1|B5_RENEWAL|B5_LOST)_(FR|BE|NL|IE)$/.exec(guideKey);
  if(!match)return {entrypoint:null,reason:'UNKNOWN_GUIDE'};
  const [,kind,country]=match;
  const names=[...script.matchAll(/(?:^|[\s;])(?:async\s+)?function\s+(show[A-Za-z0-9_$]*Guide)\s*\(/g)]
    .map(m=>m[1]);
  const unique=[...new Set(names)];
  let eligible=[];
  if(kind==='B1'){
    eligible=unique.filter(n=>n.startsWith('showB1')&&n.includes(country)&&/ValidatedGuide$|VariantGuide$/.test(n));
  }else{
    const mode=kind==='B5_LOST'?'LOST':'RENEWAL';
    eligible=unique.filter(n=>n.startsWith('showB5')&&new RegExp(mode,'i').test(n));
    const countrySpecific=eligible.filter(n=>n.toUpperCase().includes(country));
    if(countrySpecific.length)eligible=countrySpecific;
    else eligible=eligible.filter(n=>!COUNTRY_CODES.some(c=>n.toUpperCase().includes(c)));
  }
  if(eligible.length!==1)return {
    entrypoint:null,reason:eligible.length?'AMBIGUOUS_ENTRYPOINT':'NO_KNOWN_ENTRYPOINT',
    candidateCount:eligible.length
  };
  return {entrypoint:eligible[0],reason:null,mode:EXPECTED_MODES[kind],country};
}

// Function IDENTIFIERS only, never implementation text. Used for local debugging
// when a private B5 script has a generic renderer not covered by the allowlist.
export function diagnosticEntrypoints(script){
 if(typeof script!=='string')return [];
 // Identifiers are metadata only. Never emit function bodies or raw script text.
 const patterns=[
  /(?:^|[\s;])(?:async\s+)?function\s+([A-Za-z_$][\w$]{1,70})\s*\(/gm,
  /(?:^|[\s;])(?:const|let|var)\s+([A-Za-z_$][\w$]{1,70})\s*=\s*(?:async\s*)?(?:function\b|\([^)]{0,160}\)\s*=>)/gm,
  /(?:^|[\s;])(?:window|globalThis)\.([A-Za-z_$][\w$]{1,70})\s*=\s*(?:async\s*)?(?:function\b|\([^)]{0,160}\)\s*=>)/gm
 ];
 const result=[];
 for(const expr of patterns)for(const m of script.matchAll(expr))result.push(m[1]);
 return [...new Set(result)].sort().slice(0,20);
}
export function scriptShape(script){
 if(typeof script!=='string')return {functions:0,directDomWrite:false,windowAssignment:false,hasModuleExport:false};
 return {
  functions:diagnosticEntrypoints(script).length,
  directDomWrite:/(?:\.innerHTML\s*=|\.insertAdjacentHTML\s*\(|\.replaceChildren\s*\()/i.test(script),
  windowAssignment:/\bwindow\.[A-Za-z_$][\w$]{1,70}\s*=/.test(script),
  hasModuleExport:/\bexport\s+(?:default|function|const|let|class)\b/.test(script)
 };
}
