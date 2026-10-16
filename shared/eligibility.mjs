// Canonical pure rules ported from PR #17 (98698b0); no browser, D1 or network dependencies.
// LEGAL-UNVERIFIED: BE/NL/IE evidence lists, the French remedy and travel-card assumptions require human review.
export function docState(v){return v==='VALID'||v==='EXPIRING'?'VALID':['EXPIRED','LOST','STOLEN','DAMAGED','MISSING'].includes(v)?'INVALID':'UNKNOWN'}

export function docValid(v){return docState(v)==='VALID'}

export function domicileOf(a){a=a||{};if(a.passport_domicile==='ROMANIA')return'ROMANIA';if(['CURRENT','OTHER'].includes(a.passport_domicile))return'ABROAD';if(a.ever_crds==='YES')return'ABROAD';if(a.ever_crds==='NO')return'ROMANIA';return'UNKNOWN'}

export function hasRomanianIdentityHistoryOf(a){const d=(a&&a.documents)||[];return d.some(x=>['ROMANIAN_ID','PASSPORT','CRDS_PASSPORT','CEI'].includes(x))}

export function crdsStatusOf(a,docs){docs=docs||{};return docs.CRDS_PASSPORT||(domicileOf(a)==='ABROAD'?docs.PASSPORT:null)||null}

export function travelCardOf(a,docs){a=a||{};docs=docs||{};
 if(docValid(docs.CEI))return'TRAVEL';
 if(!docValid(docs.ROMANIAN_ID))return'NONE';
 const t=a.id_card_type;return t==='OLD_MODEL'||t==='CEI'?'TRAVEL':(t===undefined||t==='UNKNOWN')?'UNKNOWN':'NONE'}

export function localProofRule(c){return ({
 BE:{name:'Belgia',accepted:['EU_CARD','PERMANENT','CITIZEN'],opts:[
   {value:'EU_CARD',label:'Cardul EU sau vechiul card E',sub:'Documentul de ședere pentru cetățenii UE, primit după decizia privind dreptul de ședere.'},
   {value:'PERMANENT',label:'Cardul EU+ sau vechiul card E+',sub:'Ședere permanentă.'},
   {value:'ANNEX19',label:'Doar Anexa 19',sub:'Dovada că ai depus cererea de înregistrare la comună.'},
   {value:'CITIZEN',label:'Am cetățenia belgiană'},
   {value:'OTHER',label:'Alt document'},
   {value:'UNKNOWN',label:'Nu sunt sigur'}]},
 NL:{name:'Țările de Jos',accepted:['PERMANENT','CITIZEN'],opts:[
   {value:'PERMANENT',label:'Document de ședere permanentă de la IND',sub:'„Duurzaam verblijf”, de regulă după cel puțin 5 ani.'},
   {value:'BRP',label:'Extras din registrul BRP',sub:'Înregistrarea ca rezident la municipalitate.'},
   {value:'BSN',label:'Doar numărul BSN sau înscrierea RNI'},
   {value:'CITIZEN',label:'Am cetățenia olandeză'},
   {value:'OTHER',label:'Alt document'},
   {value:'UNKNOWN',label:'Nu sunt sigur'}]},
 IE:{name:'Irlanda',accepted:['PERMANENT','CITIZEN'],opts:[
   {value:'PERMANENT',label:'Certificat de rezidență permanentă',sub:'Pentru cetățenii UE, de regulă după cel puțin 5 ani.'},
   {value:'CITIZEN',label:'Am cetățenia irlandeză'},
   {value:'UNDER5',label:'Nu am niciunul dintre acestea',sub:'De exemplu, locuiesc în Irlanda de mai puțin de 5 ani.'},
   {value:'UNKNOWN',label:'Nu sunt sigur'}]}
})[c]||null}

export function needsLocalProof(a,route){a=a||{};return !!localProofRule(a.residence_country)&&!(route==='B1_FIRST_CRDS'&&a.foreign_basis==='CITIZEN')}

export function identityOf(a,docs,route){a=a||{};const statuses=Object.values(docs||{});if(route==='D2_PERMANENT_RETURN'&&['VALID','EXPIRED','EXPIRING'].includes(crdsStatusOf(a,docs)))return'PASS';if(statuses.some(docValid))return'PASS';if(a.identity_detail==='HAS_PHOTO_DOC')return'REVIEW_KNOWN';if(a.identity_detail==='NO_PHOTO_DOC')return'OFFICIAL_CHECK_KNOWN';if(a.identity_detail==='UNKNOWN')return'UNKNOWN';if(statuses.some(v=>['EXPIRED','LOST','STOLEN','DAMAGED'].includes(v)))return'REVIEW';return'UNKNOWN'}

