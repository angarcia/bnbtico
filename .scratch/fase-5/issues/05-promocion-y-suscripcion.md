# 05: «Promoción y suscripción» screen and Cuenta

**What to build:** `/propietario/suscripcion` in its own lazy chunk and the owner Cuenta parts (design 20). See spec § Screens.

**Blocked by:** 03, 04

**Status:** blocked

- [ ] Route and chunk `suscripcion-*.js` with its `size-limit` entry (≤ 7 KB gz), prefetched with the owner screens; private initial and tab-screens entries not raised (or justified).
- [ ] Houses with state, line, reminder card, pay button by `payButtonDue`, stop (with confirmation) / resume optimistic with rollback; method block; launch tiers; «Cómo funciona».
- [ ] `#pago=CT-####`: highlight and scroll; without session → Ingresar → back to the same hash. Return `?pago=ok`: refetch and the three messages.
- [ ] Cuenta owner mode: «Suscripción» card with `nextCharge` and «Ver detalle»; «Método de pago» row.
- [ ] Degrades without the migration (no subscription parts, no error).
- [ ] Playwright Pixel 7 (fake provider): every state, the pay rule, stop/resume and rollback, `#pago=` with/without session, fake checkout round trip; screenshots reviewed.
- [ ] Green: all batteries.
