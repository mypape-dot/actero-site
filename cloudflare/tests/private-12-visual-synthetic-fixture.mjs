// Synthetic 12-guide payload for offline browser smoke only.
// NEVER create this fixture from real D1 scripts or upload premium code.
const codes=['FR','BE','NL','IE'];
const pairs=[
 ['B1_','B1_FIRST_CRDS','showB1','ValidatedGuide'],
 ['B5_RENEWAL_','B5_EXISTING_CRDS','showB5Renewal','ValidatedGuide'],
 ['B5_LOST_','B5_EXISTING_CRDS','showB5Lost','ValidatedGuide']
];
const output=[];
for(const country of codes){
 for(const [prefix,route,before,after] of pairs){
  const key=prefix+country;
  const fn=before+country+after;
  const filler=('Acesta este un text sintetic pentru un test automat de structură. ').repeat(20);
  const html='<h1>Ghid de test '+country+'</h1><section class="real-guide-step"><h3>Pasul de test</h3><p>'+
    filler+'</p></section><div class="personal-check">Document demonstrativ</div>'+
    '<a href="https://example.org/official-document.pdf">Document de test</a>';
  output.push({guide_key:key,route,
    script_js:'function '+fn+'(){document.getElementById("screen").innerHTML='+JSON.stringify(html)+';}'});
 }
}
process.stdout.write(JSON.stringify([{results:output}]));