export function evaluateCase(input){
 const a=(input&&input.answers)||{},docs=(input&&input.docs)||{},r=(input&&input.route)||null,dom=domicileOf(a);
 const blockers=[],unknowns=[],notes=[];let status='GREEN';
 function block(code,t){blockers.push({code,text:t});if(status!=='YELLOW_U')status='YELLOW_R'}
 function unknown(t){unknowns.push(t);status='YELLOW_U'}
 function note(code,t){notes.push({code,text:t})}
 if(!r){unknown('Nu am putut stabili încă procedura potrivită.');return {blockers,unknowns,notes,status}}
 if(dom==='UNKNOWN' && !['TRAVEL_TITLE_RETURN_RO','URGENT_OTHER_COUNTRY'].includes(r))unknown('Domiciliul oficial trebuie clarificat înainte de a confirma procedura.');
 const lp=localProofRule(a.residence_country);
 // Belgium, the Netherlands, Ireland (decision of 15.10): pay only with a local document tied to the DGP criterion.
 function localProof(){if(!lp)return;const v=a.local_proof_type;
   if(!v||v==='UNKNOWN')unknown(`Trebuie clarificat ce document oficial ai din ${lp.name}.`);
   else if(!lp.accepted.includes(v))block('LOCAL_PROOF_UNCONFIRMED',`Nu putem confirma că documentul tău din ${lp.name} este acceptat pentru pașaportul cu domiciliul în străinătate.`)}
 function swissCurrent(){if(a.residence_country!=='CH')return;
   if(a.swiss_current_permit==='G')unknown('Permisul G indică faptul că domiciliul principal este într-un alt stat, nu în Elveția.');
   if(!a.swiss_current_permit||a.swiss_current_permit==='UNKNOWN'||a.swiss_current_permit==='OTHER')unknown('Trebuie clarificat tipul documentului actual din Elveția.')}
 if(r==='B1_FIRST_CRDS'){
   // M-10: without a foreign document there is nothing to classify; say what is missing instead of asking for its type.
   if(a.foreign_proof==='NO')block('FOREIGN_PROOF_MISSING','Nu ai confirmat încă o dovadă pentru situația ta de ședere în străinătate.');
   else if(a.foreign_proof==='UNKNOWN'||!a.foreign_proof)unknown('Trebuie clarificat documentul care dovedește situația ta în țara de rezidență.');
   else if(!a.foreign_basis||a.foreign_basis==='UNKNOWN')unknown('Trebuie clarificată baza pentru domiciliul în străinătate.');
   else if(a.foreign_basis==='UNCLASSIFIED_DOCUMENT')unknown('Ai un document relevant, dar trebuie identificat tipul exact înainte de confirmarea procedurii.');
   if(a.foreign_proof==='YES'&&a.foreign_basis!=='CITIZEN')localProof();
   if(a.birth_cert==='PLASTIFIED')block('BIRTH_CERT_PLASTIFIED','Certificatul de naștere este plastifiat și trebuie rezolvat înainte de procedură.');
   if(a.birth_cert==='MISSING')block('BIRTH_CERT_MISSING','Certificatul de naștere lipsește și trebuie rezolvat înainte de procedură.');
   if(a.birth_cert==='UNKNOWN'||!a.birth_cert)unknown('Trebuie clarificată situația certificatului de naștere.');
   if(a.residence_country==='CH'&&a.foreign_basis!=='CITIZEN'&&a.foreign_proof==='YES'){ // R15: the permit type only matters for a declared document
     if(a.swiss_permit==='G')unknown('Permisul G indică faptul că domiciliul principal este în alt stat, nu în Elveția.');
     if(!a.swiss_permit||a.swiss_permit==='UNKNOWN'||a.swiss_permit==='OTHER')unknown('Trebuie clarificat tipul documentului elvețian înainte să confirmăm ghidul pentru domiciliu în Elveția.');
   }
   // Decision 2 (16.10), safety net behind Q012: a foreign domicile moved back to Romania is not a first CRDS until DGP confirms it.
   if(a.crds_history==='RETURNED')block('CRDS_RETURNED_TO_RO','Ai avut deja domiciliul în străinătate și l-ai mutat înapoi în România; procedura pentru un nou domiciliu în străinătate trebuie confirmată de DGP.');
 }
 if(r==='B5_EXISTING_CRDS'){
   const replaced=['RENEWAL','LOST','STOLEN','DAMAGED','DATA_CHANGE'].includes(a.b5case);
   if(a.b5case==='STOLEN'&&a.theft_proof==='NO')block('THEFT_PROOF_MISSING','Trebuie rezolvată dovada privind furtul pașaportului.');
   if(a.b5case==='STOLEN'&&(a.theft_proof==='UNKNOWN'||!a.theft_proof))unknown('Trebuie clarificată dovada privind furtul pașaportului.');
   if(replaced&&(a.same_country==='UNKNOWN'||!a.same_country))unknown('Trebuie clarificat dacă locuiești în aceeași țară trecută în pașaport.');
   if(replaced&&a.same_country==='YES'&&a.current_foreign_proof==='NO')block('CURRENT_PROOF_MISSING','Trebuie o dovadă actuală pentru situația ta în țara de domiciliu.');
   if(replaced&&a.same_country==='YES'&&(a.current_foreign_proof==='UNKNOWN'||!a.current_foreign_proof))unknown('Trebuie clarificată dovada actuală pentru domiciliul din străinătate.');
   if(replaced&&a.same_country==='YES'&&a.current_foreign_proof==='YES'){swissCurrent();localProof()}
   if(a.same_country==='NO'&&a.foreign_proof==='NO')block('NEW_COUNTRY_PROOF_MISSING','Trebuie o dovadă relevantă pentru țara în care locuiești acum.');
   if(a.same_country==='NO'&&(a.foreign_proof==='UNKNOWN'||!a.foreign_proof))unknown('Trebuie clarificat documentul de rezidență pentru noua țară.');
   if(a.same_country==='NO'&&a.foreign_proof==='YES'){swissCurrent();localProof()} // M-09: a move to Switzerland needs the same permit check
 }
 if(['A1_PERSONAL_ROMANIA','A2_PROXY','A3_FIRST_ID_CONSULAR','D2_PERMANENT_RETURN','C1_CEI_ROMANIA','C5_CEI_REPLACEMENT'].includes(r)){
   if(a.ro_address==='NONE'||a.ro_address==='PROOF_MISSING')block('RO_ADDRESS_NOT_READY','Adresa din România nu este încă pregătită pentru procedură.');
   if(a.ro_address==='UNKNOWN'||!a.ro_address)unknown('Trebuie clarificată adresa din România.');
   if(a.ro_address==='HOST'&&a.host_consent==='NO')block('HOST_REFUSES','Persoana care te primește în spațiu nu și-a confirmat consimțământul.');
   if(a.ro_address==='HOST'&&(a.host_consent==='UNKNOWN'||!a.host_consent))unknown('Trebuie clarificat consimțământul persoanei care te primește în spațiu.');
 }
 // GN-03 (decision 4, 16.10; made symmetric 16.10 PM): the document list for a FIRST Romanian identity
 // document (no prior carte de identitate / CEI) is not verified individually for our guide, whether
 // citizenship is held from birth or was acquired/reacquired. Conservative and symmetric: explain for
 // free, never sell, until the list is verified. A Romanian passport does not establish the ID-card list,
 // so it does not lift the block; a prior ID card / CEI does, because that is a renewal, not a first ID.
 if(['A1_PERSONAL_ROMANIA','A3_FIRST_ID_CONSULAR','C1_CEI_ROMANIA'].includes(r)&&!(a.documents||[]).some(x=>['ROMANIAN_ID','CEI'].includes(x)))
   block('FIRST_ID_LIST_UNVERIFIED','Este primul tău act de identitate românesc; lista de documente pentru acest caz nu este verificată separat în ghidul nostru.');
 if(r==='A2_PROXY'){
   if(a.representative==='NO')block('NO_REPRESENTATIVE','Nu ai încă o persoană în România pe care să o împuternicești.');
   if(a.representative==='UNKNOWN'||!a.representative)unknown('Trebuie clarificat dacă ai un reprezentant în România.');
   if(a.representative==='YES'){
     if(a.poa==='NO')block('NO_POA','Procura necesară nu poate fi pregătită momentan.');
     if(a.poa==='UNKNOWN'||!a.poa)unknown('Trebuie clarificată procura pentru reprezentant.');
   }
 }
 if(r==='C2_CEI_CONSULAR'||r==='C3_CEI_NO_RO_DOMICILE')block('CEI_NOT_OPERATIONAL','Disponibilitatea acestei etape trebuie verificată înainte de a confirma procedura.');
 if(r==='D1_TEMPORARY'){
   if(a.d1_crds==='EXPIRED'||a.d1_crds==='LOST')block('CRDS_NOT_VALID','Pașaportul cu domiciliul în străinătate nu este în starea necesară pentru această procedură.');
   if(a.d1_crds==='UNKNOWN'||!a.d1_crds)unknown('Trebuie clarificată valabilitatea pașaportului cu domiciliul în străinătate.');
   if(a.ro_residence==='NONE'||a.ro_residence==='PROOF_MISSING')block('RO_RESIDENCE_NOT_READY','Reședința din România nu este încă pregătită.');
   if(a.ro_residence==='UNKNOWN'||!a.ro_residence)unknown('Trebuie clarificată adresa unde vei locui în România.');
   if(['OWN','HOST'].includes(a.ro_residence)&&a.ro_residence_proof==='NO')block('RO_RESIDENCE_PROOF_MISSING','Trebuie pregătită dovada adresei de reședință din România.');
   if(['OWN','HOST'].includes(a.ro_residence)&&(a.ro_residence_proof==='UNKNOWN'||!a.ro_residence_proof))unknown('Trebuie clarificat documentul cu care vei dovedi adresa de reședință.');
 }
 if(r==='B1_FIRST_CRDS'&&a.citizenship_cert_required==='POSSIBLE')unknown('Trebuie clarificat dacă ai avut un pașaport sau act de identitate românesc după dobândirea/redobândirea cetățeniei ori să ai certificatul sau cardul de cetățenie disponibil.');
 if(r==='B1_FIRST_CRDS'&&a.citizenship_cert_required==='YES'){if(a.citizenship_cert_available==='NO')block('CITIZENSHIP_CERT_MISSING','Lipsește certificatul sau cardul de cetățenie română necesar pentru acest caz.');if(a.citizenship_cert_available==='UNKNOWN'||!a.citizenship_cert_available)unknown('Trebuie clarificată disponibilitatea certificatului sau cardului de cetățenie română.');}
 if(a.civil_change==='UNKNOWN')unknown('Trebuie clarificat dacă au existat schimbări de nume sau stare civilă.');
 if(a.civil_change && !['NO','UNKNOWN'].includes(a.civil_change)){
   if(a.civil_sync==='NO')block('CIVIL_NOT_TRANSCRIBED','Schimbarea de nume sau stare civilă nu este încă înregistrată în actele românești.');
   if(a.civil_sync==='UNKNOWN'||!a.civil_sync)unknown('Trebuie clarificat dacă schimbarea este înregistrată în România.');
 }
 if(r==='TRAVEL_TITLE_RETURN_RO'){
   const hasAnyIdentityClue=!!a.identity_detail||hasRomanianIdentityHistoryOf(a)||(a.documents||[]).some(x=>['BIRTH_CERT','MARRIAGE_CERT','CITIZENSHIP_CERT'].includes(x));
   if(!hasAnyIdentityClue)unknown('Trebuie clarificat ce documente românești ai pentru verificarea identității.');
   else note('TRAVEL_TITLE_IDENTITY','Identitatea va fi verificată oficial în cadrul procedurii, pe baza documentelor disponibile și a verificărilor consulare.'); // M-12
 }
 if(r==='URGENT_OTHER_COUNTRY'){
   const ub=a.travel_urgent_basis;
   if(!ub||ub==='UNKNOWN')unknown('Trebuie clarificat motivul obiectiv și urgent al călătoriei.');
   if(ub==='TOURISM')block('TOURISM_ONLY','Pașaportul simplu temporar nu se eliberează pentru o deplasare bazată exclusiv pe motive turistice.');
   if(['CONTINUE_JOURNEY','OBJECTIVE_URGENT','PASSPORT_AT_VISA'].includes(ub)&&dom==='UNKNOWN')unknown('Domiciliul oficial trebuie clarificat pentru a alege lista corectă de documente a pașaportului temporar.');
 }
 if(r==='TRAVEL_TITLE_RETURN_RO'||r==='URGENT_OTHER_COUNTRY'){
   const toRo=r==='TRAVEL_TITLE_RETURN_RO',card=travelCardOf(a,docs);
   if(!toRo&&a.physical==='YES')block('TEMP_PASSPORT_FROM_ROMANIA','Pașaportul temporar cerut din România se depune la serviciul de pașapoarte, iar ghidul nostru acoperă cererea din străinătate.'); // M-05
   else if(docValid(docs.PASSPORT)||docValid(docs.CRDS_PASSPORT))block(toRo?'PASSPORT_STILL_VALID':'PASSPORT_EXPIRING_OTHER_DEST','Pașaportul tău este încă valabil.'); // M-04, decision 3
   else if(card==='UNKNOWN')unknown('Trebuie clarificat ce tip de carte de identitate ai.');
   else if(card==='TRAVEL'){
     const area=a.id_card_area;
     if(!area||area==='UNKNOWN')unknown('Trebuie clarificat dacă poți călători cu cartea de identitate.');
     else if(area==='YES')block(toRo?'ID_CARD_IS_TRAVEL_DOC':'ID_CARD_IS_TRAVEL_DOC_OTHER','Cartea ta de identitate este document de călătorie pentru acest drum.');
     else if(area==='UK'&&toRo)block('ID_CARD_UK_CHECK','Din Regatul Unit trebuie verificat dacă poți călători doar cu cartea de identitate.');
   }
 }
 const idState=identityOf(a,docs,r);
 if(['A1_PERSONAL_ROMANIA','A2_PROXY','B1_FIRST_CRDS','B5_EXISTING_CRDS','C1_CEI_ROMANIA','C5_CEI_REPLACEMENT','D2_PERMANENT_RETURN'].includes(r)){
   if(idState==='UNKNOWN')unknown('Trebuie clarificat cu ce documente poate fi stabilită identitatea.');
   if(idState==='REVIEW')unknown('Actele disponibile nu sunt valabile în prezent; trebuie clarificat ce document vechi sau expirat ai fizic la tine.');
   // Decision of 15.10: an old or expired photo document is a normal case with a note, not a blocker.
   if(idState==='REVIEW_KNOWN')note('IDENTITY_OLD_DOC','Ai un act românesc vechi sau expirat cu fotografie; ia-l cu tine la depunere, pentru verificarea identității.');
   if(idState==='OFFICIAL_CHECK_KNOWN')block('NO_PHOTO_ID','Nu ai confirmat un document românesc cu fotografie disponibil; ghidul trebuie să includă mai întâi verificarea oficială a identității.');
 }
 return {blockers,unknowns,notes,status}
}

