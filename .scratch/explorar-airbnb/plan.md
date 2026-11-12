# Explorar al estilo Airbnb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Explorar gets an Airbnb-like structure in bnbtico's style. It has no top bar. A search pill (Dónde · Cuándo · Quiénes) opens a full-screen search. Explorar can filter by free dates and by a zone (≤ 5 km). Results show one house per row, and the map is the first item of the list, with a full-screen map. The WhatsApp message carries the dates and people of the search.

**Architecture:**
- **Postgres decides membership.** A new RPC `search_listings(p_zone, p_from, p_to)` returns the public houses that match the zone (real point, 5 km) and are free on every night of the range. A new view `zones_with_listings` feeds «¿Dónde?». PostgREST adds the other filters on top of the RPC result.
- **Pure rules in `src/domain`.** URL parsing (`filters.ts`), labels and the range calendar reducer (`search.ts`), and date helpers (`dates.ts`) are pure and unit-tested. The fake repeats the SQL rules, and one contract suite runs against both.
- **New UI pieces load lazily.** The search screen is a new lazy route chunk (`buscar-*.js`). Leaflet drawing for Explorar is its own idle-loaded chunk (`explore-map-leaflet-*.js`). Only the header, the fixed-size map box, the cards and the URL parsing go into the initial JS.

**Tech Stack:** PostgreSQL 17 + PostGIS (Supabase local, schema `extensions`), plpgsql, Vite + React 19 + TanStack Router/Query, Leaflet 1.9, zod/mini, Vitest (unit, db, contract), Playwright (Pixel 7), size-limit, Lighthouse.

**Spec:** `.scratch/explorar-airbnb/spec.md`. Authority: `.scratch/ronda-ana-2026-10-28/decisiones.md` §A and the approved mockups `design/pantallas/v2/01-explorar-resultados.html` to `05-mapa.html`. Where a mockup and the spec disagree, the mockup wins on looks and copy, and the spec wins on behaviour. This plan runs **second**, after `.scratch/densidad-y-tarjetas/` (B+C: `--gutter: 16px`, 26 px tab icons, `--brand-ink: #B44C30`, ✓ on selected chips, bold selected side of «₡ | $», no «₡ | $» on the ficha, the ocre rule, `client/house-card.tsx`).

---

## Global Constraints

Copy: Spanish de Costa Rica, always **usted**, never voseo or tuteo. Never «Disponible» (A11), never «total».

| Where | Exact text |
|---|---|
| Pill, nothing set | «Empiece su búsqueda» |
| Pill, summary | parts joined with « · », first letter uppercase: «Cocles · 23–27 nov · 4 personas», «Desde el 1 dic · 2 personas», «1 persona» |
| Hidden page heading (`.sr-only` h1) | «Explorar casas» |
| Account button | «Ingresar» (signed out) / initials, `aria-label` «Cuenta» (signed in) |
| Monthly chip | `MONTHLY_FILTER_LABEL` = «Solo alquiler mensual» |
| Filters button `aria-label` | «Filtros» · «Filtros (1 activo)» · «Filtros (2 activos)» |
| Results line | «12 casas en Limón» · «4 casas en Cocles y alrededores» · «4 casas en Cocles y alrededores · 23–27 nov» · «3 casas aceptan alquiler mensual en Cocles y alrededores · desde el 1 dic» · «12 casas en Limón · 23–27 nov» |
| Card facts | «4 personas · 2 habitaciones» · «1 persona · 1 habitación» · «2 personas · Estudio» (0 bedrooms) |
| Card price | «₡42 000 / noche» · with monthly filter «₡350 000 / mes» or «Precio a negociar» |
| Map marker | «₡42 000» · «$80» · with monthly filter the monthly price or «A negociar» |
| Map box `aria-label` | «Abrir el mapa de las casas» |
| Floating label | «Mapa» |
| Full-screen map | back `aria-label` «Volver a la lista» · pill «8 casas» / «1 casa» |
| Search close `aria-label` | «Cerrar la búsqueda» |
| Card titles · closed values | «¿Dónde?» «Añadir zona» · «¿Cuándo?» «Añadir fechas» · «¿Quiénes?» «Añadir personas» |
| ¿Dónde? | combobox `aria-label` and placeholder «Busque una zona» · option secondary line «Talamanca, Limón» (cantón, provincia) · no match «Todavía no hay casas en esa zona.» · help «Le mostramos las casas de la zona y las que están a 5 km o menos.» · «Quitar» |
| ¿Cuándo? nightly | «Elija la llegada» → «Elija la salida» → bold «23–27 nov» + muted «4 noches» («1 noche») · help «Le mostramos las casas libres esas noches.» |
| ¿Cuándo? monthly | eyebrow «Solo alquiler mensual» · «Elija desde cuándo» → bold «Desde el 16 nov» + muted «Casas libres del 16 nov al 16 dic» |
| ¿Cuándo? buttons | «Siguiente» (outline) · «Quitar fechas» (text) |
| Day button `aria-label` | «23 de noviembre de 2026» |
| ¿Quiénes? | «Personas» · muted «Todas las que se van a quedar» · value «Sin indicar» at 0 · «Una persona menos» / «Una persona más» · salvia note «Las fechas y las personas van en el mensaje de WhatsApp que le preparamos para el propietario.» |
| Bottom bar | «Borrar todo» (text button) · «Buscar» (filled `btn-primary`, with `I.search`) |
| Filtros first section | eyebrow «Su búsqueda» · rows «Zona» (zone name or «Cualquier zona») · «Fechas» («23–27 nov», «Desde el 1 dic» or «Sin fechas») · «Personas» («4 personas» or «Sin indicar») |
| RPC error | «Revise las fechas.» |
| WhatsApp, nightly | «Hola, vi Casa Cocles en bnbtico y me interesa. ¿Está disponible del 23 al 27 de noviembre para 4 personas? Gracias.» (unchanged sentence) |
| WhatsApp, monthly | «Hola, vi Casa Cocles en bnbtico. Me interesa alquilar por meses desde el 1 de diciembre, para 4 personas. ¿Está disponible? Gracias.» · no people: «Hola, vi Casa Cocles en bnbtico. Me interesa alquilar por meses desde el 1 de diciembre. ¿Está disponible? Gracias.» |

