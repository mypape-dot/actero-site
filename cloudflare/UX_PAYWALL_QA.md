# ActeRO — UX / Paywall QA (branch only, NOT deployed)

## Changes in PR #3
- The paywall presents the **declared country and goal** before the checkout button, without revealing the paid procedure.
- A case with known `S.blockers` now displays up to three relevant administrative obstacles *before* payment. Users are warned that the guide does not guarantee immediate eligibility.
- The nine scrolling "example reviews" were **removed** and replaced by a scrolling set of nine statements about guide contents. Never present marketing examples as customer testimonials.
- Changed promises such as "no pointless trips" and "always updated" into verifiable descriptions of the guide.
- Disclosed that ActeRO is independent, informational, not an official authority.
- When `window.ACTERO_PAYMENT_API` is not a configured HTTPS endpoint, checkout CTA is disabled and the text states that payment is unavailable. Previously, the text falsely implied that the guide opened as a free preview.
- The existing palette, paywall card, responsive CSS and scrolling benefits were preserved. The animation stops when the user requests reduced motion.

## Visual acceptance criteria (still require real browser QA)
1. Mobile width 320px, 375px and 430px: price, button, context and caution message should not overflow or overlap; the CTA remains readable and clickable only when payment is configured.
2. Desktop widths 1024px and 1440px: balanced spacing, no jarring jumps on transition from questionnaire to paywall.
3. A case without blockers displays **no caution message**; a case with blockers displays accurate, escaped content and does not hide the CTA.
4. When the API is absent, the paywall clearly indicates unavailable checkout and never promises a free preview.
5. A route without a validated paid guide must not show the paid CTA.
6. Test keyboard navigation, large text and reduced-motion preferences.
7. Test **actual paid content** for each of the 43 guide variants, with rendered official links and documents—not just the initial paywall.
8. Avoid claims of "verified" procedures until all affected sources and fees are checked.
9. Test first checkout from a real questionnaire (server `/session`, then `/checkout`, then Shopify test order), retry with access token, lost-browser recovery and refund revocation.

## Limitations
Source-level checks and local simulation tests do not establish that the site *looks* right in Safari, on a phone, or inside Shopify; this needs a staging URL and browser screenshots.
No live deployment, Shopify setup or migration has been changed.
