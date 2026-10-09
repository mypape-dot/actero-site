# ActeRO 0.5 payment staging — do not merge

Checkout is **disabled** in the deployed Worker 0.4.0 and main GitHub Pages remains unchanged.

The 0.5.0 implementation prepared outside the public repository adds:
- checkout-scoped D1 intents and high-entropy access tokens (stored hashed in D1);
- a Shopify cart permalink that carries the checkout ID in a line-item property;
- raw-body SHA-256 HMAC verification for Shopify Admin **Order payment** webhooks;
- shop, topic, product variant, currency, gross price, case route and guide-key checks;
- idempotent paid granting and a disabled-by-default payment switch.

The checkout product variant is **provisional** until it can be verified with an active Shopify test product.
The store remains password-protected and the product remains Draft.

**Before release:** deploy the staged backend from the private deployment package with `SHOPIFY_CHECKOUT_ENABLED=false`, add the shop's webhook signing secret as Cloudflare Secret, register a Shopify Admin Order payment JSON webhook, run real end-to-end tests, then address refunds, lost-browser access recovery, merchant/tax compliance and historical guide exposure in GitHub.

No secret or private guide content belongs in this public repository. Do not merge this branch while backend and frontend deployments are unsynchronized.