export function contradictionsOf(input){
 const a=(input&&input.answers)||{},docs=(input&&input.docs)||{},r=input&&input.route,out=[],declared=a.documents||[];
 const add=(code,fix)=>{if(!out.some(x=>x.code===code))out.push({code,fix})};
 if(r==='B5_EXISTING_CRDS'){
   if(a.passport_domicile==='ROMANIA')add('LATEST_PASSPORT_ROMANIA','Q007');
   if((a.passport_domicile==='CURRENT'&&a.same_country==='NO')||(a.passport_domicile==='OTHER'&&a.same_country==='YES'))add('PASSPORT_COUNTRY_MISMATCH','Q007');
   if(docValid(crdsStatusOf(a,docs))&&['LOST','STOLEN'].includes(a.b5case))add('VALID_PASSPORT_LOST','Q120');
 }
 if(declared.includes('CRDS_PASSPORT')&&a.ever_crds==='NO')add('CRDS_DOC_BUT_NEVER',['TRAVEL_TITLE_RETURN_RO','URGENT_OTHER_COUNTRY'].includes(r)?'Q032':'Q008');
 return out}

export function remedyInGuide(code,key,a){a=a||{};
 if(code==='THEFT_PROOF_MISSING')return key==='B5_STOLEN';
 // LEGAL-UNVERIFIED (needs Romanian consular confirmation): the French "alternative documents" route is
 // asserted without a cited official source; paymentDecisionFor marks such cases legalBasisConfirmed=false.
 if(code==='CURRENT_PROOF_MISSING')return a.residence_country==='FR'&&['B5_RENEWAL_FR','B5_LOST_FR','B5_STOLEN'].includes(key);
 return false}

