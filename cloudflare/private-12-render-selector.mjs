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
 const expr=/(?:^|[\s;])(?:async\s+)?function\s+(showB[15][A-Za-z0-9_$]{1,70})\s*\(|(?:^|[\s;])(?:const|let|var)\s+(showB[15][A-Za-z0-9_$]{1,70})\s*=/gm;
 const names=[...script.matchAll(expr)].map(x=>x[1]||x[2]);
 return [...new Set(names)].sort().slice(0,12);
}
