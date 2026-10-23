# 06: Favorites: heart on cards and listing, Favoritos screen, sync with session

**What to build:** hearts on Explorar cards and on the listing hero (SSR after hydration, fixed box), the Favoritos screen per design 05, local store without account and sync with `favorites` when signed in. Spec § Favorites.

**Blocked by:** 01 (can run after 05; independent of 02–05 in code)

**Status:** ready-for-agent

- [ ] Heart: `aria-pressed`, labels «Guardar en favoritos» / «Quitar de favoritos», terracotta when on, tap response < 50 ms, never navigates the card. On the SSR listing a placeholder of the same size until hydration (hydration test extended); anonymous → no network.
- [ ] Favoritos (`/favoritos`, lazy): header per design, count line («guardadas en este teléfono» signed out), horizontal cards with price toggle, sage note, empty state with «Explorar casas»; cards from `listings_public` by `public_id in (…)` (one query, public cache); missing ids pruned silently.
- [ ] Sync: on sign-in and on start with session `addMany(local)` → `list()` → merge into local; signed-in add/remove local first then API, rollback + toast on error; sign-out keeps local list.
- [ ] Mi cuenta row «Favoritos» goes to the screen (if present).
- [ ] Playwright: anonymous save from Explorar and from the SSR listing → reload → Favoritos shows both → remove → sign in on the same phone → stored in DB → new browser context signed in as the same user sees them. Gates green incl. `lighthouse` (listing unchanged within noise).
