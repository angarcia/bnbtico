# 04: Payment method with Stripe in test mode (no charge)

**What to build:** `PaymentProvider` (Stripe REST + fake), `POST /api/pago/sesion`, `POST /webhooks/stripe` (and `/webhooks/fake` + `/_pago-falso/:session` in local), wired to `payment_setup_context`, `save_payment_customer` and `apply_payment_event`. See spec § Worker.

**Blocked by:** 02

**Status:** blocked

- [ ] Interface in the domain; `StripeProvider` with `fetch` only (customers, checkout sessions `mode=setup`, setup intent with `expand[]=payment_method`), signature check with Web Crypto (5 min tolerance, constant time), refuses `sk_live_` outside production and any payments in production; `FakeProvider` with the fake checkout page (CSP-clean: no inline script or style).
- [ ] Session route: user JWT forwarded to `payment_setup_context`; 401/403/503 cases; success/cancel URLs with `#pago=CT-####`.
- [ ] Webhook: invalid/expired signature → 400 and nothing written; duplicate → 200 `duplicate`; unknown type → 200 `ignored`; database failure → 500. Logs only id, type and result.
- [ ] HTTP seam tests for every case with injected provider and data; one real-shape fixture of a Stripe `checkout.session.completed` (setup) event signed with a test secret.
- [ ] No card data anywhere in our code paths (review the diff for it); shell CSP unchanged.
- [ ] Green: `typecheck`, `test`, `test:db`, `build`, `size`.
