# 06: States in Inicio, Mis casas and the detail; blocked link with its reason

**What to build:** real subscription data in Inicio (design 9), Mis casas (10), the house detail (19), the wizard offer lines, and the 410 reason. See spec § Screens.

**Blocked by:** 02

**Status:** blocked

- [ ] `["billing", uid]` query (private, persisted, removed on sign-out) shared by Inicio, Mis casas, the detail and ticket 05; own-listings query unchanged.
- [ ] Inicio offer card with the house's tier and end, counter from `offerTaken()` (fallback `countActive`), reminder card.
- [ ] Mis casas tiles and cards per state (Pendiente de pago, active in window, Inactiva), `describe.situation` no longer hard-codes «Gratis 12 meses».
- [ ] Detail: ocre card, disabled share with its line, «Suscripción» row.
- [ ] Wizard step 8 and «enviada» use `offerTaken()`.
- [ ] Worker: `blockedReason` only on the blocked path, `.catch → other`; `BlockedPage` with the three texts; hydration test and Lighthouse listing ≤ 1.70 s.
- [ ] Playwright: each state on each screen; 410 for stopped / unpaid / edited houses, no hydration warnings, and the page without the migration (reason RPC failing) equals today's.
- [ ] Green: all batteries; tab-screens limit not raised without a reason.