Values:
- Radius **5 km** (`ZONE_RADIUS_M = 5000`, real point). Monthly window **30 nights** `[D, D + 30)` (`MONTHLY_STAY_NIGHTS = 30`). URL: `llegada ≥ hoy`, `salida > llegada`, `salida ≤ hoy + 365`; `hoy ≤ desde ≤ hoy + 335`; `ppl` integer 1–50 (`SEARCH_MAX_PEOPLE = 50` = `INQUIRY_MAX_PEOPLE`); `zona` matches `^[1-7][0-9]{2}-[a-z0-9-]+$`; `mapa=1`. SQL `p_to ≤ today + 366`. «Hoy» is always Costa Rica (`costaRicaToday`).
- Cocles is **`704-cocles`** (Talamanca = 704). The spec's `701-cocles` is a typo.
- Map: box **220 px** fixed height, 20 px corners, arena background. `fitBounds` padding **24 px**, max zoom **15**. Zone only: zone point at zoom **13**. Neither: `PROVINCE_CENTERS.Limón` at zoom **10**. Markers are `.map-price` pills, white text on `--brand-ink` `#B44C30` (B's accessibility ruling).
- Range colours (B's accessibility ruling, which overrides the spec's «salvia»): ends `#D9775A` with number `#1C2B2A`, band `#F7E6D8`.
- Card: photo 4:3, 20 px corners, `sizes="100vw"`, `width={800} height={600}`. The first card is `loading="eager"` + `fetchpriority="high"`; the rest are lazy.
- `DATES_FILTER_KEY = "bnbtico-fechas"` in sessionStorage: `{"llegada":"2026-11-23","salida":"2026-11-27"}` or `{"desde":"2026-12-01"}`. It is removed when there are no dates.

Size (`apps/app/.size-limit.json`):
- «Zona privada · JS inicial» stays **≤ 150 KB** gz. Add the exclusions `!dist/client/assets/buscar-*.js` and `!dist/client/assets/explore-map-leaflet-*.js`.
- New entries: «Búsqueda de Explorar · trozo diferido» `buscar-*.js` **6 KB**; «Mapa de Explorar · trozo diferido» `explore-map-leaflet-*.js` **2.5 KB**; «Leaflet · trozo compartido» `leaflet-*.js` **44 KB**.
- **Never raise an existing limit.** New deferred chunks get their own new size-limit entry. If the initial gate fails, move code into a new lazy chunk with its own entry (Task 10 names the fallback).

Code rules:
- No `style={}` in JSX (architecture test). No `dangerouslySetInnerHTML`, `innerHTML` or `insertAdjacentHTML` in `src` (architecture test). Leaflet `divIcon` gets an `HTMLElement` built with `textContent`, never an HTML string. CSP `script-src 'self'`, nothing inline.
- `src/domain` has no framework imports. PostgREST strings live only in `src/data/postgrest`. `filters.ts` and `search.ts` must not import `calendar.ts` or `inquiry.ts`: those are deferred chunks, and importing them would pull them into the initial JS while the size glob still excludes them.
- Migrations: from the repo root, `pnpm exec supabase migration new <name> < /dev/null`. Apply with `pnpm db:reset` (repo root). Then run `pnpm db:types` (from `apps/app`) and commit `src/domain/database.types.ts`. Never edit old migrations.
- New tables, views and RPCs get grants/policies and a db test plus a contract test **before** any screen uses them. Any `UPDATE` of `listings` in a migration or a test needs `select set_config('app.allow_status','on',true)` (or `set local app.allow_status = 'on'`) in the same transaction.
- Test first. Write the failing test and run it to see the expected FAIL. Implement, run it to see PASS, then commit.
- Commands run from `apps/app`: `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`, `pnpm size`, `pnpm test:e2e`, `pnpm lighthouse`. From the repo root: `pnpm db:reset`, `pnpm test:prototype`. e2e and lighthouse builds need `VITE_WA_GUESTS="+506 6000 0000"` and `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`, with one worker. Stub tiles and storage with `page.route` as `tests/e2e/explorar.spec.ts` does. For scrolling in e2e use `page.evaluate(() => window.scrollTo(...))`. For touch gestures use `tests/e2e/helpers/touch.ts`; `Input.synthesizeScrollGesture` does not scroll on Linux CI.
- Commits: Spanish, imperative, one per task with tests green. **No `Co-Authored-By` line.** No `git push`, no `supabase db push`, never open `pruebas.bnbtico.com` or `bnbtico.com`.

## Review Focus

1. **Off-by-one on the night range or on «hoy».**
   - Risk: a busy day on the salida (S) wrongly excludes a house; a busy night on D + 29 is missed in monthly; or a link opened after midnight sends a past llegada, and the RPC errors so Explorar shows «No pudimos cargar las casas».
   - Tests:
     - Task 3, `tests/db/explorar-fechas-zona.test.ts`: busy on S − 1 excludes, busy on S keeps; p_from < today raises.
     - Task 4, contract (calendar suite): monthly D + 29 busy excludes, D + 30 busy keeps.
     - Task 1, `tests/unit/filters.test.ts`: `normalizeSearch` with `today` drops a llegada of yesterday, and keeps llegada = today.
2. **Distance on the wrong point, or fake and DB disagreeing at the 5 km edge.**
   - Risk: the RPC or the fake uses the public approximate point (± 150–499 m) instead of the real one, so a house at 4.8 km comes and goes.
   - Tests:
     - Task 3: houses at 4.0, 4.8 and 6.0 km from the Cocles point; a 6 km house with `zone_id = '704-cocles'` is included.
     - Task 4, contract `zonesWithListings` and `searchPublic` with zone, run against both the fake and PostgREST.
3. **Leaflet or the search screen leaking into the initial JS, or the 150 KB gate going red.**
   - Tests:
     - Task 1 extends `tests/unit/architecture.test.ts`: `domain/filters.ts` and `domain/search.ts` do not import `./calendar` or `./inquiry`; `client/explore-map.tsx` and `client/screens/explorar.tsx` have no static import of `leaflet` or `./explore-map-leaflet`.
     - The `pnpm size` step in Tasks 8 and 10 checks the new entries and the initial entry.
4. **Full-screen map breaks history or scroll, or refetches.**
   - Risk: opening `?mapa=1` resets the list scroll, Back leaves the map open, or `mapa` changes the query key and the list blinks.
   - Tests:
     - Task 1, unit: `listingsQuery(parseFilters({ mapa: "1" }))` has the same key as without it.
     - Task 10, e2e: scroll to 600 px, open the map, Back closes it, `scrollY` is still 600 and no new `rpc/search_listings` request was made.
5. **Contact sheet prefilled with stale or invalid stored dates.**
   - Risk: past dates, salida ≤ llegada, broken JSON, or a stored draft already present.
   - Tests:
     - Task 6, `tests/unit/contact-return.test.ts`: `readSearchDates(raw, today)` cases.
     - Task 6, `tests/unit/inquiry.test.ts`: a restored draft keeps its own dates over the stored search, and `monthlyFrom` survives store/restore.
     - Task 6, e2e: the sheet starts with Llegada/Salida from the search, and the monthly message is right.

## File Structure

Create:
- `supabase/migrations/<ts>_explorar_fechas_y_zona.sql`: `search_listings`, `zones_with_listings`, `events` name check and `events.search_flags`.
- `apps/app/src/domain/search.ts`: labels (`stayLabel`, `peopleLabel`, `searchSummary`, `resultsText` moved here), the range reducer (`tapRange`, `nightsBetween`), zone suggestions.
- `apps/app/src/client/screens/buscar.tsx`: the search screen (lazy route). `apps/app/src/client/range-calendar.tsx` (imported only by `buscar.tsx`).
- `apps/app/src/client/explore-map.tsx`: `ExploreMap` (box + idle loader), `MapLabel` (floating «Mapa»), `MapScreen` (full-screen overlay + compact card).
- `apps/app/src/client/explore-map-leaflet.ts`: `drawExploreMap`, its own chunk.
- Tests:
  - `tests/db/explorar-fechas-zona.test.ts`;
  - `tests/unit/search.test.ts`;
  - `tests/e2e/buscar.spec.ts`, `tests/e2e/explorar-mapa.spec.ts`.

Modify:
- Domain:
  - `src/domain/dates.ts`: `addDays`, `isoParts`, `costaRicaToday`, `formatInquiryDates`, `shortDate`, `longDateWithYear`. Moved here; the old modules re-export them.
  - `src/domain/calendar.ts`: re-export `addDays` from `./dates`.
  - `src/domain/inquiry.ts`: re-exports; `monthlyFrom` in fields, draft and storage.
  - `src/domain/filters.ts`, `src/domain/zones.ts` (`ZoneWithListings`), `src/domain/describe.ts` (`cardFacts`, `mapPriceLabel`), `src/domain/geo.ts` (`exploreMapView`).
  - `src/domain/contact-return.ts` (`DATES_FILTER_KEY`, `searchDatesValue`, `readSearchDates`), `src/domain/search-help.ts`, `src/domain/telemetry.ts`, `src/domain/api.ts`, `src/domain/database.types.ts`.
- Data and queries: `src/data/postgrest/listings.ts`, `src/data/fake/listings.ts`, `src/client/queries.ts` (`zonesQuery`).
- Client:
  - `src/client/chrome.tsx`: `AccountButton`, `TOP_BAR_PATHS`.
  - `src/client/shell.tsx`: routes `/explorar/buscar`, `validateSearch` with today.
  - `src/client/screens/explorar.tsx`, `src/client/screens/filtros.tsx`, `src/client/listing-card.tsx`, `src/client/search-help.tsx`.
- Shared: `src/shared/picture.tsx` (`priority`), `src/shared/icons.tsx` (`sliders`, `map`), `src/shared/contact-sheet.tsx`, `src/shared/beacon.ts`.
- Styles: `src/styles/global.css`.
- Size: `apps/app/.size-limit.json`.
- Tests:
  - contract `tests/contract/public-reads.contract.ts`, `tests/contract/calendar.contract.ts`, `tests/contract/points.ts` (`PUERTO_VIEJO`);
  - unit `filters`, `search-help`, `inquiry`, `contact-return`, `telemetry`, `worker`, `picture`, `architecture`, plus the B contrast test if it exists;
  - db `tests/db/telemetria.test.ts`;
  - e2e `explorar`, `contacto`, `navegacion`, `tipo-de-cambio`, `shell`, `app-instalada`, `no-encuentra`, `telemetria`, `medicion`, `no-disponible`, `portada`, `seguridad` (whichever Task 0 finds relying on the old layout).
- Docs: `docs/decisiones.md`, `docs/diseno-v1.md`, `docs/contacto-whatsapp.md`, `docs/telemetria.md`, `docs/antes-de-produccion.md`, `docs/pruebas-manuales-revision-ux.md`, `.scratch/revision-ux/2026-10-26-revision-ux.md` (A11), `CLAUDE.md` («Caribe por defecto» line).

Delete: `PEOPLE_OPTIONS` (filters.ts) and its test line; the `Header` function and `RootHeader` use in `explorar.tsx`.

---

## Task 0: Pre-flight (record only, change nothing)

**Files:** none. Write the answers as a short note at the top of your task report for later tasks. Do not edit code.

- [ ] **Step 1: What densidad-y-tarjetas (B+C) landed.**
  - `git log --oneline -25` and `ls .scratch/densidad-y-tarjetas/`.
  - Answer each:
    - Is there a `--gutter` custom property in `src/styles/global.css`, and what is it?
    - Is `--brand-ink` (`#B44C30`) defined, and under what name?
    - Do range or calendar colour variables exist (e.g. for `#D9775A` / `#F7E6D8`)? Record their names. If none exist, Task 8 adds `--range-end` and `--range-band`.
    - How do selected chips get their ✓: CSS `[aria-pressed=true]::before` or a component? Is the selected side of «₡ | $» bold?
    - Does `src/client/house-card.tsx` exist, and did B touch `src/client/listing-card.tsx`? The spec says B must not touch it.
    - Is the tab bar still 84 px with 26 px icons?
    - Is `CurrencySwitch` still exported from `src/shared/currency-switch.tsx`, and where is it used after B removed it from the ficha?
    - Does B's WCAG contrast unit test exist, and what is its path?
2. **Size baseline.** Run `pnpm build && pnpm size` in `apps/app`. Record:
   - the measured KB of «Zona privada · JS inicial» (spec: 144.25 KB before B), «Pantallas de las pestañas» and «Calendario»;
   - the current size of `leaflet-*.js` gz (spec: 42.9 KB);
   - any entries B added or renamed.

   This plan's initial-JS headroom is `150 − measured`. If it is under 4 KB, Task 10 starts with the fallback: `MapScreen` goes into its own chunk.
3. **Names still valid.** Confirm each still exists with the signature quoted in this plan, and record any drift:
   - `formatInquiryDates` («23–27 nov», «28 dic – 2 ene»), `costaRicaToday`, `longDate` in `dates.ts`, `addDays` in `calendar.ts`;
   - `PEOPLE_FILTER_KEY`, `extrasCount`, `resultsText`, `searchFor`, `normalizeSearch`;
   - `PROVINCE_CENTERS`, `caribeFirst`, `norm`, `whenIdle`;
   - `Picture` (no `priority` prop yet), `FavoriteButton`;
   - `TOP_BAR_PATHS` and `TopBar` in `chrome.tsx`; `SEARCH_LIMIT` in both adapters.
4. **Old-layout e2e.** Run `grep -ln "results-count\|search-pill\|Más filtros\|¿Para dónde\|listing-grid\|/explorar/filtros\|getByLabel(\"Personas\")\|topbar" apps/app/tests/e2e/*.ts`. Record the list; later tasks fix exactly these files. For each, note what it asserts about Explorar. Last known list: app-instalada, explorar, medicion, no-disponible, no-encuentra, navegacion, seguridad, portada, tipo-de-cambio, telemetria, shell.
5. **Zones in the local DB.** Run `pnpm db:reset`, then `sql("select id, active from zones where id in ('704-cocles','704-puerto-viejo','704-cahuita','704-playa-negra')")` (via `tests/db/local.ts` or `docker exec … psql`). Record that all are active. Also record the `place_at` row for `PUERTO_VIEJO = { lat: 9.6565, lng: -82.7536 }`; it is used by Task 4 seeds. If it returns no row, pick a point 300 m inland and record it.

## Task 1: Dates helpers and the Explorar URL (`zona`, `llegada`, `salida`, `desde`, `ppl` 1–50, `mapa`)

**Files:** modify `src/domain/dates.ts`, `src/domain/calendar.ts`, `src/domain/inquiry.ts`, `src/domain/filters.ts`, `src/client/queries.ts`, `src/client/shell.tsx` (validateSearch only), `src/client/screens/filtros.tsx` (drop the Personas select so it compiles; the full Filtros change is Task 9), `tests/unit/filters.test.ts`, `tests/unit/architecture.test.ts`, and a new `tests/unit/dates.test.ts` or extend the existing date tests.

**Interfaces:**
```ts
// dates.ts (moved; old modules re-export so callers do not change)
export function isoParts(date: string): [number, number, number] | null;
export function addDays(date: string, n: number): string;            // calendar.ts: export { addDays } from "./dates";
export function costaRicaToday(nowMs: number): string;               // inquiry.ts: export { costaRicaToday } from "./dates";
export function formatInquiryDates(arrival: string | null, departure: string | null): string; // re-exported by inquiry.ts
export function shortDate(date: string): string | null;              // «1 dic»
export function longDateWithYear(date: string): string | null;      // «23 de noviembre de 2026»

// filters.ts
export const SEARCH_MAX_PEOPLE = 50;
export const STAY_MAX_DAYS = 365;        // salida ≤ hoy + 365
export const MONTHLY_FROM_MAX_DAYS = 335;
export const MONTHLY_STAY_NIGHTS = 30;
export const ZONE_ID = /^[1-7][0-9]{2}-[a-z0-9-]+$/;
export interface Filters { prov: string; zone: string | null; arrival: string | null; departure: string | null; monthlyFrom: string | null;
  monthly: boolean; ppl: number; beds: number; features: Feature[]; min: number; max: number; open: boolean }
export interface ParseContext { today?: string; zoneIds?: readonly string[] }   // zoneIds undefined = not loaded yet: keep the zone
export function parseFilters(params: SearchParams, provinces: readonly string[], ctx?: ParseContext): Filters;
export type SearchKey = "prov" | "zona" | "llegada" | "salida" | "desde" | "mensual" | "ppl" | "beds" | "min" | "max" | "mas" | "mapa" | Feature;
export function normalizeSearch(params: SearchParams, today?: string): ExploreSearch;   // keeps `mapa`
export function toSearchParams(f: Filters, defaults: { prov: string }): URLSearchParams; // drops prov when zone; never writes mapa
export function effectiveFilters(f: Filters): Filters;  // monthly: arrival/departure null, min/max 0; else monthlyFrom null
export function stayRange(f: Filters): { from: string; to: string } | null; // monthly: [desde, desde+30); nightly: [llegada, salida)
export function extrasCount(f: Filters): number;        // beds + features + min + max (no zone, dates or people)
```
Rules:
- Without `today` (tests, old callers), dates get only shape and order checks.
- With `today`, the window rules of the Global Constraints apply. An invalid pair drops **both** `llegada` and `salida`. An invalid `desde` is dropped.
- `ppl` accepts any integer 1–50, otherwise 0. `zona` that fails the regex is dropped.
- `resultsText` moves to `search.ts` in Task 2. Leave a re-export from `filters.ts` until Task 2.

- [ ] **Step 1: Failing tests** (`tests/unit/filters.test.ts`, today = `"2026-11-01"`). Exact cases:
  ```ts
  const T = "2026-11-01";
  expect(normalizeSearch({ zona: "704-cocles", llegada: "2026-11-23", salida: "2026-11-27", ppl: "4" }, T)).toEqual({ zona: "704-cocles", llegada: "2026-11-23", salida: "2026-11-27", ppl: "4" });
  expect(normalizeSearch({ llegada: "2026-10-31", salida: "2026-11-02" }, T)).toEqual({});       // llegada ayer: fuera las dos
  expect(normalizeSearch({ llegada: "2026-11-01", salida: "2026-11-02" }, T)).toEqual({ llegada: "2026-11-01", salida: "2026-11-02" });
  expect(normalizeSearch({ llegada: "2026-11-05", salida: "2026-11-05" }, T)).toEqual({});       // salida = llegada
  expect(normalizeSearch({ llegada: "2026-11-05" }, T)).toEqual({});                              // una sola
  expect(normalizeSearch({ llegada: "2027-10-30", salida: "2027-11-02" }, T)).toEqual({});       // salida > hoy + 365
  expect(normalizeSearch({ llegada: "2027-10-31", salida: "2027-11-01" }, T)).toEqual({ llegada: "2027-10-31", salida: "2027-11-01" }); // = hoy + 365
  expect(normalizeSearch({ mensual: "1", desde: "2027-10-02" }, T)).toEqual({ mensual: "1", desde: "2027-10-02" }); // hoy + 335
  expect(normalizeSearch({ mensual: "1", desde: "2027-10-03" }, T)).toEqual({ mensual: "1" });
  expect(normalizeSearch({ ppl: "13" })).toEqual({ ppl: "13" });
  expect(normalizeSearch({ ppl: "51" })).toEqual({});
  expect(normalizeSearch({ ppl: "2.5" })).toEqual({});
  expect(normalizeSearch({ zona: "Cocles" })).toEqual({});
  expect(normalizeSearch({ mapa: "1" })).toEqual({ mapa: "1" });
  const f = parseFilters({ zona: "704-cocles", prov: "Guanacaste" }, ["Guanacaste", "Limón"]);
  expect(f.zone).toBe("704-cocles");
  expect(toSearchParams(f, { prov: "Limón" }).toString()).toBe("zona=704-cocles");   // la zona manda: sin prov
  expect(parseFilters({ zona: "704-cocles" }, ["Limón"], { zoneIds: ["704-puerto-viejo"] }).zone).toBeNull();
  const m = parseFilters({ mensual: "1", desde: "2026-12-01", llegada: "2026-11-23", salida: "2026-11-27" }, ["Limón"], { today: T });
  expect(stayRange(m)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  expect(stayRange({ ...m, monthly: false })).toEqual({ from: "2026-11-23", to: "2026-11-27" });
  expect(toSearchParams(m, { prov: "Limón" }).get("llegada")).toBe("2026-11-23");   // se conserva en la URL
  expect(extrasCount(parseFilters({ ppl: "4", zona: "704-cocles", llegada: "2026-11-23", salida: "2026-11-27", beds: "2" }, ["Limón"]))).toBe(1);
  ```
  - In the `listingsQuery` key test, add `listingsQuery(parseFilters({ mapa: "1" }, ["Limón"])).queryKey` equal to the key without `mapa`. Use the existing pattern, or add it to `filters.test.ts`, importing `../../src/client/queries`.
  - Remove the `PEOPLE_OPTIONS` assertion.
  - In `dates.test.ts`:
    - `shortDate("2026-12-01")` → «1 dic»; `longDateWithYear("2026-11-23")` → «23 de noviembre de 2026»;
    - `formatInquiryDates("2026-12-28","2027-01-02")` → «28 dic – 2 ene»; `addDays("2026-12-31", 1)` → «2027-01-01»;
    - `costaRicaToday(Date.parse("2026-11-02T05:30:00Z"))` → «2026-11-01».
  - In `architecture.test.ts` add: «el JS inicial de Explorar no arrastra trozos diferidos». `imports("domain/filters.ts")` and `imports("domain/search.ts")` (once it exists, so use `existsSync`) include neither `./calendar` nor `./inquiry`. `imports("client/explore-map.tsx")` and `imports("client/screens/explorar.tsx")` (if they exist) contain no `leaflet` and no `./explore-map-leaflet` / `../explore-map-leaflet`; only dynamic `import(` is allowed, and the regex `imports()` matches static `from` and bare `import "…"`, so a dynamic `import("…")` is not caught by it.
- [ ] **Step 2: Run** `pnpm test -- filters dates architecture`. Expected: FAIL (unknown keys dropped, `stayRange` undefined, `shortDate` undefined).
- [ ] **Step 3: Implement.**
  - Move the helpers into `dates.ts`, and re-export from `calendar.ts` and `inquiry.ts`. `inquiry.ts` uses `isoParts` from `./dates` instead of its own `parts`.
  - In `filters.ts`, extend `searchSchema`:
    - `zona`: regex, otherwise "";
    - `llegada`, `salida`, `desde`: `isoParts` check;
    - `ppl`: an integer transform 1–50;
    - `mapa`: flag.
  - The window rules go in one internal helper `stayFrom(p, today?)`, used by both `parseFilters` and `normalizeSearch`.
  - `listingsQuery` builds the key from `effectiveFilters(f)` minus `open`. `mapa` never reaches `Filters`.
  - `shell.tsx`: `validateSearch: (p) => normalizeSearch(p, costaRicaToday(Date.now()))` for `/explorar` and `/explorar/filtros`. Import from `../domain/dates`, not `inquiry`.
  - `filtros.tsx`: delete the `f-ppl` select and keep beds alone in that `grid-2`. This is temporary; Task 9 reshapes the section.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`. Expected: PASS. Fix the other unit tests that used `PEOPLE_OPTIONS` or `extrasCount` with `ppl`, keeping their intent.
- [ ] **Step 5: Commit.** `git add apps/app/src/domain/{dates,calendar,inquiry,filters}.ts apps/app/src/client/{queries,shell}.ts* apps/app/src/client/screens/filtros.tsx apps/app/tests/unit` · `git commit -m "Lee zona, fechas y personas de 1 a 50 en la URL de Explorar"`

## Task 2: Labels, range reducer and zone suggestions (`domain/search.ts`)

**Files:** create `src/domain/search.ts`, `tests/unit/search.test.ts`. Modify `src/domain/zones.ts`, `src/domain/filters.ts` (remove the `resultsText` re-export), `src/domain/search-help.ts`, `src/client/screens/explorar.tsx` (import path only), `tests/unit/search-help.test.ts`, `tests/unit/filters.test.ts` (move the `resultsText` cases).

**Interfaces:**
```ts
// zones.ts
export interface ZoneWithListings { id: string; name: string; cantonCode: string; canton: string; province: string; lat: number; lng: number; listings: number }
// search.ts (imports types and effectiveFilters/stayRange from ./filters, dates from ./dates, norm/caribeFirst from ./zones)
export function stayLabel(f: Filters): string | null;          // «23–27 nov» | «desde el 1 dic» | null (effective filters)
export function peopleLabel(n: number): string | null;          // «4 personas» | «1 persona» | null
export function searchSummary(f: Filters, zoneName: string | null): string | null; // joined « · », first char uppercased
export function resultsText(n: number, f: Pick<Filters, "prov" | "monthly" | "zone" | "arrival" | "departure" | "monthlyFrom">, zoneName?: string | null): { count: string; rest: string };
export interface RangeState { arrival: string | null; departure: string | null }
export function tapRange(s: RangeState, day: string): RangeState;
export function nightsBetween(arrival: string, departure: string): number;
export function nightsLabel(n: number): string;                  // «4 noches» | «1 noche»
export function monthlyWindowLabel(from: string): string;        // «Casas libres del 16 nov al 16 dic»
export function zoneSuggestions(zones: readonly ZoneWithListings[], query: string): ZoneWithListings[];
export function zonePlace(z: Pick<ZoneWithListings, "canton" | "province">): string;  // «Talamanca, Limón»
// search-help.ts
export function searchHelpMessage(f: Filters, zoneName?: string | null): string;
```
Rules:
- `tapRange` has three cases:
  - empty or complete range → `{ arrival: day, departure: null }`;
  - arrival only and `day > arrival` → `{ arrival, departure: day }`;
  - arrival only and `day <= arrival` → `{ arrival: day, departure: null }`.
- `zoneSuggestions` matches when `norm(query)` is empty or is a prefix of any word of `norm(name)`. Order: `caribeFirst`, then by name with `localeCompare("es")`.
- `searchHelpMessage` has two cases:
  - with a zone: `Zona: Cocles.` replaces the province line;
  - with dates: the last line becomes `Fechas: 23–27 nov.` (nightly) or `Fechas: desde el 1 dic.` (monthly). Without dates it stays `Fechas: `.
  - The file's header comment drops «porque Explorar no filtra por fechas».

- [ ] **Step 1: Failing tests** (`tests/unit/search.test.ts`):
  ```ts
  const base = parseFilters({}, ["Limón"]);
  const n = { ...base, zone: "704-cocles", arrival: "2026-11-23", departure: "2026-11-27", ppl: 4 };
  expect(searchSummary(n, "Cocles")).toBe("Cocles · 23–27 nov · 4 personas");
  expect(searchSummary({ ...base, monthly: true, monthlyFrom: "2026-12-01", ppl: 2 }, null)).toBe("Desde el 1 dic · 2 personas");
  expect(searchSummary({ ...base, ppl: 1 }, null)).toBe("1 persona");
  expect(searchSummary(base, null)).toBeNull();
  expect(searchSummary({ ...base, monthlyFrom: "2026-12-01" }, null)).toBeNull();          // sin el mensual, «desde» no cuenta
  expect(searchSummary({ ...base, monthly: true, arrival: "2026-11-23", departure: "2026-11-27" }, null)).toBeNull();
  expect(resultsText(12, base)).toEqual({ count: "12 casas", rest: " en Limón" });
  expect(resultsText(4, n, "Cocles")).toEqual({ count: "4 casas", rest: " en Cocles y alrededores · 23–27 nov" });
  expect(resultsText(3, { ...base, zone: "704-cocles", monthly: true, monthlyFrom: "2026-12-01" }, "Cocles")).toEqual({ count: "3 casas", rest: " aceptan alquiler mensual en Cocles y alrededores · desde el 1 dic" });
  expect(resultsText(1, { ...base, arrival: "2026-11-23", departure: "2026-11-27" })).toEqual({ count: "1 casa", rest: " en Limón · 23–27 nov" });
  expect(tapRange({ arrival: null, departure: null }, "2026-11-23")).toEqual({ arrival: "2026-11-23", departure: null });
  expect(tapRange({ arrival: "2026-11-23", departure: null }, "2026-11-27")).toEqual({ arrival: "2026-11-23", departure: "2026-11-27" });
  expect(tapRange({ arrival: "2026-11-23", departure: null }, "2026-11-23")).toEqual({ arrival: "2026-11-23", departure: null });
  expect(tapRange({ arrival: "2026-11-23", departure: null }, "2026-11-20")).toEqual({ arrival: "2026-11-20", departure: null });
  expect(tapRange({ arrival: "2026-11-23", departure: "2026-11-27" }, "2026-11-25")).toEqual({ arrival: "2026-11-25", departure: null });
  expect(nightsLabel(nightsBetween("2026-11-23", "2026-11-27"))).toBe("4 noches");
  expect(nightsLabel(1)).toBe("1 noche");
  expect(monthlyWindowLabel("2026-11-16")).toBe("Casas libres del 16 nov al 16 dic");
  const zones = [z("704-punta-uva","Punta Uva","704"), z("704-puerto-viejo","Puerto Viejo","704"), z("101-carmen","Carmen","101"), z("704-cocles","Cocles","704")];
  expect(zoneSuggestions(zones, "").map((x) => x.name)).toEqual(["Cocles", "Puerto Viejo", "Punta Uva", "Carmen"]);
  expect(zoneSuggestions(zones, "PU").map((x) => x.name)).toEqual(["Puerto Viejo", "Punta Uva"]);
  expect(zoneSuggestions(zones, "viejo").map((x) => x.name)).toEqual(["Puerto Viejo"]);
  expect(zoneSuggestions(zones, "erto")).toEqual([]);
  expect(zonePlace({ canton: "Talamanca", province: "Limón" })).toBe("Talamanca, Limón");
  ```
  - In `search-help.test.ts`:
    - `searchHelpMessage({ ...n }, "Cocles")` lines include «Zona: Cocles.» and end with «Fechas: 23–27 nov.» (no «Zona: Limón.»);
    - monthly ends with «Fechas: desde el 1 dic.»;
    - the existing cases still pass.
- [ ] **Step 2: Run** `pnpm test -- search search-help`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `search.ts`, `ZoneWithListings`, and the help message. Update imports of `resultsText` (`explorar.tsx`, tests).
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Añade el resumen de la búsqueda, el calendario de llegada y salida y las sugerencias de zona al dominio"` (paths: `apps/app/src/domain/{search,zones,filters,search-help}.ts`, `apps/app/src/client/screens/explorar.tsx`, `apps/app/tests/unit`).

## Task 3: Migration `explorar_fechas_y_zona` (RPC, view, telemetry columns)

**Files:** create `supabase/migrations/<ts>_explorar_fechas_y_zona.sql` (`pnpm exec supabase migration new explorar_fechas_y_zona < /dev/null` from the repo root) and `apps/app/tests/db/explorar-fechas-zona.test.ts`. Modify `apps/app/src/domain/database.types.ts` (generated) and `apps/app/tests/db/telemetria.test.ts`.

**Interfaces (SQL):**
- `public.search_listings(p_zone text default null, p_from date default null, p_to date default null) returns setof public.listings_public`, `language plpgsql stable security definer set search_path = ''`. The body is **verbatim from the spec** (§Data · SQL). It uses the real point `l.lat/l.lng` and `public.costa_rica_today()`. Then `revoke all … from public; grant execute … to anon, authenticated;`.
- `public.zones_with_listings`: the spec's view plus **`p.name as province`** (`join geo.admin_names p on p.code = left(z.canton_code, 1)`, also in `group by`). The mockup's line is «Talamanca, Limón». Columns: `id, name, canton_code, canton, province, lat, lng, listings`. No `security_invoker`. `grant select … to anon, authenticated`.
- Telemetry:
  - `alter table public.events drop constraint events_name_check; add constraint events_name_check check (name in ('page_view','listing_view','whatsapp_tap','inquiry_created','wizard_step','search_help_tap','monthly_filter_tap','search_submit','explore_map_open','map_marker_tap'));`
  - `alter table public.events add column search_flags text[] check (search_flags is null or (name = 'search_submit' and search_flags <@ array['zona','fechas','personas']::text[]));`
- No index (spec). No `UPDATE` of `listings` in this migration.

- [ ] **Step 1: Failing test** `tests/db/explorar-fechas-zona.test.ts`.
  - Setup: use `postgrestHarness()`, then `reset()` and `seed({ status: "active", draft: { title, zone: "Cocles", zoneSource: "other", zoneId: null } })`. Move each seeded house to its exact test point with `sql("begin; set local app.allow_status = 'on'; update public.listings set lat = …, lng = …, zone_id = … where id = '…'; commit;")`.
  - Points, relative to the Cocles zone point (9.643783, −82.730561), due south:
    - `KM4` = (9.607608, −82.730561);
    - `KM48` = (9.600374, −82.730561);
    - `KM6` = (9.589521, −82.730561);
    - `KM6Z` = `KM6` with `zone_id = '704-cocles'`.
  - Busy days: `h.putDay(id, { day, available: false, specialPriceCrc: null })`.
  - Dates: `T = costaRicaToday(Date.now())`, `A = addDays(T, 20)`, `S = addDays(T, 24)`.
  - Helper: `const ids = async (args) => (await anonClient().rpc("search_listings", args).select("public_id")).data!.map(r => r.public_id)`. Cases:
    - `{}` returns all active and open houses. A draft house is not returned. A closed house (`setAvailable(id, false, addDays(T, 5))`, so `reopen_at` < A) is not returned.
    - With `{ p_from: A, p_to: S }`:
      - a house busy on `addDays(A, 2)` is excluded;
      - a house busy on `addDays(S, -1)` is excluded;
      - a house busy on `S` is included;
      - a house busy on `addDays(A, -1)` is included.
    - With `{ p_zone: "704-cocles" }`: KM4 and KM48 are included, KM6 is not, KM6Z is.
    - `{ p_zone: "704-no-existe" }` → `[]`. An inactive zone (`select id from zones where not active limit 1`) → `[]`.
    - Each of these rejects with message `Revise las fechas.`:
      - `{ p_from: A }` (one date only);
      - `{ p_from: S, p_to: A }`;
      - `{ p_from: addDays(T,-1), p_to: A }`;
      - `{ p_from: A, p_to: addDays(T, 367) }`.

      And `{ p_from: addDays(T, 365), p_to: addDays(T, 366) }` resolves.
    - `anon` can call the RPC, and `anonClient().from("listings").select("id")` still errors (permission) or returns `[]`, matching what `tests/db/cliente-directo.test.ts` asserts today.
    - `zones_with_listings` (anon): it contains Cocles with `listings ≥ 1`, `canton: "Talamanca"`, `province: "Limón"`. It does not contain `701-limon-centro` (no house there). A draft house placed at the Limón centro point does not make Limón centro appear.
  - In `telemetria.test.ts`, add «acepta search_submit con search_flags y los rechaza en otro evento»:
    - inserting `{ name: "search_submit", search_flags: ["zona","fechas"], … }` succeeds;
    - `{ name: "page_view", search_flags: ["zona"] }` → error code `23514`;
    - `{ name: "search_submit", search_flags: ["precio"] }` → `23514`;
    - `explore_map_open` without a listing is accepted, and so is `map_marker_tap` with `listing_public_id`.
- [ ] **Step 2: Run** `pnpm test:db -- explorar-fechas-zona telemetria`. Expected: FAIL (function `search_listings` does not exist).
- [ ] **Step 3: Implement** the migration. Then `pnpm db:reset` (repo root) and `pnpm db:types` (apps/app).
- [ ] **Step 4: Run** `pnpm test:db`. Expected: PASS, and the whole db project stays green.
- [ ] **Step 5: Commit.** `git add supabase/migrations/*_explorar_fechas_y_zona.sql apps/app/src/domain/database.types.ts apps/app/tests/db` · `git commit -m "Añade search_listings y zones_with_listings: casas libres esas noches y a 5 km de la zona"`

## Task 4: Adapter, fake and contract (`searchPublic` via the RPC, `zonesWithListings`)

**Files:** modify `src/domain/api.ts`, `src/data/postgrest/listings.ts`, `src/data/fake/listings.ts`, `src/data/fake/places.ts` (export a canton/province name lookup for the fake), `src/client/queries.ts`, `tests/contract/public-reads.contract.ts`, `tests/contract/calendar.contract.ts`, `tests/contract/points.ts`.

**Interfaces:**
```ts
// api.ts, PublicListingsApi
/** Catálogo con filtros: RPC search_listings (zona a 5 km y noches libres) y encima provincia (solo sin zona), mensual,
 *  personas, habitaciones, características y precio; más recientes primero, como mucho 60. Rango inválido: «Revise las fechas.» */
searchPublic(filters: Filters): Promise<PublicListing[]>;
/** Zonas activas con alguna casa activa y abierta a 5 km o menos (o con esa zona), Caribe primero y por nombre. */
zonesWithListings(): Promise<ZoneWithListings[]>;
// queries.ts
export const zonesQuery: /* queryOptions */ { queryKey: ["zones-with-listings"]; staleTime: 600_000 };
```
- PostgREST:
  - `const r = stayRange(f); let q = db.rpc("search_listings", { p_zone: x.zone, p_from: r?.from ?? null, p_to: r?.to ?? null }).select(PUBLIC_COLUMNS)`;
  - then the existing filters, with `province` only when `!x.zone`;
  - drop `.eq("available", true)` (the RPC owns it);
  - `.order("created_at", { ascending: false }).limit(SEARCH_LIMIT)`.
  - `zonesWithListings`: `db.from("zones_with_listings").select("id, name, canton_code, canton, province, lat, lng, listings").order("name")`, mapped to camelCase, then `caribeFirst`.
- Fake:
  - The same validation as the SQL, throwing `new DomainError("Revise las fechas.")` (use the existing DomainError constructor/kind pattern in the fake).
  - Zone: `l.zoneId === zone || distanceMeters({lat,lng} of l, zonePoint) <= ZONE_RADIUS_M` on the **exact** `l.lat/l.lng`, with the zone looked up in `FAKE_ZONES`. An unknown zone → `[]`.
  - Busy: `db.days.get(l.id)` has any `!available` day in `[from, to)`.
  - `zonesWithListings`: `FAKE_ZONES` with ≥ 1 active, available house with a point (same 5 km / `zoneId` rule). `canton` and `province` come from `FAKE_DISTRICTS` by `code.startsWith(cantonCode)`.

- [ ] **Step 1: Failing contract cases.**
  - `points.ts`: `export const PUERTO_VIEJO: LatLng = { lat: 9.6565, lng: -82.7536 };` (or the point Task 0 recorded).
  - `public-reads.contract.ts`, new `describe("zona (5 km)")`:
    - Seed `pv` at `PUERTO_VIEJO` (`zone: "Puerto Viejo", zoneSource: "other", zoneId: null`), and `cahuita` with the default `COMPLETE` point.
    - `ids(filters({ zona: "704-cocles" }))` → `[pv.publicId]` (Puerto Viejo is ~2.9 km from Cocles).
    - `ids(filters({ zona: "704-cahuita" }))` → `[cahuita.publicId]`.
    - `ids(filters({ zona: "704-cocles", prov: "Guanacaste" }))` → `[pv.publicId]` (the zone wins over the province).
    - `zonesWithListings()` contains `{ id: "704-cocles", name: "Cocles", canton: "Talamanca", province: "Limón" }` and `704-puerto-viejo` (`expect.objectContaining`). It does not contain `701-limon-centro`.
    - After `setAvailable(pv.id, false)`, `704-cocles` is gone.
    - `searchPublic({ ...filters(), arrival: addDays(today, -1), departure: addDays(today, 2) })` rejects with «Revise las fechas.».
  - `calendar.contract.ts`, new `it("Explorar: solo casas libres todas esas noches y, con el mensual, 30 noches desde «Desde»")`:
    - `A = day(20)`, `S = day(24)`.
    - Seed `free`, `busyInside` (`putDay(day(22))`), `busyOnS` (`putDay(day(24))`), and `monthly` (`acceptsMonthly: true`, `putDay(day(10 + 29))`), plus `monthly2` (`acceptsMonthly: true`, `putDay(day(10 + 30))`).
    - `anon.searchPublic(parseFilters({ prov: "Todas", llegada: A, salida: S }, PROVINCES, { today: day(0) }))` contains `free` and `busyOnS`, and not `busyInside`.
    - With `{ mensual: "1", desde: day(10) }` → `[monthly2.publicId]`, which excludes `monthly` (busy on D + 29).
- [ ] **Step 2: Run** `pnpm test -- contract` (fake) and `pnpm test:db -- contract-postgrest contract-calendar`. Expected: FAIL (`zonesWithListings` is not a function; the zone is ignored).
- [ ] **Step 3: Implement** the adapter, the fake and `zonesQuery`.
- [ ] **Step 4: Run** `pnpm test && pnpm test:db`. Expected: PASS. Check that the ticket 20 case «anuncio pausado» still passes through the RPC.
- [ ] **Step 5: Commit.** `git commit -m "Explorar pide las casas a search_listings y lee las zonas con casas; el fake aplica las mismas reglas"` (paths: `apps/app/src/domain/api.ts`, `apps/app/src/data`, `apps/app/src/client/queries.ts`, `apps/app/tests/contract`).

## Task 5: Telemetry events (`search_submit` with flags, `explore_map_open`, `map_marker_tap`, page «buscar»)

**Files:** modify `src/domain/telemetry.ts`, `src/shared/beacon.ts`, `tests/unit/telemetry.test.ts`, `tests/unit/worker.test.ts`.

**Interfaces:**
```ts
// telemetry.ts
PAGE_TYPES gains "buscar"; pageType("/explorar/buscar") === "buscar"
events: name enum + "search_submit" | "explore_map_open" | "map_marker_tap";
        flags: z.optional(z.array(z.enum(["zona","fechas","personas"])).check(z.maxLength(3)))
NO_LISTING gains "search_submit", "explore_map_open"; map_marker_tap requires listing.
flags only with search_submit (otherwise 400); row: { name, search_flags?: string[], listing_public_id?, page, path, build }
// beacon.ts
export type EventName = … | "search_submit" | "explore_map_open" | "map_marker_tap";
export function trackSearch(flags: { zona: boolean; fechas: boolean; personas: boolean }): void; // sends only the true names, never values
```
- [ ] **Step 1: Failing tests.**
  - `parseBeacon("events", JSON.stringify({ name: "search_submit", flags: ["zona","personas"], path: "/explorar/buscar?zona=704-cocles", build: "abc" }))` → `{ ok: true, row: { name: "search_submit", search_flags: ["zona","personas"], page: "buscar", path: "/explorar/buscar", build: "abc" } }`.
  - `flags` on `page_view` → `{ ok: false, status: 400 }`. `flags: ["precio"]` → 400.
  - `map_marker_tap` without a listing → 400. `explore_map_open` without a listing → ok.
  - Worker test (copy the `monthly_filter_tap` case): `/events` writes `search_flags` and drops the query string.
- [ ] **Step 2: Run** `pnpm test -- telemetry worker`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Cuenta las búsquedas (solo qué se indicó), las aperturas del mapa y los toques en un marcador"`.

## Task 6: The WhatsApp message carries the search dates (`DATES_FILTER_KEY`, `monthlyFrom`)

**Files:** modify `src/domain/contact-return.ts`, `src/domain/inquiry.ts`, `src/shared/contact-sheet.tsx`, `src/client/screens/explorar.tsx` (the `Results` effect only), `tests/unit/contact-return.test.ts`, `tests/unit/inquiry.test.ts`, `tests/unit/contact-draft.test.ts` (if the store/restore cases live there), `tests/e2e/contacto.spec.ts`.

**Interfaces:**
```ts
// contact-return.ts (initial JS: must not import inquiry.ts)
export const DATES_FILTER_KEY = "bnbtico-fechas";
export type SearchDates = { arrival: string; departure: string } | { monthlyFrom: string };
export function searchDatesValue(range: { from: string; to: string } | null, monthly: boolean): string | null; // JSON or null (remove)
export function readSearchDates(raw: string | null, today: string): SearchDates | null;
// inquiry.ts
export interface InquiryFields { arrival?: string | null; departure?: string | null; people?: number | null; monthlyFrom?: string | null }
ContactDraftState gains monthlyFrom: string | null; StoredContactDraft gains monthlyFrom (missing = null, old drafts still restore)
```
- `composeInquiryMessage` cases:
  - Valid Llegada/Salida: today's sentence, and `monthlyFrom` is ignored.
  - Otherwise, with `monthlyFrom`: «Hola, vi {title} en bnbtico. Me interesa alquilar por meses desde el {longDate}{, para N personas}. ¿Está disponible? Gracias.»
- `readSearchDates` validity rules:
  - JSON with exactly `llegada`+`salida` (both `isoParts`-valid, `salida > llegada`, `llegada ≥ today`), or `desde` (`≥ today`); otherwise null.
- Sheet start, without a restored draft: `startDraft(title, { people: filteredPeople(maxPeople), ...datesFrom(readSearchDates(store.getItem(DATES_FILTER_KEY), today)) })`.
- `Results` effect: `searchDatesValue(stayRange(f), f.monthly)`. With a value it calls `setItem`; with null, `removeItem`.

- [ ] **Step 1: Failing tests.**
  - `contact-return.test.ts` (today `"2026-11-01"`):
    - `readSearchDates('{"llegada":"2026-11-23","salida":"2026-11-27"}', T)` → `{ arrival: "2026-11-23", departure: "2026-11-27" }`.
    - `'{"desde":"2026-12-01"}'` → `{ monthlyFrom: "2026-12-01" }`.
    - Each of these → null:
      - `'{"llegada":"2026-10-30","salida":"2026-11-02"}'`;
      - `'{"llegada":"2026-11-23","salida":"2026-11-23"}'`;
      - `'{"desde":"2026-10-31"}'`;
      - `"no-json"`;
      - `null`;
      - `'{"llegada":"2026-11-23"}'`.
    - `searchDatesValue({ from: "2026-11-23", to: "2026-11-27" }, false)` → `'{"llegada":"2026-11-23","salida":"2026-11-27"}'`.
    - `searchDatesValue({ from: "2026-12-01", to: "2026-12-31" }, true)` → `'{"desde":"2026-12-01"}'`.
    - `searchDatesValue(null, false)` → null.
  - `inquiry.test.ts`:
    - `composeInquiryMessage("Casa Cocles", { monthlyFrom: "2026-12-01", people: 4 })` and `{ monthlyFrom: "2026-12-01" }` give exactly the two monthly strings of the Global Constraints.
    - `{ arrival: "2026-11-23", departure: "2026-11-27", people: 4, monthlyFrom: "2026-12-01" }` → «Hola, vi Casa Cocles en bnbtico y me interesa. ¿Está disponible del 23 al 27 de noviembre para 4 personas? Gracias.»
    - `redraft` with `{ type: "fields", patch: { arrival, departure } }` on a monthly draft switches to the nightly sentence.
    - `restoreContactDraft(storeContactDraft(startDraft("Casa", { monthlyFrom: "2026-12-01" }), true, 0), "Casa", 1)` keeps `monthlyFrom`.
    - An old stored JSON without `monthlyFrom` restores with `monthlyFrom: null`.
  - `contacto.spec.ts`, new test «fechas: la hoja arranca con las de la búsqueda y el mensual escribe «desde el…»»:
    - `goto("/explorar?prov=Todas&llegada=${A}&salida=${S}&ppl=2")` with `A = day(20)`, `S = day(24)`; open the house; tap «Contactar por WhatsApp».
    - `Llegada (opcional)` has value A, `Salida (opcional)` has value S, and «Su mensaje» = `composeInquiryMessage(TITLE, { arrival: A, departure: S, people: 2 })`.
    - Then `goto("/explorar?prov=Todas&mensual=1&desde=${day(10)}")` on a monthly house (seed one with `acceptsMonthly: true` if the file has none). Clear the stored draft key for that house via `page.evaluate(() => sessionStorage.clear())` before navigating.
    - Open the sheet: Llegada is empty, and the message = `composeInquiryMessage(TITLE2, { monthlyFrom: day(10) })`.
- [ ] **Step 2: Run** `pnpm test -- contact-return inquiry contact-draft`. Expected: FAIL. The e2e is run in Step 4.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test`, then `pnpm build` and `pnpm test:e2e -- contacto`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "La hoja de contacto arranca con las fechas de la búsqueda y el mensual escribe «desde el…» en el mensaje"`.

## Task 7: Explorar header (no top bar), one card per row, first photo eager

**Files:** modify `src/client/chrome.tsx`, `src/client/screens/explorar.tsx`, `src/client/listing-card.tsx`, `src/client/search-help.tsx`, `src/shared/picture.tsx`, `src/shared/icons.tsx`, `src/domain/describe.ts`, `src/styles/global.css`. Tests: `tests/unit/picture.test.tsx`, a new `describe` block in `tests/unit/search.test.ts` (or the describe tests) for `cardFacts`/`mapPriceLabel`, and `tests/e2e/explorar.spec.ts` plus the old-layout specs from Task 0 (except the ones Tasks 9 and 10 own).

**Interfaces:**
```tsx
// chrome.tsx
export function AccountButton(): JSX.Element; // the old .topbar-slot content: «Ingresar» | initials «Cuenta» | invisible placeholder; TopBar uses it
const TOP_BAR_PATHS = new Set(["/favoritos", "/propietario/casas", "/propietario/calendario", "/propietario/actividad"]);
// picture.tsx
Picture({ …, priority?: boolean }) // priority: loading="eager" fetchPriority="high", no fadeIn; default lazy
// icons.tsx
I.sliders, I.map   // 24-grid stroke icons like the others (sliders: the mockup's two lines + circles)
// describe.ts
export function cardFacts(l: Pick<PublicListing, "capacity" | "bedrooms">): string;   // «4 personas · 2 habitaciones» | «2 personas · Estudio»
export function mapPriceLabel(l: PublicListing, monthly: boolean, currency: Currency, fx: number): string; // «₡42 000» | «$80» | «A negociar»
// explorar.tsx
function ExploreHeader({ filters, zoneName, search }: { filters: Filters; zoneName: string | null; search: ExploreSearch }): JSX.Element;
ListingCard({ listing, monthly, priority }: { listing: PublicListing; monthly?: boolean; priority?: boolean })
```
- The header is not sticky. It has a `.sr-only` `<h1>Explorar casas</h1>`, and a row with:
  - `<Link to="/explorar/buscar" search={search} className="search-pill">` showing `I.search` + `searchSummary(f, zoneName) ?? "Empiece su búsqueda"`. On `onPointerDown`/`onFocus` it runs `queryClient.prefetchQuery(zonesQuery)`; route preload comes from `defaultPreload: "intent"`.
  - `<AccountButton />`.
- `.chiprow`:
  - the monthly chip (as today, with `track("monthly_filter_tap")`);
  - a filters `Link` to `/explorar/filtros` with `I.sliders`, the aria-label from the Global Constraints, and the existing `badge` count;
  - `<CurrencySwitch />` pushed to the end (`margin-left: auto`).
- Then the results line (`data-testid="results-count"`) via `resultsText(n, f, zoneName)`, and `UsdNote`.
- Zone resolution:
  - `const zones = useQuery({ ...zonesQuery, enabled: !!search.zona })`;
  - while `search.zona && zones.isPending`, show the skeleton;
  - `parseFilters(search, provinces, { today: costaRicaToday(Date.now()), zoneIds: zones.data?.map((z) => z.id) })`;
  - `zoneName = zones.data?.find((z) => z.id === f.zone)?.name ?? null`.
- Card markup keeps the `a.listing-card` + `.photo` class names (the View Transition in `client/motion.ts` uses them):
  - `.photo` is 4:3 with 20 px corners, and `Picture` gets `sizes="100vw" width={800} height={600} priority={i === 0}`;
  - `FavoriteButton` outside the link, top right;
  - then `h2` name (Outfit), zone (muted), `cardFacts`, and the price line «₡42 000 / noche» (`cardPrice` + `formatMoney`).
  - No price pill and no «No disponible» pill.
- `.listing-grid` becomes `grid-template-columns: 1fr; gap: 24px`. The skeleton is one column: three skeleton cards with 4:3 boxes. Until Task 10, nothing is above the first card.
- `SearchHelp` passes `zoneName` to `searchHelpMessage`.

- [ ] **Step 1: Failing tests.**
  - `picture.test.tsx`: with `priority`, the rendered `img` has `loading="eager"` and `fetchpriority="high"`; without it, `loading="lazy"`.
  - `cardFacts`:
    - `{ capacity: 4, bedrooms: 2 }` → «4 personas · 2 habitaciones»;
    - `{ 1, 1 }` → «1 persona · 1 habitación»;
    - `{ 2, 0 }` → «2 personas · Estudio».
  - `mapPriceLabel`:
    - a nightly 42 000 house → «₡42 000»;
    - in USD at fx 525 → `formatMoney(42000,"USD",525)`;
    - monthly filter with `monthlyPriceCrc: null` → «A negociar».
  - `explorar.spec.ts`: replace the first test with «Explorar sin barra superior: píldora «Empiece su búsqueda», cuenta, filtros y ₡ | $»:
    - `page.locator(".topbar")` has count 0;
    - `getByRole("link", { name: "Empiece su búsqueda" })` is visible;
    - `getByRole("link", { name: "Ingresar" })` is visible;
    - `getByRole("group", { name: "Moneda de los precios" })` is visible;
    - `getByRole("link", { name: "Filtros" })` is visible;
    - `results` reads «9 casas en Limón»;
    - the first card's `img` has `loading="eager"`;
    - every card box has `width ≈ viewport − 2 × 16` (±1 px);
    - the first card text contains «2 personas · 1 habitación» and «₡41 000 / noche» (Casa Cocles 1, the newest of the six).
  - Rewrite the old asserts (`¿Para dónde va?`, `.search-pill` «Cualquier grupo», «Más filtros», `getByLabel("Personas")`) to the new names in `explorar.spec.ts` and the other files from Task 0's list. Each spec keeps its intent: e.g., `tipo-de-cambio` switches currency from Explorar's chip row; `navegacion` asserts that Explorar has no top bar and Favoritos still has it. The Filtros Personas-select steps in `explorar.spec.ts` change to `ppl=4` in the URL (Filtros is reshaped in Task 9).
- [ ] **Step 2: Run** `pnpm test -- picture search` (FAIL), then `pnpm build && pnpm test:e2e -- explorar navegacion tipo-de-cambio` (FAIL).
- [ ] **Step 3: Implement.** CSS:
  - `.explore-top{display:flex;gap:8px;align-items:center}`, `.explore-top .search-pill{flex:1;min-width:0}`;
  - `.chiprow .currency-switch{margin-left:auto}`;
  - `.listing-card .photo{aspect-ratio:4/3;height:auto;border-radius:20px}`;
  - remove `.listing-card .photo{height:168px}` and the `.sk.photo` height.
  - Use B's `--gutter` for any new margins.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm build && pnpm size`. «Zona privada · JS inicial» must be ≤ 150 KB; record the value. Then `pnpm test:e2e -- explorar navegacion tipo-de-cambio shell app-instalada no-encuentra medicion telemetria portada seguridad no-disponible`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Explorar sin barra superior: píldora de búsqueda, cuenta, filtros y ₡ | $ en la fila de chips, y una casa por fila"`.

## Task 8: Search screen `/explorar/buscar` (Dónde · Cuándo · Quiénes)

**Files:** create `src/client/screens/buscar.tsx`, `src/client/range-calendar.tsx`, `tests/e2e/buscar.spec.ts`. Modify `src/client/shell.tsx`, `src/styles/global.css`, `apps/app/.size-limit.json`.

**Interfaces:**
```ts
// shell.tsx (inside flow.addChildren, so FlowFrame: no tab bar)
type BuscarSearch = ExploreSearch & { abrir?: "donde" | "cuando" | "quienes" };
const buscarSearch = (p: Record<string, unknown>): BuscarSearch => ({ ...normalizeSearch(p, costaRicaToday(Date.now())), ...(p.abrir === "donde" || p.abrir === "cuando" || p.abrir === "quienes" ? { abrir: p.abrir } : {}) });
createRoute({ getParentRoute: () => flow, path: "/explorar/buscar", validateSearch: buscarSearch, component: lazyRouteComponent(() => import("./screens/buscar"), "BuscarScreen") })
// buscar.tsx
export function BuscarScreen(): JSX.Element;
interface SearchDraft { zone: string | null; arrival: string | null; departure: string | null; monthlyFrom: string | null; ppl: number }
// range-calendar.tsx (only buscar.tsx imports it; uses monthGrid from domain/calendar, not MonthGrid)
export function RangeCalendar(props: { today: string; mode: "range"; value: RangeState; onChange(v: RangeState): void } | { today: string; mode: "from"; value: string | null; onChange(v: string): void }): JSX.Element;
```
Behaviour:
- One card open at a time: the initial card is `abrir` or else `"donde"`. A closed card is a `button` with `aria-expanded="false"` and a name like «¿Dónde? Cocles» (title + current value or «Añadir …»).
- **¿Dónde?**
  - `role="combobox"` input with `aria-controls` → `role="listbox"`; options `role="option"` with the name and `zonePlace()`. Source: `useQuery(zonesQuery)` + `zoneSuggestions`.
  - Choosing a zone sets `zone`, closes the card and opens «¿Cuándo?». «Quitar» clears the zone. With no match, show «Todavía no hay casas en esa zona.» Always show the help line.
- **¿Cuándo?**
  - `mode = monthly ? "from" : "range"`, where monthly is `search.mensual === "1"`.
  - Months run from `today.slice(0,7)` to `addDays(today, 365).slice(0,7)`, stacked. Each month is a `section.range-month` with `content-visibility:auto; contain-intrinsic-size:auto 340px`, Monday first.
  - Day buttons use `aria-label={longDateWithYear(day)}` and `aria-pressed` for the ends. Disabled days: past days, beyond `today + 365`, and in "from" mode beyond `today + 335`.
  - The band is `.in-range`; the ends are `.range-end` (colours from Global Constraints or B's variables).
  - The header line follows the Global Constraints.
  - «Siguiente» opens «¿Quiénes?» without touching the dates. «Quitar fechas» clears them.
- **¿Quiénes?** Stepper `.people-stepper` with 0–50. Show «Sin indicar» at 0. «Una persona menos» is disabled at 0; «Una persona más» is disabled at 50.
- **Bottom bar** `.sticky-actions`:
  - «Borrar todo» (`btn-text`) sets `{ zone: null, arrival: null, departure: null, monthlyFrom: null, ppl: 0 }` in the draft only.
  - «Buscar» (`btn btn-primary grow` + `I.search`):
    - runs `trackSearch({ zona: !!zone, fechas: !!(arrival || monthlyFrom), personas: ppl > 0 })`;
    - `navigate({ to: "/explorar", search: searchFor({ ...parseFilters(search, provinces), ...draft }, provinces), replace: true, resetScroll: true })`;
    - then `window.scrollTo(0, 0)`.
- **Close ✕** (`aria-label` «Cerrar la búsqueda», `I.x`): `router.history.back()` when `useCanGoBack()`; otherwise `navigate({ to: "/explorar", search: without abrir, replace: true })`.
- `abrir` never reaches Explorar's URL.

- [ ] **Step 1: Failing e2e** `tests/e2e/buscar.spec.ts`.
  - Seed with `postgrestHarness`:
    - `coco` at `COCLES` (`zone: "Cocles", zoneSource: "list", zoneId: "704-cocles"`, capacity 4);
    - `ocupada` at `COCLES` (capacity 4, `putDay(day(22))`);
    - `cahuita` (default point);
    - `mensual` at `COCLES` (`acceptsMonthly: true`, capacity 4, `putDay(day(10 + 10))`);
    - `mensual2` at `COCLES` (`acceptsMonthly: true`, capacity 4);
    - `piscina` at `COCLES` (`features: ["pool"]`, capacity 4).
  - Stub tiles and storage.
  1. «buscar «coc» → Cocles, fechas y 4 personas»:
     - `goto("/explorar")`; tap «Empiece su búsqueda». The URL is `/explorar/buscar` and there is no `nav.tabbar`.
     - Fill «Busque una zona» with «coc»; the options are `[/^Cocles/]`; click it.
     - In the open ¿Cuándo? card, click the `day(20)` button by name `longDateWithYear(day(20))`, then `day(24)`. The text shows `formatInquiryDates(day(20), day(24))` and «4 noches».
     - Click «Siguiente», then «Una persona más» four times, then «Buscar».
     - The URL matches `zona=704-cocles`, `llegada=${day(20)}`, `salida=${day(24)}`, `ppl=4`.
     - The pill reads `Cocles · ${formatInquiryDates(day(20), day(24))} · 4 personas`.
     - There is a link for `coco` and none for `ocupada` or `cahuita`.
     - `results` = `3 casas en Cocles y alrededores · ${…}` (coco, mensual2 and piscina are free those nights; `mensual` is busy on `day(20)`).
     - `window.scrollY` is 0.
  2. «con «Solo alquiler mensual», «¿Cuándo?» pide «Desde» y deja fuera la ocupada el día 10»:
     - `goto("/explorar?mensual=1&zona=704-cocles")`; tap the pill. ¿Cuándo? shows the eyebrow «Solo alquiler mensual».
     - Click `day(10)`: the text shows `Desde el ${shortDate(day(10))}` and `monthlyWindowLabel(day(10))`. Click «Buscar».
     - The URL has `desde=${day(10)}`. The list has `mensual2` and not `mensual`.
  3. «Borrar todo quita zona, fechas y personas y conserva una característica»:
     - `goto("/explorar?zona=704-cocles&llegada=…&salida=…&ppl=4&pool=1")`; open the pill; click «Borrar todo», then «Buscar».
     - The URL is exactly `/explorar?pool=1`, and the pill reads «Empiece su búsqueda».
  4. «✕ vuelve sin aplicar»: open the pill, type «pu», choose Puerto Viejo, click «Cerrar la búsqueda». The URL is back to `/explorar` with no `zona`.
  5. «sin coincidencias»: fill «zzz» → «Todavía no hay casas en esa zona.» and no options.
  6. `?abrir=quienes` opens with «¿Quiénes?» expanded (`aria-expanded="true"`).
- [ ] **Step 2: Run** `pnpm build && pnpm test:e2e -- buscar`. Expected: FAIL (no route).
- [ ] **Step 3: Implement** the route, the screen, the calendar and the CSS (`.search-fold`, `.range-month`, `.range-day`, `.in-range`, `.range-end`, `.zone-option`). In `.size-limit.json`:
  - add `"!dist/client/assets/buscar-*.js"` to the initial entry;
  - add «Búsqueda de Explorar · trozo diferido (la pantalla de buscar: ¿Dónde?, el calendario de llegada y salida y ¿Quiénes?; se precarga al tocar la píldora)» with path `dist/client/assets/buscar-*.js`, limit `"6 KB"`, gzip.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm test && pnpm build && pnpm size`. Expected: PASS. Initial ≤ 150 KB, buscar ≤ 6 KB, and «Calendario» unchanged or smaller (it shares `calendar-*.js`). Then `pnpm test:e2e -- buscar explorar`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Añade la búsqueda a pantalla completa: ¿Dónde?, ¿Cuándo? y ¿Quiénes?, en un trozo aparte"`.

## Task 9: Filtros: rows «Zona · Fechas · Personas», province vs zone

**Files:** modify `src/client/screens/filtros.tsx`, `src/styles/global.css` (if needed), `tests/e2e/explorar.spec.ts` (the Filtros tests).

**Interfaces:**
- The first section is `role="group" aria-labelledby` «Su búsqueda». It has three `Link`s styled `.list-item` with a chevron:
  - each goes to `/explorar/buscar` with `search={{ ...searchFor(f, provinces), abrir }}`, where `abrir` is `donde`, `cuando` or `quienes`;
  - each shows its label and value per the Global Constraints.
- The zone name comes from `useQuery({ ...zonesQuery, enabled: !!f.zone })`.
- Province chips:
  - `aria-pressed={!f.zone && f.prov === prov}`;
  - `onClick` sets `prov` and **clears `zona`** in the draft.
- The «Habitaciones» select stays (alone). There is no Personas select.
- «Limpiar» is unchanged: it goes to `/explorar` and clears everything.

- [ ] **Step 1: Failing e2e** (in `explorar.spec.ts`).
  - «Filtros: «Su búsqueda» abre la búsqueda en su tarjeta y una provincia quita la zona»:
    - `goto("/explorar/filtros?zona=704-cocles&ppl=4")`. The group «Su búsqueda» has links with text «Zona Cocles», «Fechas Sin fechas», «Personas 4 personas».
    - `getByLabel("Personas")` has count 0.
    - Click «Personas»: the URL matches `/explorar/buscar?…abrir=quienes` and «¿Quiénes?» is expanded. Go back.
    - In group «Zona», no chip is pressed. Click «Todas», then «Ver N casas»: the URL has `prov=Todas` and no `zona`.
- [ ] **Step 2: Run** `pnpm build && pnpm test:e2e -- explorar`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm build && pnpm size && pnpm test:e2e -- explorar buscar`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Filtros: zona, fechas y personas abren la búsqueda; elegir una provincia quita la zona"`.

## Task 10: Map as the first item, floating «Mapa», full-screen map

**Files:** create `src/client/explore-map.tsx`, `src/client/explore-map-leaflet.ts`, `tests/e2e/explorar-mapa.spec.ts`. Modify `src/domain/geo.ts`, `src/client/screens/explorar.tsx`, `src/styles/global.css`, `apps/app/.size-limit.json`, `tests/unit/geo.test.ts`.

**Interfaces:**
```ts
// geo.ts
export const EXPLORE_MAP = { padding: 24, maxZoom: 15, zoneZoom: 13, provinceZoom: 10 } as const;
export function exploreMapView(points: readonly LatLng[], zone: LatLng | null): { fit: LatLng[] } | { center: LatLng; zoom: number };
// explore-map-leaflet.ts (own chunk; imports leaflet + its css, like approx-map-leaflet.ts)
export interface MapMarker { publicId: string; lat: number; lng: number; label: string; title: string }
export interface ExploreMapHandle { show(markers: MapMarker[], zone: LatLng | null): void; select(publicId: string | null): void; dispose(): void }
export function drawExploreMap(el: HTMLElement, opts: { interactive: boolean; onMarker(publicId: string): void; onMap(): void }): ExploreMapHandle;
// explore-map.tsx (initial JS; dynamic import only)
export function ExploreMap(props: { listings: PublicListing[]; zone: LatLng | null; monthly: boolean; onOpen(publicId: string | null): void }): JSX.Element;
export function MapLabel(props: { target: RefObject<HTMLElement>; onOpen(): void }): JSX.Element | null;  // IntersectionObserver
export function MapScreen(props: { listings: PublicListing[]; zone: LatLng | null; monthly: boolean; selected: string | null; onSelect(id: string | null): void; onClose(): void; header: ReactNode }): JSX.Element;
```
Behaviour:
- **Markers.** They are built from `listings.filter((l) => l.approx)` with `label = mapPriceLabel(l, monthly, currency, fx)`. Each is an `L.marker` with `L.divIcon({ className: "map-price", html: el, iconSize: null })`, where `el` is a `span` whose `textContent = label` and `title = l.title`. Clicks use `L.DomEvent.stopPropagation`.
- **Box.** `ExploreMap` renders `<div className="map-box explore-map" role="button" tabIndex={0} aria-label="Abrir el mapa de las casas" data-testid="explore-map">` as the **first child** of `.listing-grid`:
  - 220 px tall, 20 px corners, arena background;
  - Enter/Space → `onOpen(null)`; a map click → `onOpen(null)`; a marker click → `onOpen(id)`.
  - It loads with `whenIdle(() => import("./explore-map-leaflet"))` after mount, with `interactive: false` (no drag, zoom or keyboard). The catch is silent, so the box stays arena with no text.
  - The OSM attribution control stays visible.
- **Floating label.** `MapLabel` observes the box. It renders `<button className="map-label">` (`I.map` + «Mapa») only while the box is out of view **above** the viewport (`entry.boundingClientRect.bottom < 0`). It is fixed, centred, `bottom: calc(84px + 16px + env(safe-area-inset-bottom))`.
- **Opening the full map.** `navigate({ to: "/explorar", search: { ...search, mapa: "1" }, resetScroll: false })`, plus `track("explore_map_open")`. A marker sets `selected` (local state, initialised from the tapped id) and runs `track("map_marker_tap", publicId)`.
- **Full map.** It renders when `search.mapa === "1"`. The overlay `.map-full` is `position:fixed; inset: 0 0 calc(84px + env(safe-area-inset-bottom)) 0; z-index:5`, and the list stays mounted beneath it, so its scroll is kept.
  - `header`: a back `button` «Volver a la lista», the `search-pill` Link and the filters Link (mockup 05).
  - `interactive: true`.
  - Pill: `<button className="map-count">` showing `resultsText(n, f).count`. It closes with `router.history.back()` if `useCanGoBack()`, else `navigate({ search: without mapa, replace: true, resetScroll: false })`.
  - A selected marker gets `.is-selected`, and a compact `MapCard` sits at the bottom: a `Link` to the ficha with a 96 px square photo on the left, the name, the zone, `cardPrice` per night and `FavoriteButton`. A map click deselects.
  - `html.map-open{overflow:hidden}` is toggled while open.
- Results order: the map box, then the cards. `MapLabel` and `MapScreen` render outside `.listing-grid`.
- **Size.** Add `"!dist/client/assets/explore-map-leaflet-*.js"` to the initial entry. New entries:
  - «Mapa de Explorar · trozo diferido (los marcadores de precio y el mapa a pantalla completa; Leaflet aparte)», path `explore-map-leaflet-*.js`, limit `"2.5 KB"`;
  - «Leaflet · trozo compartido (la ficha, el asistente de publicar y Explorar)», path `leaflet-*.js`, limit `"44 KB"`.
- **Fallback.** If the initial gate goes over 150 KB, move `MapScreen` + `MapCard` into `src/client/explore-map-full.tsx` (lazy `import()` when `mapa=1`). Add exclusion `!dist/client/assets/explore-map-full-*.js` and a new entry «Mapa de Explorar a pantalla completa · trozo diferido», limit = measured + 0.3 KB rounded up to 0.5 KB. Never raise 150 KB.

- [ ] **Step 1: Failing tests.**
  - `geo.test.ts`:
    - `exploreMapView([], null)` → `{ center: PROVINCE_CENTERS.Limón, zoom: 10 }`;
    - `exploreMapView([], { lat: 9.64, lng: -82.73 })` → `{ center: { lat: 9.64, lng: -82.73 }, zoom: 13 }`;
    - `exploreMapView([p1, p2], z)` → `{ fit: [p1, p2] }`.
  - `explorar-mapa.spec.ts` (seed 8 active houses in Limón, at least one with `nightlyPriceCrc: 42000`; tiles stubbed):
    1. «el mapa es el primer elemento de la lista y lleva precios»:
       - `.listing-grid > :first-child` has `data-testid="explore-map"` and a bounding box height of 220 (±1);
       - `.map-price` count = 8; `getByText("₡42 000", { exact: true })` is visible inside it;
       - `.leaflet-control-attribution` is visible.
    2. «al bajar aparece «Mapa»; a pantalla completa «8 casas»; un marcador muestra su casa; Atrás cierra y conserva el scroll»:
       - Before scrolling, `getByRole("button", { name: "Mapa" })` has count 0.
       - `page.evaluate(() => window.scrollTo(0, 600))`; the «Mapa» button is visible; record the number of `rpc/search_listings` requests (`page.on("request")`).
       - Click «Mapa». The URL has `mapa=1`; `getByRole("button", { name: "8 casas" })` is visible; `.map-full .map-price` count = 8.
       - Click the `.map-full .map-price` with text «₡42 000». A link with that house's title is visible inside `.map-full`, and its `href` is `/casa/CT-…`.
       - `page.goBack()`: `.map-full` count is 0; `await page.evaluate(() => scrollY)` is 600 (±2); no new `search_listings` request.
       - Open again via `getByTestId("explore-map").click()`, then click «8 casas». The map is closed.
    3. «sin red para el mapa, la caja se queda y la lista funciona»:
       - Before `goto`, `page.route("**/assets/explore-map-leaflet-*.js", r => r.abort())` and `page.route("**/assets/leaflet-*.js", r => r.abort())`.
       - The `explore-map` box is visible with `.leaflet-container` count 0 and no text (`toHaveText("")`).
       - The first card link is visible and clickable.
    4. Telemetry: after opening the map and tapping a marker, `sql("select name, listing_public_id from public.events where created_at >= …")` polls to contain `explore_map_open` (null listing) and `map_marker_tap` with the house's `CT-…`. Copy the pattern of `contacto.spec.ts`.
- [ ] **Step 2: Run** `pnpm test -- geo` (FAIL), then `pnpm build && pnpm test:e2e -- explorar-mapa` (FAIL).
- [ ] **Step 3: Implement.** CSS:
  - `.map-price{background:var(--brand-ink);color:#fff;border-radius:999px;padding:4px 10px;font:700 13px/1 var(--display);white-space:nowrap;box-shadow:var(--shadow-float);transform:translate(-50%,-50%)}`;
  - `.map-price.is-selected{background:var(--fg)}`;
  - `.explore-map{height:220px;border-radius:20px;background:<arena token>}`;
  - `.map-label`, `.map-full`, `.map-count`, `.map-card`.

  Use B's variable names from Task 0.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm test && pnpm build && pnpm size`. Expected: PASS. Initial ≤ 150 KB, map ≤ 2.5 KB, leaflet ≤ 44 KB; record all three values. Then `pnpm test:e2e -- explorar-mapa explorar buscar app-instalada`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "El mapa con precios es el primer elemento de Explorar; «Mapa» lo abre a pantalla completa y «N casas» vuelve a la lista"`.

## Task 11: Documentation (same day, 2026-10-29)

**Files:**
- `docs/decisiones.md`: new entry **at the top**, `## 2026-10-29 · Explorar al estilo Airbnb`.
- `docs/diseno-v1.md`: l.20–21 rewritten.
- `docs/contacto-whatsapp.md`: the messages.
- `docs/telemetria.md`: the three events, `search_flags`, page `buscar`, and the p75 query note for `/explorar/buscar`.
- `docs/antes-de-produccion.md`: the OSM tile usage policy check against launch traffic, and the decision on a tile provider.
- `docs/pruebas-manuales-revision-ux.md`: new section «### Explorar al estilo Airbnb (2026-10-29)», using the next free U numbers after B's.
- `.scratch/revision-ux/2026-10-26-revision-ux.md`: under A11, one line «Superada el 2026-10-29: filtro de fechas construido (`.scratch/explorar-airbnb/spec.md`); se mantiene «nunca "Disponible"».».
- `CLAUDE.md`: in «Caribe por defecto», append «; con una zona elegida en la búsqueda, manda la zona (casas a 5 km o menos)». Also, under «Reglas de producto», one line: «Explorar filtra por fechas libres (todas las noches de llegada a salida; mensual: 30 noches desde «Desde»); las casas cerradas nunca salen.»

- [ ] **Step 1: Write the decisiones entry.** Cover each point of the spec's «Documentation» list:
  - Explorar structure: pill, no top bar, ₡ | $ in the chip row;
  - the search screen;
  - zone search ≤ 5 km over zones with houses;
  - the date filter now (A11 trigger dropped);
  - monthly «Desde» = 30 nights;
  - closed houses always out;
  - the map as first item and the full-screen map;
  - one card per row;
  - dates and monthly start in the WhatsApp message.

  Also record this plan's resolutions:
  - mockup copy over spec copy: «y alrededores», «Talamanca, Limón», «Cerrar la búsqueda», the monthly line «Casas libres del … al …», «Añadir …»;
  - range colours per B's ruling;
  - `704-cocles`;
  - `search_flags` column;
  - province in `zones_with_listings`.
- [ ] **Step 2: Write the manual recorridos.** On a real iPhone and Android, check:
  - the pill under the notch;
  - the search keyboard over the zone list;
  - range taps across months;
  - the floating «Mapa» above the tab bar;
  - full-screen map pinch and drag;
  - Back closes the map;
  - the WhatsApp message with dates and with «Desde».
- [ ] **Step 3: Verify docs.** `grep -n "¿Para dónde va?" docs/diseno-v1.md` returns nothing; `pnpm test:prototype` (repo root) still passes, since the prototype is untouched.
- [ ] **Step 4: Commit.** `git add docs CLAUDE.md .scratch/revision-ux/2026-10-26-revision-ux.md` · `git commit -m "Documenta Explorar al estilo Airbnb: búsqueda, fechas libres, zona a 5 km, mapa y mensaje con fechas"`.

## Task 12: Final verification

- [ ] **Step 1: Run** from `apps/app`: `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`, `pnpm size`. Then the full e2e: `VITE_WA_GUESTS="+506 6000 0000" CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e` (one worker). Then `pnpm lighthouse`. From the repo root: `pnpm test:prototype`. All are green. Lighthouse: ficha < 2.0 s and shell installed `/explorar` < 2.5 s. The shell LCP element should be the first card's photo; if it is not, check `priority` on card 0.
- [ ] **Step 2: Size report.** List every size entry with measured/limit. Confirm that no existing limit changed (`git diff <start-sha> -- apps/app/.size-limit.json` shows only the added exclusions and the three new entries, plus the fallback entry if Task 10 used it).
- [ ] **Step 3: Spec coverage walk.** Tick each spec section against a task:
  - §1 → T7; §2 → T8; §3 → T9; §4 → T7 + T10; §5 → T3 + T4; §6 → T6;
  - Data/URL → T1; SQL → T3; adapter → T4; telemetry → T3 + T5; size → T8 + T10; docs → T11;
  - Playwright 1 → T7; 2, 3 and 7 → T8; 4 → T6; 5 and 6 → T10.
- [ ] **Step 4: No commit** unless a fix was needed (then `git commit -m "Arregla <lo que fuera> tras la verificación final de Explorar"`). Never push.

---

## Self-review notes (resolved ambiguities)

- **Zone id.** Cocles is `704-cocles` (Talamanca 704), not `701-cocles`.
- **Copy where mockup and spec differ.** The mockup wins on copy:
  - «8 casas en Cocles y alrededores» (spec: «en Cocles»);
  - option line «Talamanca, Limón» (spec: «Cocles · Talamanca»), so the view gains `province`;
  - close «Cerrar la búsqueda» (spec: «Cerrar»);
  - monthly line «Desde el 16 nov» + «Casas libres del 16 nov al 16 dic» (spec: «Desde el 1 de diciembre» / «Le mostramos las casas libres el mes siguiente»);
  - nightly «23–27 nov» + «4 noches» (spec: «23 nov – 27 nov · 4 noches»);
  - «Añadir fechas/personas» on closed cards;
  - the Quiénes note.

  The filters button keeps the spec's accessible name «Filtros» (behaviour, not looks), with the count: «Filtros (2 activos)».
- **Range colours.** B's accessibility ruling (`#D9775A` ends, `#F7E6D8` band) replaces the spec's «salvia».
- **`search_submit` flags.** The `events` table has no payload column, so this plan adds `search_flags text[]`, allowed only on `search_submit` and limited to `zona|fechas|personas`. The page type `buscar` is added for the p75 note.
- **«Hoy» in URL validation.** It is passed explicitly: `normalizeSearch(p, today)` and `parseFilters(…, { today })`, so the domain stays pure. Date helpers move to `dates.ts` so the initial JS never imports the `calendar-*` or `inquiry-*` chunks.
- **Zone validity.** `zona` is checked against `zones_with_listings` only when that list is loaded. Explorar waits for it only when `zona` is present.
- **Full-screen map.** It is an overlay over the still-mounted list (`resetScroll: false`, Back via history), so the scroll is kept without custom restoration. The mockup's top row (back, pill, filters) is included.
- **Search-help message.** It now uses the zone and the dates; it would otherwise say «Zona: Limón» during a Cocles search.
- **Day `aria-label`s carry the year**, because the 13-month window repeats the current month a year later.