export function validatedGuideFor(route,a,dom){
  a=a||{};const c=a.residence_country;
  if(route==='B1_FIRST_CRDS'){
    if(['ES','IT','DE','AT','FR','GB','BE','NL','IE'].includes(c))return true;
    if(c==='CH'){
      if(a.foreign_basis==='CITIZEN')return true;
      return ['B','C','L'].includes(a.swiss_permit);
    }
    return false;
  }
  if(route==='B5_EXISTING_CRDS'&&a.b5case==='RENEWAL'&&a.same_country==='YES'){
    if(['ES','IT','DE','AT','FR','GB','BE','NL','IE'].includes(c))return true;
    if(c==='CH')return ['B','C','L','SWISS_CITIZEN'].includes(a.swiss_current_permit);
  }
  if(route==='B5_EXISTING_CRDS'&&a.b5case==='LOST'&&a.same_country==='YES'){
    if(['ES','IT','DE','AT','FR','GB','BE','NL','IE'].includes(c))return true;
    if(c==='CH')return ['B','C','L','SWISS_CITIZEN'].includes(a.swiss_current_permit);
  }
  if(route==='B5_EXISTING_CRDS'&&a.b5case==='STOLEN'&&a.same_country==='YES'){
    if(['ES','IT','DE','AT','FR','GB','BE','NL','IE'].includes(c))return true;
    if(c==='CH')return ['B','C','L','SWISS_CITIZEN'].includes(a.swiss_current_permit);
  }
  if(route==='B5_EXISTING_CRDS'&&['DAMAGED','DATA_CHANGE'].includes(a.b5case)&&a.same_country==='YES'){
    if(['ES','IT','DE','AT','FR','GB','BE','NL','IE'].includes(c))return true;
    if(c==='CH')return ['B','C','L','SWISS_CITIZEN'].includes(a.swiss_current_permit);
  }
  if(route==='B5_EXISTING_CRDS'&&a.same_country==='NO'&&a.foreign_proof==='YES'&&['RENEWAL','LOST','STOLEN','DAMAGED','DATA_CHANGE','COUNTRY_CHANGE'].includes(a.b5case)){
    if(['ES','IT','DE','AT','FR','GB','BE','NL','IE'].includes(c))return true;
    if(c==='CH')return ['B','C','L','SWISS_CITIZEN'].includes(a.swiss_current_permit);
  }
  if(['A1_PERSONAL_ROMANIA','A2_PROXY','A3_FIRST_ID_CONSULAR','C1_CEI_ROMANIA','C5_CEI_REPLACEMENT','D1_TEMPORARY','D2_PERMANENT_RETURN','TRAVEL_TITLE_RETURN_RO'].includes(route))return true;
  if(route==='URGENT_OTHER_COUNTRY'&&['CONTINUE_JOURNEY','OBJECTIVE_URGENT','PASSPORT_AT_VISA'].includes(a.travel_urgent_basis)&&dom!=='UNKNOWN')return true;
  return false;
}

