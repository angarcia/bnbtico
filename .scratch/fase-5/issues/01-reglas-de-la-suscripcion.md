# 01: Subscription rules in the domain (Vitest port of the prototype)

**What to build:** `src/domain/subscription.ts` (no framework) with every rule of spec § Domain, and its Vitest suite porting the v1 rules of `tests/prototype/estados-casa.cjs`, `mis-casas.cjs` and `house-controls.cjs`. No database, no screens.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] `tierForSlot`, `launchOffer(taken)` (input is now assigned slots; `offer.ts` reexports or moves without breaking its callers), `promoEndsOn` (month-end clamping, last free day), `daysLeft`, `reminderThreshold` (smallest threshold ≥ days left; 91 → null … −1 → null; prototype bug not ported), `nextStatus` with `SUBSCRIPTION_MESSAGES`, `payButtonDue`, `subscriptionLine`, `reminderCard`, `reminderWhatsApp` (90/30/7 and 0 variants), `payLink`/`parsePayHash`, `nextCharge`, `blockedReason`.
- [ ] Every case listed in spec § Domain «Rules from the prototype tests…» as a Vitest case with fake time (Costa Rica dates; no real `Date.now()`).
- [ ] Copy in usted exactly as the spec; amounts `₡9 900`.
- [ ] `tests/prototype/*.cjs` untouched and passing; architecture test green (no framework imports).
- [ ] Green: `typecheck`, `test`, `build`, `size` (nothing should move: the module is not imported by screens yet).
