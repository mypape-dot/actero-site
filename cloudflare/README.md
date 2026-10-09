# ActeRO — protected guide backend, Shopify staging

Ramura de lucru conține frontend-ul care solicită ghidul plătit din Cloudflare și versiunea **0.5.0** a Worker-ului Shopify, sincronizată din pachetul folosit pentru instalarea privată. **Acest repository nu include cheile Shopify, HMAC Secret sau cele 43 de ghiduri premium.**

## API Worker 0.5.0
- `POST /checkout`: verifică ruta / `guide_key` din D1, creează tokenul de acces (hash-uit în D1) și un checkout intent, apoi generează un Shopify cart permalink pentru varianta `67640764400007`, la 49 RON. Răspunde 503 când `SHOPIFY_CHECKOUT_ENABLED` nu este `true`.
- `POST /webhooks/shopify/orders-paid`: verifică semnătura HMAC, magazinul, topicul, varianta, moneda, suma și identificatorul checkout-ului înainte să acorde acces.
- `GET /access` și `GET /guide-script`: necesită tokenul de acces și verifică grant-ul plătit din D1. Ghidurile sunt încărcate separat de frontend.

## Instalare și stare
- Migrațiile `001-guide-variants.sql` și `002-shopify-checkout.sql` trebuie aplicate doar o dată pe D1. Nu reaplica migrații fără verificarea schemei.
- Pe 9 octombrie 2026, Worker 0.5.0 era instalat separat în Cloudflare, cu `SHOPIFY_CHECKOUT_ENABLED=false`, `SHOPIFY_WEBHOOK_SECRET` configurat și 43 de ghiduri importate în D1.
- Checkout-ul Shopify direct a afișat produsul la 49 RON, dar **nu există încă test complet de plată + acordare acces**.
- Testele locale Worker: 23 verificări PASS; semnătura webhook testată pozitiv/negativ în Cloudflare.
- Vezi `SHOPIFY_STAGING.md` pentru lista actuală de verificări înainte de merge.

**PR-ul rămâne Draft. Nu publica drept final până la testarea efectivă a întregului flux.** Istoricul public anterior al repository-ului încă poate conține materiale din ghiduri.