export function guideKeyFor(route,a){
  a=a||{};const c=a.residence_country;
  if(route==='B1_FIRST_CRDS')return ['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH'].includes(c)?'B1_'+c:null;
  if(route==='B5_EXISTING_CRDS'){
    if(a.same_country==='NO')return 'B5_MOVED';
    if(a.same_country!=='YES')return null;
    if(a.b5case==='STOLEN')return 'B5_STOLEN';
    if(a.b5case==='DAMAGED')return 'B5_DAMAGED';
    if(a.b5case==='DATA_CHANGE')return 'B5_DATA_CHANGE';
    if(a.b5case==='RENEWAL'||a.b5case==='LOST')return ['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH'].includes(c)?'B5_'+a.b5case+'_'+c:null;
    return null;
  }
  return ['A1_PERSONAL_ROMANIA','A2_PROXY','A3_FIRST_ID_CONSULAR','C1_CEI_ROMANIA','C5_CEI_REPLACEMENT','D1_TEMPORARY','D2_PERMANENT_RETURN','TRAVEL_TITLE_RETURN_RO','URGENT_OTHER_COUNTRY'].includes(route)?route:null;
}

export function paymentDecisionFor(input){
 const a=(input&&input.answers)||{},r=(input&&input.route)||null,dom=domicileOf(a);
 const ev=evaluateCase(input),contra=contradictionsOf(input);
 const routeResolved=!!r&&(dom!=='UNKNOWN'||['TRAVEL_TITLE_RETURN_RO','URGENT_OTHER_COUNTRY'].includes(r));
 const key=guideKeyFor(r,a),validated=!!key&&validatedGuideFor(r,a,dom);
 const remedied=ev.blockers.filter(b=>remedyInGuide(b.code,key,a)),unremedied=ev.blockers.filter(b=>!remedyInGuide(b.code,key,a));
 const allowed=routeResolved&&validated&&!contra.length&&!ev.unknowns.length&&!unremedied.length;
 const legalBasisConfirmed=!(
   (['BE','NL','IE'].includes(a.residence_country)&&['B1_FIRST_CRDS','B5_EXISTING_CRDS'].includes(r))||
   (a.residence_country==='FR'&&remedied.some(b=>b.code==='CURRENT_PROOF_MISSING'))
 );
 return {allowed,key,route:r,validated,legalBasisConfirmed,routeResolved,unknowns:ev.unknowns,contradictions:contra,unremedied,remedied,notes:ev.notes,status:ev.status}}

