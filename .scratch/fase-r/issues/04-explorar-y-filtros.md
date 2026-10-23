# 04: Explorar and Filtros rendered in the browser

**What to build:** a visitor opens Explorar, sees Limón by default with only provinces that have houses, taps chips and the Filtros screen, sees "Ver N casas" update, and gets results with no visible wait on revisit. Cover photos load lazily at the right size. Switching currency is instant and needs no server.

**Blocked by:** 02 (Domain foundation and public reads).

**Status:** done

- [x] Explorar and Filtros routes with typed search parameters (province, people, bedrooms, features, nightly/monthly, price range, more-filters flag) validated by the shared filters schema; the URL is shareable and restores the screen.
- [x] Data through Query keys for public listings per filter set (60 s stale, persisted to IndexedDB, previous data kept while a new filter loads) and provinces (10 min).
- [x] Filtros shows the matching count from the same query; "Ver N casas" applies and navigates back; min and max swap when inverted.
- [x] `Picture` component renders `srcset` 480/800 with `sizes`, explicit dimensions, `loading="lazy"`, and falls back to a single legacy photo path.
- [x] Currency toggle is client state shared with the listing page; prices format as `₡95 000` and `≈ $186`.
- [x] Tab bar switches between Explorar, Favoritos and Cuenta with no network; scroll position of Explorar restored on back from a listing; listing detail seeded from the card data so it paints before its own fetch.
- [x] Playwright: Explorar and Filtros flows ported from the old suite; a second visit to Explorar renders from cache with the network blocked.
- [x] Listing page from 03 reachable from a card; back returns to the same scroll position.

## Cierre (2026-10-22)

- Rutas en el router del navegador: `/explorar` y `/explorar/filtros` (búsqueda tipada con `normalizeSearch`, el mismo esquema de `parseFilters`; URL legible `?prov=Todas&min=44000&max=50000` con `parseSearch`/`stringifySearch` propios sobre `URLSearchParams`) y `/casa/$publicId` (navegación SPA desde una tarjeta; la carga directa sigue siendo SSR del worker). Las pestañas cuelgan de un layout sin ruta (`_tabs`); la ficha va fuera para no anidar `.app`.
- Query: `["listings", filtros]` 60 s con `keepPreviousData`, `["provinces"]` 10 min, `["listing", id]` 5 min sembrada con la fila de la tarjeta (`initialData` + `initialDataUpdatedAt` del listado). Caché persistida en IndexedDB con un almacenamiento propio mínimo (`src/client/persist.ts`, sin idb-keyval), `buster` = id del build (`__BUILD_ID__`: `GITHUB_SHA` o la hora del build), solo claves públicas.
- Filtros guarda un borrador local, cuenta con la misma consulta y aplica con `replace`; mínimo y máximo se intercambian (lo hace `parseFilters`). `Picture` (`src/shared/picture.tsx`) con `srcset` 480/800, `sizes`, `width`/`height` y `loading="lazy"`; foto anterior sin `srcset`. Moneda: `useCurrency`/`setCurrency` compartidos con la ficha. Scroll de Explorar restaurado con `scrollRestoration` del router. Sin estilos inline.
- Pruebas: 202 unitarias (nuevas: búsqueda en la URL y `Picture`), 16 de base, 12 de Playwright (7 de Explorar/Filtros: Limón por defecto y solo provincias con casas, recuento en vivo e intercambio, chips y URL que restaura, moneda compartida con la ficha, scroll al volver, segunda visita con `/rest/v1` bloqueado y ficha pintada desde la tarjeta, sin resultados y pestañas sin red). `typecheck` y `build` en verde.
- Tamaño: **121,27 KB gz** de JS inicial de la zona privada.
- Desviaciones:
  - `src/domain/filters.ts` usa `zod/mini` en vez de `zod`: el esquema entra en el JS inicial y zod completo sumaba ~25 KB gz (140 KB en total); con mini son ~5,5 KB. La regla de arquitectura admite `zod/mini`.
  - `.size-limit.json` ahora mide todos los trozos JS salvo los diferidos (Leaflet y supabase-js): antes solo contaba `index`/`shell`/runtime y un trozo compartido nuevo se habría quedado fuera.
  - La prueba ya escrita esperaba «Ver 4 casas» entre ₡44 000 y ₡50 000, pero los datos sembrados dan 3 (44, 45 y 46 mil); se corrigió a 3. `shell.spec.ts` espera ahora el título real de Explorar («¿Para dónde va?»).
- Sin migraciones. Sin acciones manuales para Daniel más allá de mirar Explorar en `nueva.bnbtico.com` tras el despliegue.
