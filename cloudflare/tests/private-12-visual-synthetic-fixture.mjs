// Synthetic 12-guide payload for offline browser smoke only.
// NEVER create this fixture from real D1 scripts or upload premium code.
const codes=['FR','BE','NL','IE'];
const includeUnverifiedClaim=process.argv.includes('--editorial-badge');
const includeEvidenceExamples=process.argv.includes('--evidence-examples');
const evidenceExample={
 B1_FR:'Carte Vitale fără calificare în primul ghid CRDS.',
 B5_RENEWAL_BE:'Anexa 19 este prezentată ca documentul pentru înregistrare.',
 B1_NL:'Numărul BSN și înregistrarea RNI.',
 B5_LOST_IE:'Numărul PPS, cardul IRP și formularul EUTR2.'
};
const countryNames={FR:'Franța',BE:'Belgia',NL:'Țările de Jos',IE:'Irlanda'};
const pairs=[
 ['B1_','B1_FIRST_CRDS','showB1','ValidatedGuide'],
 ['B5_RENEWAL_','B5_EXISTING_CRDS','showB2','ValidatedGuide'],
 ['B5_LOST_','B5_EXISTING_CRDS','showB3','ValidatedGuide']
];
const output=[];
for(const country of codes){
 for(const [prefix,route,before,after] of pairs){
  const key=prefix+country;
  const fn=before+country+after;
  const filler=('Acesta este un text sintetic pentru un test automat de structură. ').repeat(20);
  const html='<h1>Ghid de test '+countryNames[country]+'</h1><section class="real-guide-step"><h3>Pasul de test</h3><p>'+
    filler+'</p></section><div class="personal-check">Document demonstrativ</div>'+
    '<a href="https://example.org/official-document.pdf">Document de test</a>'+
    (includeUnverifiedClaim?'<span class="guide-status">Procedură verificată</span>':'')+
    (includeUnverifiedClaim && !['B1_NL','B1_IE'].includes(key)
      ?'<span class="source-check">Surse reverificate: 5 octombrie 2026</span>':'')+
    (includeUnverifiedClaim
      ?'<span class="date-note">Data informativă: 5 octombrie 2026</span>':'')+
    (includeEvidenceExamples&&evidenceExample[key]
      ?'<p class="synthetic-evidence-example">'+evidenceExample[key]+'</p>':'');
  // Prove the offline harness loads the actual public miniFormPreview helper
  // before invoking a synthetic paid-guide function. Do not mock it in CI.
  const callPublicHelper=key==='B1_FR'?'void miniFormPreview("Test sintetic","DGP");':'';
  output.push({guide_key:key,route,
    script_js:'function '+fn+'(){'+callPublicHelper+'document.getElementById("screen").innerHTML='+JSON.stringify(html)+';}'});
 }
}
process.stdout.write(JSON.stringify([{results:output}]));
