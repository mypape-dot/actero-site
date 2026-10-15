# Staging ActeRO — configurație izolată, checkout oprit

## Starea confirmată de proprietar

Worker-ul `actero-staging` și D1 `actero-staging-db` există, binding-ul este `DB`,
URL-urile publice/preview sunt oprite și nu există routes. Migrarea
`0001-empty-staging.sql` este instalată și înregistrată (ID 1); cele 11 tabele
există. Dry-run-ul versiunii anterioare a trecut pe Mac. Codul Worker nu a fost
publicat de agent. Producția `actero` / `actero-db` rămâne protejată.

**Nu reaplica și nu regenera migrarea 0001 deja instalată.** Orice viitoare
modificare de schemă va folosi o migrare nouă, numerotată separat.

## Continuarea implementării

[Planul Shopify Test Mode și frontend separat](SHOPIFY_TEST_SETUP.md) documentează:

- frontend Pages Direct Upload pe origine HTTPS separată, build local fără secrete;
- configurarea originii CORS, recuperării, shop-ului și variantei per mediu;
- păstrarea implicitelor existente pentru deployment-urile vechi și refuzul
  fallback-ului staging către producție;
- magazin de dezvoltare separat, Test payment gateway / Shopify Payments Test Mode;
- generatorul unui singur ghid sintetic, fără importuri sau aprobări comerciale;
- teste pentru webhook-uri și recuperare inclusiv cu checkout-ul oprit;
- operațiile remote care necesită încă aprobarea proprietarului.

Fișierele cheie:

| Fișier | Utilizare |
|---|---|
| `wrangler.json.example` | Șablon fără Account ID/UUID reale; checkout și expunere oprite |
| `wrangler.staging.local.json` | Copie locală ignorată de Git; nu se transferă prin pull |
| `check-config.mjs` | Verificare offline a țintei; `--require-ready` cere shop/variant de test completate |
| `migrations/0001-empty-staging.sql` | Bootstrap deja instalat; rămâne nemodificat |
| `build-schema.mjs --check` | Verifică reproducibilitatea bootstrap-ului fără scrieri în D1 |
| `prepare-synthetic-seed.mjs` | Generează SQL local, nu îl execută |
| `../../scripts/build-staging-frontend.mjs` | Generează numai fișiere publice, cu checkout frontend oprit |

Sincronizează vars din copia locală cu șablonul actualizat, păstrând Account ID și
UUID-ul staging verificate. Completează ulterior shop/variant reale ale dev store;
placeholder-ele sunt acceptate numai pentru planul închis și blochează commerce
la runtime. Originea Pages propusă trebuie confirmată înainte de publicare.

```bash
node cloudflare/staging/check-config.mjs \
  --config cloudflare/staging/wrangler.staging.local.json \
  --production-d1-id UUID_PROD_VERIFICAT
npm run check:staging
```

Validatorul verifică numele exacte, UUID-uri diferite, binding-ul exclusiv staging,
checkout oprit, mod test, originea separată, shop-ul și varianta. Respinge secrete
în vars, service bindings și rute suplimentare. `--template` nu verifică resurse.
Nicio verificare offline nu autentifică ID-urile sau proveniența secretelor.

Înainte de orice operație remote autorizată, compară ținta efectivă din Dashboard
cu fișierul. Două resurse din același cont nu izolează drepturile unui administrator
care poate modifica ambele. `workers_dev=false` nu împiedică un operator cu drepturi
să facă deploy. Nu există deploy automat în CI sau package.json.