// The historical predicate above remains usable for partial diagnostic evaluations.
// Only this complete-case boundary may authorize a checkout. Browser route/status,
// allowed, key and legal confirmation are never inputs to the rule calculation.
export function eligibilityAnswerEnums(){
 const yn=['YES','NO','UNKNOWN'];
 return {
  age:yn,citizenship:['YES','REACQUIRED','NO','UNKNOWN'],
  residence_country:['ES','IT','DE','AT','FR','GB','BE','NL','IE','CH','OTHER'],
  goal:['ID_PROBLEM','ESTABLISH_FOREIGN_DOMICILE','EXISTING_CRDS_PROBLEM','CEI','KEEP_FOREIGN_DOMICILE','MOVE_DOMICILE_TO_RO','URGENT_TRAVEL','UNKNOWN'],
  passport_domicile:['ROMANIA','CURRENT','OTHER','UNKNOWN'],ever_crds:yn,
  goal_conflict:['RENEW','WRONG','UNKNOWN'],crds_clarify:['CRDS','LOCAL_RESIDENCE','UNKNOWN'],
  crds_history:['RETURNED','WRONG','NEVER','UNKNOWN'],crds_confirm:['HAD_CRDS','NEVER','UNKNOWN'],
  physical:yn,can_come:['YES','NO','NOT_SOON','UNKNOWN'],domicile_intent:['KEEP','MOVE','UNKNOWN'],
  foreign_basis:['RESIDENCE','PERMANENT','EU','WORK','STUDY','FAMILY','CITIZEN','UNCLASSIFIED_DOCUMENT','UNKNOWN'],
  foreign_proof:yn,foreign_document_generic:yn,current_foreign_proof:yn,
  birth_cert:['READY','PLASTIFIED','MISSING','UNKNOWN'],
  swiss_permit:['B','C','L','G','OTHER','UNKNOWN'],swiss_current_permit:['B','C','L','G','SWISS_CITIZEN','OTHER','UNKNOWN'],
  local_proof_type:['EU_CARD','PERMANENT','CITIZEN','ANNEX19','BRP','BSN','UNDER5','OTHER','UNKNOWN'],
  post_citizenship_romanian_id:yn,citizenship_cert_available:yn,
  b5case:['RENEWAL','LOST','STOLEN','DAMAGED','DATA_CHANGE','COUNTRY_CHANGE','MOVE_RO','UNKNOWN'],same_country:yn,theft_proof:yn,
  ro_address:['OWN','HOST','PROOF_MISSING','NONE','UNKNOWN'],host_consent:yn,representative:yn,poa:yn,
  d1_crds:['VALID','EXPIRED','LOST','UNKNOWN'],ro_residence:['OWN','HOST','PROOF_MISSING','NONE','UNKNOWN'],ro_residence_proof:yn,dependents:yn,
  civil_change:['NO','MARRIAGE','DIVORCE','NAME','OTHER','UNKNOWN'],civil_sync:yn,
  identity_detail:['HAS_PHOTO_DOC','NO_PHOTO_DOC','UNKNOWN'],
  travel_dest:['ROMANIA','OTHER','NONE','UNKNOWN'],travel_urgent_basis:['CONTINUE_JOURNEY','OBJECTIVE_URGENT','PASSPORT_AT_VISA','TOURISM','UNKNOWN'],
  id_card_type:['OLD_MODEL','CEI','CIS','CIP','UNKNOWN'],id_card_area:['YES','NO','UK','UNKNOWN']
 };
}

