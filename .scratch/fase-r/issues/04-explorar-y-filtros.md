# 04: Explorar and Filtros rendered in the browser

**What to build:** a visitor opens Explorar, sees Limón by default with only provinces that have houses, taps chips and the Filtros screen, sees "Ver N casas" update, and gets results with no visible wait on revisit. Cover photos load lazily at the right size. Switching currency is instant and needs no server.

**Blocked by:** 02 (Domain foundation and public reads).

**Status:** ready-for-agent

- [ ] Explorar and Filtros routes with typed search parameters (province, people, bedrooms, features, nightly/monthly, price range, more-filters flag) validated by the shared filters schema; the URL is shareable and restores the screen.
- [ ] Data through Query keys for public listings per filter set (60 s stale, persisted to IndexedDB, previous data kept while a new filter loads) and provinces (10 min).
- [ ] Filtros shows the matching count from the same query; "Ver N casas" applies and navigates back; min and max swap when inverted.
- [ ] `Picture` component renders `srcset` 480/800 with `sizes`, explicit dimensions, `loading="lazy"`, and falls back to a single legacy photo path.
- [ ] Currency toggle is client state shared with the listing page; prices format as `₡95 000` and `≈ $186`.
- [ ] Tab bar switches between Explorar, Favoritos and Cuenta with no network; scroll position of Explorar restored on back from a listing; listing detail seeded from the card data so it paints before its own fetch.
- [ ] Playwright: Explorar and Filtros flows ported from the old suite; a second visit to Explorar renders from cache with the network blocked.
- [ ] Listing page from 03 reachable from a card; back returns to the same scroll position.
