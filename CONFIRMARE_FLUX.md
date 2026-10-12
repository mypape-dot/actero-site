# Pagina de confirmare ActeRO (staging)

Această implementare este **doar în ramura de lucru**. Nu este pe GitHub Pages public și nu activează Shopify checkout-ul.

## Fluxul dorit
1. Clientul completează chestionarul, iar frontend-ul salvează `case_id` și primește un token pentru accesul ulterior, fără a-l include în URL.
2. Shopify confirmă plata prin webhook HMAC; numai backend-ul poate marca accesul drept `paid`.
3. Pe pagina Shopify Thank you / Order status va exista un link spre `https://mypape-dot.github.io/actero-site/confirmare.html` **după** publicarea în `main`.
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
- `/checkout` este în continuare dezactivat în Cloudflare (`SHOPIFY_CHECKOUT_ENABLED=false`). Produsul este Draft, magazinul are protecție cu parolă și Variant ID încă necesită verificare reală.
- Checkout URL și proprietatea de linie pentru `_actero_checkout_id` necesită verificare printr-o comandă Shopify de test. Nu considerați confirmat fluxul cap-coadă.
- Recuperarea accesului pe alt dispozitiv / după ștergerea datelor browserului NU este implementată; va necesita autentificare sau dovadă verificabilă a comenzii.
- În repo-ul public există text premium în istoricul Git; un commit nou nu elimină versiuni publicate anterior.
- Nu faceți merge până la verificările pentru acces neplătit, variantă greșită, plată reală în Test Mode, repetarea webhook-ului, anulări/refunduri și alinierea fiscală/juridică.

## Shopify / Checkout Blocks
Surse:
- https://help.shopify.com/en/manual/checkout-settings/checkout-blocks/blocks/create-block
- https://help.shopify.com/en/manual/checkout-settings/customize-checkout-configurations/checkout-editor

Legătura statică dintre Shopify și ActeRO funcționează pentru revenirea **din același browser**. La revenirea de pe alt dispozitiv, pagina arată doar un mesaj de recuperare, fără a pretinde că are acces.
