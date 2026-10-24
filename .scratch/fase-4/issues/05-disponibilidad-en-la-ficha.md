# 05: Availability on the public listing, fresh after every change

**What to build:** the «Disponibilidad» section on `/casa/CT-####` (SSR data, lazy read-only grid mounted after hydration in a fixed box) and on its SPA twin, and the end-to-end proof that an owner's change shows on the cached page at once. See spec § Public listing.

**Blocked by:** 03 (uses `MonthGrid`); can run in parallel with 04 only in a separate worktree with its own local Supabase.

**Status:** ready-for-agent

- [ ] Worker: `getPublic` and `getPublicDays` in parallel; days in `ssr-data`; status pages unchanged. Worker HTTP seam tests (days present, parallel, none on 404/410/503, cache key unchanged).
- [ ] Section «Disponibilidad» after the features, before «Zona aproximada»: fixed-height placeholder in SSR (no calendar markup in the HTML), lazy chunk `listing-calendar-*.js` (own `size-limit` entry ≤ 4 KB gz) loaded after hydration on idle or near the viewport; read-only `MonthGrid`; figures only on ★ days following the page currency; base price line; Mensual-only without figures; closed house «Calendario cerrado» + reopening date.
- [ ] SPA twin: `["listing-days", publicId]` public query (stale 60 s, refetch on mount), seeded from `ssr-data`.
- [ ] Budgets: hydration closure +≤ 0.5 KB gz; no request to PostgREST at hydration; hydration test green; box height identical before/after; Lighthouse listing ≤ 1.70 s locally (median of 3), shell unchanged; contact sheet chunk untouched.
- [ ] Freshness end to end (local): Vault secrets → local worker (`host.docker.internal:<E2E_PORT>`, dev-vars secret), owner saves in one context, a fresh anonymous context gets the change in the `/casa/CT-####` HTML within 5 s; same after closing and after `reopen_due_listings`. If the local worker doesn't cache, assert `net._http_response` 200 and document it.
- [ ] Playwright (Pixel 7): ficha calendar after hydration (occupied, ★ figure, base line), navigation through months, closed house, no hydration warnings, CSP clean; screenshots reviewed.
- [ ] Green: `typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e`, `lighthouse`.
