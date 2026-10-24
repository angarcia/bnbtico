# 03: Owner calendar screen (design 17)

**What to build:** `/propietario/calendario` per design 17 replacing the placeholder, in its own lazy chunk, with house selector, month navigation, selection-first editing and atomic optimistic save. See spec § Owner calendar screen.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Shared `MonthGrid` component (`src/shared/month-grid.tsx`, interactive and read-only modes, no inline styles) reusable by the public page in ticket 05.
- [ ] Screen in its own lazy chunk `calendario-*.js`: own `size-limit` entry ≤ 8 KB gz, excluded from the private initial and from the tab-screens entry; prefetched on intent/idle with the owner screens. Route search `casa`, `mes` validated; last house in `localStorage`.
- [ ] Header with house selector (non-rejected houses), month arrows disabled at the window ends, weekday header «L K M J V S D», day cells per spec (prices «95k», «ocupado», ★, selected border, past disabled, `aria-label` with date/state/price), legend. Mensual-only house without prices.
- [ ] Bottom panel only while days are selected: label, «Cancelar», Disponible/Ocupado, price «₡» with «Varios precios», «Usar el precio base (₡…)» link when a ★ day is selected, «Guardar cambios» disabled until a change; keyboard does not hide the field on iPhone (`--kb`).
- [ ] Save optimistic < 50 ms with rollback + toast on refusal / «Sin conexión…»; query `["calendar", uid, listingId]` (whole window, persisted private, removed on sign-out); month navigation without network; success invalidates the public listing and days queries.
- [ ] Closed house: note with `reopenLabel`, read-only dimmed grid, «Abrir a consultas». No houses: «Publique su casa para usar el calendario.» + «Publicar casa».
- [ ] Entry points wired: tab, Mis casas «Calendario» (`casa=`), detail row, «Marcar las noches ocupadas» in «enviada».
- [ ] Playwright (Pixel 7, each test creates its own houses): the flows of spec § Testing Decisions for the owner calendar; CSP clean; screenshots reviewed against design 17.
- [ ] Green: `typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e`, `lighthouse`.