export function routeFromAnswers(a,docs){
 const dom=domicileOf(a),g=a.goal,selected=a.documents||[];
 if(g==='URGENT_TRAVEL'){
  if(!['YES','NO'].includes(a.physical)||(a.physical==='YES'&&a.travel_dest==='ROMANIA'))return null;
  return a.travel_dest==='ROMANIA'?'TRAVEL_TITLE_RETURN_RO':a.travel_dest==='OTHER'?'URGENT_OTHER_COUNTRY':null;
 }
 if(dom==='UNKNOWN')return null;
 if(g==='ESTABLISH_FOREIGN_DOMICILE'){
  if(dom==='ABROAD')return a.goal_conflict==='RENEW'?(a.b5case==='MOVE_RO'?'D2_PERMANENT_RETURN':'B5_EXISTING_CRDS'):null;
  if(selected.includes('CRDS_PASSPORT')||a.crds_history==='RETURNED')return null;
  return 'B1_FIRST_CRDS';
 }
 if(g==='EXISTING_CRDS_PROBLEM'){
  if(dom==='ABROAD')return a.b5case==='MOVE_RO'?'D2_PERMANENT_RETURN':'B5_EXISTING_CRDS';
  if(selected.includes('CRDS_PASSPORT'))return null;
  if(a.passport_domicile==='ROMANIA')return a.crds_history==='NEVER'?'B1_FIRST_CRDS':null;
  return a.crds_clarify==='LOCAL_RESIDENCE'||a.crds_confirm==='NEVER'?'B1_FIRST_CRDS':null;
 }
 if(g==='KEEP_FOREIGN_DOMICILE'||g==='MOVE_DOMICILE_TO_RO')
  return dom==='ABROAD'?(g==='KEEP_FOREIGN_DOMICILE'?'D1_TEMPORARY':'D2_PERMANENT_RETURN'):null;
 if(g==='ID_PROBLEM'){
  if(dom==='ABROAD')return a.domicile_intent==='KEEP'?'D1_TEMPORARY':a.domicile_intent==='MOVE'?'D2_PERMANENT_RETURN':null;
  if(a.can_come==='YES')return 'A1_PERSONAL_ROMANIA';
  if(!['NO','NOT_SOON'].includes(a.can_come))return null;
  return selected.some(d=>['ROMANIAN_ID','CEI'].includes(d))?'A2_PROXY':'A3_FIRST_ID_CONSULAR';
 }
 if(g==='CEI'){
  if(!['YES','NO'].includes(a.physical))return null;
  if(dom==='ABROAD')return 'C3_CEI_NO_RO_DOMICILE';
  if(a.physical==='NO'&&a.can_come!=='YES')return ['NO','NOT_SOON'].includes(a.can_come)?'C2_CEI_CONSULAR':null;
  return ['EXPIRED','EXPIRING','LOST','STOLEN','DAMAGED'].includes(docs.CEI)?'C5_CEI_REPLACEMENT':'C1_CEI_ROMANIA';
 }
 return null;
}

