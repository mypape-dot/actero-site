// Diagnostic cues ONLY from customer-visible text rendered in an isolated,
// offline browser. Never print, save, transmit or export paid-guide content.
// A phrase's presence or absence NEVER constitutes Romanian consular approval.
const PATTERNS={
 FR:{
  CARTE_VITALE:/\bcarte\s+vitale\b/i,
  FRENCH_DRIVING_LICENCE:/\bpermis(?:ul)?\s+de\s+conducere\b/i,
  SUBSIDIARY_EVIDENCE:/\bsubsidiar(?:ă|e|a)?\b|\bîn\s+lipsa\s+documentelor\b/i,
  PREVIOUS_CRDS_CONDITION:/\b(?:deja|anterior|în\s+posesia|ați\s+mai\s+avut|aveți\s+deja)\b.{0,100}\bCRDS\b|\bCRDS\b.{0,100}\b(?:anterior|deja|existent)\b/i
 },
 BE:{
  ANNEX_19:/\banex(?:a|ă)\s*19\b|\bannexe?\s*19\b/i,
  APPLICATION_PENDING:/(?:cerere|solicitare|înregistrare).{0,85}(?:depusă|în\s+curs|în\s+analiză|nu\s+este\s+aprobată)|nu\s+(?:atestă|garantează).{0,75}aprob/i,
  ACCEPTANCE_CAUTION:/\b(?:consulat|DGP|autorită[țt]ile\s+române)\b.{0,150}\b(?:accept|verific|confirm)\w*/i
 },
 NL:{
  BSN:/\bBSN\b/i,
  RNI:/\bRNI\b/i,
  BRP:/\bBRP\b/i,
  RESIDENT_DISTINCTION:/\b(?:rezident|nerezident)\b.{0,120}\b(?:BRP|RNI|BSN)\b|\b(?:BRP|RNI|BSN)\b.{0,120}\b(?:rezident|nerezident)\b/i,
  IND_8004:/\b(?:IND\s*)?8004\b/i,
  PERMANENT_CONDITION:/(?:reziden[țt]ă|ședere)\s+permanentă|\b(?:cinci|5)\s+ani\b/i
 },
 IE:{
  PPS:/\bPPS(?:N)?\b/i,
  IRP:/\bIRP\b/i,
  EUTR2:/\bEUTR[\s-]?2\b/i,
  PPS_NOT_PROOF:/\bPPS(?:N)?\b.{0,120}\b(?:nu\s+(?:este|dovedește|atestă)|insuficient|singur)\b|\b(?:nu\s+(?:este|dovedește|atestă)|insuficient)\b.{0,120}\bPPS(?:N)?\b/i,
  EU_CITIZEN_DISTINCTION:/\b(?:cetățean|cetă[țt]eni)\b.{0,100}\b(?:UE|român)\b|\b(?:UE|român)\b.{0,100}\b(?:cetățean|cetă[țt]eni)\b/i,
  PERMANENT_CONDITION:/(?:reziden[țt]ă|ședere)\s+permanentă|\b(?:cinci|5)\s+ani\b/i
 }
};
const REVISIONS={
 FR:{key:'CARTE_VITALE',condition:'PREVIOUS_CRDS_CONDITION',risk:'REVIEW_FR_SUBSIDIARY_PROOF_SCOPE'},
 BE:{key:'ANNEX_19',condition:'APPLICATION_PENDING',risk:'REVIEW_BE_APPLICATION_NOT_APPROVED_STATUS'},
 NL:{key:'BSN',condition:'RESIDENT_DISTINCTION',risk:'REVIEW_NL_BSN_NOT_ADDRESS_PROOF'},
 IE:{key:'PPS',condition:'PPS_NOT_PROOF',risk:'REVIEW_IE_PPS_NOT_ADDRESS_PROOF'}
};
const KEYS=new Set(['FR','BE','NL','IE'].flatMap(c=>['B1_','B5_RENEWAL_','B5_LOST_'].map(p=>p+c)));
function detected(country,text){
 return Object.fromEntries(Object.entries(PATTERNS[country])
   .map(([name,re])=>[name,re.test(text)]));
}
// Regex word boundaries in JavaScript treat Romanian diacritics as non-word\n// characters. Avoid trailing ASCII boundaries on words ending with ă/ț/î.\n// Do not infer legal correctness from global keyword proximity. These markers
// ONLY tell a reviewer which passages to inspect privately in context.
export function assessRenderedGuide(key,text){
 if(typeof key!=='string'||!KEYS.has(key))throw Error('UNKNOWN_GUIDE_KEY');
 if(typeof text!=='string'||text.length>1_000_000)throw Error('INVALID_VISIBLE_TEXT');
 const country=key.slice(-2);
 const seen=detected(country,text);
 const signals=['HUMAN_LEGAL_REVIEW_REQUIRED'];
 if(text.trim().length<400)signals.push('REVIEW_RENDERED_GUIDE_EMPTY_OR_SHORT');
 const rule=REVISIONS[country];
 if(seen[rule.key]&&!seen[rule.condition])signals.push(rule.risk);
 if(country==='FR'&&key.startsWith('B1_')&&seen.CARTE_VITALE)
   signals.push('REVIEW_FR_FIRST_CRDS_CARTE_VITALE_IN_CONTEXT');
 if(country==='BE'&&seen.ANNEX_19&&!seen.ACCEPTANCE_CAUTION)
   signals.push('REVIEW_BE_CONSULAR_ACCEPTANCE_UNESTABLISHED');
 if(country==='NL'){
   if(seen.RNI&&!seen.RESIDENT_DISTINCTION)signals.push('REVIEW_NL_RNI_VS_RESIDENT');
   if(seen.IND_8004&&!seen.PERMANENT_CONDITION)signals.push('REVIEW_NL_IND8004_APPLICABILITY');
 }
 if(country==='IE'){
   if(seen.IRP&&!seen.EU_CITIZEN_DISTINCTION)signals.push('REVIEW_IE_IRP_EU_CITIZEN_EXCEPTION');
   if(seen.EUTR2&&!seen.PERMANENT_CONDITION)signals.push('REVIEW_IE_EUTR2_APPLICABILITY');
 }
 // Notice a technical source link or date without treating it as a verification.
 if(/\b(?:Procedură verificată|Surse reverificate)\b/i.test(text))
   signals.push('REVIEW_UNAPPROVED_PUBLIC_VERIFICATION_CLAIM');
 const scenario=key.startsWith('B1_')?'FIRST_CRDS':key.startsWith('B5_LOST_')?'LOST':'RENEWAL';
 const evidence={
  country,scenario,
  markers:Object.entries(seen).filter(([,exists])=>exists).map(([name])=>name),
  signals:[...new Set(signals)].sort(),
  editorial_clearance:'NO',
  consular_acceptance_verified:false
 };
 return evidence;
}
export function compareViewportSignals(desktop,mobile){
 const a=JSON.stringify(desktop?.markers||[]);
 const b=JSON.stringify(mobile?.markers||[]);
 const c=JSON.stringify(desktop?.signals||[]);
 const d=JSON.stringify(mobile?.signals||[]);
 return a===b&&c===d;
}
