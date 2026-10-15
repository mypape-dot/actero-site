# Pagina de confirmare ActeRO (staging)

Această implementare este **doar în ramura de lucru**. Nu este pe GitHub Pages public și nu activează Shopify checkout-ul.

## Fluxul dorit
1. Clientul completează chestionarul, iar frontend-ul salvează `case_id` și primește un token pentru accesul ulterior, fără a-l include în URL.
2. Shopify confirmă plata prin webhook HMAC; numai backend-ul poate marca accesul drept `paid`.
3. Pagina Shopify Thank you / Order status necesită un link configurat explicit către pagina de confirmare de pe domeniul aprobat. Acest link nu este creat de Worker; publicarea în `main` nu îl configurează automat.
4. `confirmare.html` citește identificatorul cazului din URL (când există) sau din `actero_active_case` din același browser; citește tokenul din localStorage și interoghează `GET /access` cu headerul `X-Actero-Access-Token`.
5. Dacă backend-ul confirmă `paid=true`, butonul „Vreau să văd ghidul personalizat” devine activ. Acesta deschide `./?case_id=...&open_guide=1`. Main frontend verifică din nou accesul și încarcă ghidul din Worker.
6. Pentru `paid=false`, pagina reîncearcă până la limita prestabilită; pentru token lipsă sau eroare de API, nu afirmă că plata este confirmată.

## Verificări realizate local
- Sesiune lipsă: buton blocat.
- Plată în așteptare: buton blocat.
- Plată confirmată: buton activ.
- Plată confirmată cu întârziere: activare după verificare.
- Sintaxa JavaScript din pagina de confirmare și din frontend: validă.

## Blocaje înainte de lansare
- **Nu există încă linkul Shopify Thank you -> confirmare.html.** Verificați în checkout/accounts editor dacă poate fi adăugat un bloc „Static content” prin Shopify Checkout Blocks, disponibil pe unele planuri Basic+; nu promiteți redirecționare automată.
- Configurația publică Draft dezactivează checkout-ul. Starea curentă Cloudflare, Shopify Test Mode, parola magazinului și varianta comercială nu au fost reverificate în acest audit; notele din 9 octombrie sunt istorice.
- Checkout URL și proprietatea de linie pentru `_actero_checkout_id` necesită verificare printr-o comandă Shopify de test. Nu considerați confirmat fluxul cap-coadă.
- Recuperarea este implementată în `recuperare.html` și `cloudflare/recovery.js`, inclusiv rotația tokenului. Fluxul este testat local cu email simulat; livrarea prin furnizorul real rămâne neverificată.
- În repo-ul public există text premium în istoricul Git; un commit nou nu elimină versiuni publicate anterior.
- Nu faceți merge până la verificările pentru acces neplătit, variantă greșită, plată reală în Test Mode, repetarea webhook-ului, anulări/refunduri și alinierea fiscală/juridică.

## Shopify / Checkout Blocks
Surse:
- https://help.shopify.com/en/manual/checkout-settings/checkout-blocks/blocks/create-block
- https://help.shopify.com/en/manual/checkout-settings/customize-checkout-configurations/checkout-editor

Legătura statică dintre Shopify și ActeRO funcționează pentru revenirea **din același browser**. La revenirea de pe alt dispozitiv, pagina arată doar un mesaj de recuperare, fără a pretinde că are acces.

Auditul din 15 octombrie verifică local întregul flux cu un ghid sintetic și afișează
explicit accesul retras după rambursare, în loc să continue să aștepte plata.
Vezi [raportul tehnic](cloudflare/TECHNICAL_AUDIT_2026-10-15.md).