export function checkoutDecisionFor(input){
 const raw=input&&input.answers,rawDocs=input&&input.docs;
 const a={},docs={},invalid=[],conflicts=[];
 const enums=eligibilityAnswerEnums();
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!rawDocs||typeof rawDocs!=='object'||Array.isArray(rawDocs))invalid.push('case_shape');
 else {
  for(const [key,values] of Object.entries(enums))if(Object.hasOwn(raw,key)){
   if(!values.includes(raw[key]))invalid.push(key);else a[key]=raw[key];
  }
  const selected=raw.documents,primary=['ROMANIAN_ID','PASSPORT','CRDS_PASSPORT','CEI'];
  const choices=[...primary,'BIRTH_CERT','MARRIAGE_CERT','CITIZENSHIP_CERT','UNKNOWN'];
  if(!Array.isArray(selected)||!selected.length||selected.length>choices.length||new Set(selected).size!==selected.length||selected.some(d=>!choices.includes(d))||selected.includes('UNKNOWN'))invalid.push('documents');
  else a.documents=[...selected];
  for(const [key,value] of Object.entries(rawDocs)){
   if(!primary.includes(key)||!a.documents?.includes(key)||!['VALID','EXPIRED','EXPIRING','LOST','STOLEN','DAMAGED','MISSING'].includes(value))invalid.push('docs.'+key);
   else docs[key]=value;
  }
  for(const key of a.documents||[])if(primary.includes(key)&&!docs[key])invalid.push('docs.'+key);
 }
 if(a.age!=='YES')invalid.push('age');
 if(!['YES','REACQUIRED'].includes(a.citizenship))invalid.push('citizenship');
 if(!a.residence_country||a.residence_country==='OTHER')invalid.push('residence_country');
 if(a.goal!=='URGENT_TRAVEL'&&!a.civil_change)invalid.push('civil_change');
 // Passport history and the most recent passport are evidence, not a derived
 // domicile flag. Require the same question that the questionnaire would ask.
 if(a.goal!=='URGENT_TRAVEL'){
  if(a.documents?.some(d=>['PASSPORT','CRDS_PASSPORT'].includes(d))){if(!a.passport_domicile)invalid.push('passport_domicile');}
  else if(!a.ever_crds)invalid.push('ever_crds');
 }
 const route=routeFromAnswers(a,docs);
 if(route==='D2_PERMANENT_RETURN'&&!['YES','NO'].includes(a.dependents))invalid.push('dependents');
 if(a.goal==='CEI')a.cei_case=['EXPIRED','EXPIRING','LOST','STOLEN','DAMAGED'].includes(docs.CEI)?docs.CEI:null;
 const originalContradictions=contradictionsOf({answers:a,docs,route});
 const derive=(key,value)=>{if(a[key]!==undefined&&a[key]!==value)conflicts.push({code:'DERIVED_'+key.toUpperCase()});a[key]=value;};
 if(route==='B5_EXISTING_CRDS'){
  const s=crdsStatusOf(a,docs),scenario={EXPIRED:'RENEWAL',EXPIRING:'RENEWAL',LOST:'LOST',STOLEN:'STOLEN',DAMAGED:'DAMAGED'}[s];
  if(scenario)derive('b5case',scenario);
  if(!a.b5case||a.b5case==='UNKNOWN')invalid.push('b5case');
  if(a.passport_domicile==='CURRENT')derive('same_country','YES');
  if(a.passport_domicile==='OTHER')derive('same_country','NO');
  if(a.b5case==='COUNTRY_CHANGE'&&a.same_country!=='NO')invalid.push('same_country');
 }
 if(route==='D1_TEMPORARY'){
  const s=crdsStatusOf(a,docs);
  if(s)derive('d1_crds',docValid(s)?'VALID':s==='EXPIRED'?'EXPIRED':'LOST');
 }
 if(route==='B1_FIRST_CRDS'&&a.citizenship==='REACQUIRED'){
  if(Object.values(docs).some(docValid)||a.post_citizenship_romanian_id==='YES')a.citizenship_cert_required='NO';
  else {
   if(a.post_citizenship_romanian_id===undefined)invalid.push('post_citizenship_romanian_id');
   if(a.post_citizenship_romanian_id==='NO'&&a.documents?.includes('CITIZENSHIP_CERT'))a.citizenship_cert_available='YES';
   a.citizenship_cert_required=a.post_citizenship_romanian_id==='NO'||a.citizenship_cert_available==='YES'?'YES':'POSSIBLE';
  }
 }
 const decision=paymentDecisionFor({answers:a,docs,route});
 decision.unknowns.push(...invalid.map(key=>'Răspuns lipsă sau nevalid: '+key));
 decision.contradictions.push(...originalContradictions.filter(c=>!decision.contradictions.some(d=>d.code===c.code)),...conflicts);
 if(input?.route!==undefined&&input.route!==route)decision.contradictions.push({code:'CASE_ROUTE_CHANGED'});
 decision.allowed=decision.allowed&&invalid.length===0&&decision.contradictions.length===0;
 if(decision.unknowns.length)decision.status='YELLOW_U';
 // Whitelist answers; browser decisions, arbitrary fields and status are discarded.
 decision.caseState={answers:a,docs,route,status:decision.status,clarified:{}};
 return decision;
}
