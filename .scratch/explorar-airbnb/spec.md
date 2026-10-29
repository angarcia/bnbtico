# Spec · Explorar al estilo Airbnb: Dónde · Cuándo · Quiénes, fechas libres y el mapa en la lista

Status: needs-triage
Date: 2026-10-28
Decided by: Daniel, question by question on 2026-10-28/29, from Ana's emails of 2026-10-28 (Airbnb screenshots as a reference for **structure, not style**). Authority: `.scratch/ronda-ana-2026-10-28/decisiones.md`, section **A**.
Language note: technical artifact in English; all UI copy in Spanish de Costa Rica, treating the user as **usted**.
Supersedes:
- `docs/diseno-v1.md` l.20 (Explorar: H1 «¿Para dónde va?», search summary, «Más filtros» chip, results line, two-column grid) and l.21 (Filtros: zone = provinces only, Personas select).
- Revisión UX **A11** (`.scratch/revision-ux/2026-10-26-revision-ux.md` l.241, «sin filtro de fechas» until more than half of active houses mark busy nights): Daniel decides to build the date filter now, without waiting for that trigger. The A11 rule «nunca "Disponible"» is kept in the copy (see Solution §5).
- `.scratch/navegacion-simple/spec.md` and `docs/decisiones.md` (2026-10-27 «Navegación simple»): the fixed top bar (logo · ₡ | $ · cuenta) no longer shows on Explorar; ₡ | $ moves to Explorar's chip row there. The other four tabs keep the top bar.
- `CLAUDE.md` «Caribe por defecto: Explorar arranca en Limón» stays true when no zone is chosen; with a zone, the zone replaces the province.
Related: `.scratch/densidad-y-tarjetas/spec.md` (B: gutter, icon sizes, button rules), `.scratch/ubicacion-por-punto/spec.md` (`zones`, `zones_near`, the 5 km radius), `.scratch/mensual-como-caracteristica/spec.md` («Solo alquiler mensual»).
Visual authority, once Daniel approves it: `design/pantallas/v2/01-explorar-resultados` and the search and full-screen map mockups drawn alongside it in `design/pantallas/v2/`.

## Order and dependencies

Second project (B+C → **A** → D → E → F+G). Depends on B for the 16 px gutter and the one-filled-button rule. Independent of D, E, F+G. The contact sheet change (§6) touches `shared/contact-sheet.tsx`, which no other project of the round touches.

## Problem Statement

Explorar today is a title, a summary pill that opens Filtros, two chips, a results line and a two-column grid of small cards:

- There is **no way to say when**. A client planning 23–27 November sees every house, including the ones whose owner already marked those nights busy, and the WhatsApp message does not carry the dates unless typed again in the sheet.
- **Where** is only a province. Almost every house is in Limón, so the province filter does nothing; people think in towns and beaches («Cocles», «Puerto Viejo»).
- **Who** is a select of fixed values (2, 4, 6, 8, 12) hidden in Filtros.
- There is **no map**, though the houses have approximate points and the map is how people judge «near the beach».
- Cards are small; at 375 px two columns leave a 168 px photo.

## Solution

### 1. Explorar header (no top bar)

`client/chrome.tsx`: remove `"/explorar"` from `TOP_BAR_PATHS`. `client/screens/explorar.tsx` replaces `Header`/`RootHeader` with its own header:

```
[ 🔍 Empiece su búsqueda                 ]  (JM)
[ Solo alquiler mensual ] [ ⚙ 2 ]      ₡ | $
```

- **Search pill** (full width minus the account button). Text: «Empiece su búsqueda» when no zone, dates or people are set; otherwise the summary, joining what is set with « · »: zone name (or nothing), dates («23–27 nov», `formatInquiryDates`; monthly: «desde el 1 dic»), people («4 personas», «1 persona»). Examples: «Cocles · 23–27 nov · 4 personas», «Desde el 1 dic · 2 personas». Tapping it opens the search screen (§2).
- **Account button** at the right: the same element as the top bar's (initials in a circle, «Ingresar» signed out, invisible placeholder while the session is read). Extract it from `TopBar` as `AccountButton` in `chrome.tsx`; `TopBar` uses it too.
- **Chip row** below: «Solo alquiler mensual» (as today), a **filters button** (new icon `I.sliders` in `shared/icons.tsx`, accessible name «Filtros», with the existing count badge `extrasCount`), and **«₡ | $»** (`CurrencySwitch`) pushed to the end. «Más filtros» as text goes away.
- The results line (`data-testid="results-count"`) stays under the chip row: «12 casas en Limón», «4 casas en Cocles», «4 casas en Cocles · 23–27 nov», «3 casas aceptan alquiler mensual en Cocles · desde el 1 dic». The USD note stays below it when dollars are on.
- The page scrolls under nothing: the header is not sticky.

### 2. Search screen (full screen)

New route `/explorar/buscar` (`validateSearch`: `normalizeSearch` plus `abrir`, see §3), in `FlowFrame` (no tab bar), loaded **lazily** in its own chunk `buscar-*.js` (`lazyRouteComponent`), preloaded on pointer-down / focus on the pill. Header: a close button (✕, «Cerrar», goes back without applying). Three collapsible cards, one open at a time; a closed card shows its title and current value («¿Dónde?  Cocles»).

1. **¿Dónde?** (open first). A combobox «Busque una zona».
   - Focus with empty text lists **the zones that have houses** (`zones_with_listings`, §Data), Caribe first (`caribeFirst`), then by name; each option shows the name and, muted, the cantón («Cocles · Talamanca»).
   - Typing filters the same list with `norm` (`domain/zones.ts`: no accents, case-insensitive), by prefix of any word. No recent searches, no «cerca de mí», no popular destinations, no Photon.
   - No match: «Todavía no hay casas en esa zona.» and the list stays empty.
   - Choosing a zone closes the card and opens «¿Cuándo?». A small «Quitar» clears the zone.
2. **¿Cuándo?**
   - Without «Solo alquiler mensual»: a range calendar, months stacked vertically from the current month to today + 365, Monday first, past days disabled. First tap = llegada, second tap on a later day = salida; a tap before or on llegada restarts. The range is highlighted (salvia); the header line reads «23 nov – 27 nov · 4 noches». Built on `monthGrid()` from `domain/calendar.ts` (pure), not on `MonthGrid` (which carries prices and owner semantics).
   - With «Solo alquiler mensual» on: one date, **«Desde»**; the header line reads «Desde el 1 de diciembre» and a muted line «Le mostramos las casas libres el mes siguiente».
   - «Siguiente» (outline) skips the card without dates; «Quitar fechas» clears them.
3. **¿Quiénes?** Only «Personas», with − / + (0 = «Sin indicar», up to 50 = `INQUIRY_MAX_PEOPLE`).

Fixed bottom bar: «Borrar todo» (text button: clears zone, dates and people only; other filters stay) and **«Buscar»** (filled, `btn-primary`, with the search icon). «Buscar» navigates to `/explorar` with the new search (replace), and the results scroll to the top.

### 3. Filters screen

`/explorar/filtros` keeps everything else (características, habitaciones, precio por noche, «Solo alquiler mensual», provincias). Its first section becomes three rows «Zona», «Fechas», «Personas» showing the current values; tapping one opens `/explorar/buscar` at that card (`?abrir=donde|cuando|quienes`, not persisted in Explorar's URL). The Personas select (`PEOPLE_OPTIONS`) is removed from Filtros. Province chips stay: choosing a province clears the zone; choosing a zone hides the province chips' selection (the zone wins).

### 4. Results: one house per row and the map as the first item

**Card** (`client/listing-card.tsx`, one per row; the `.listing-grid` becomes a single column):

- Large photo, 4:3, 20 px corners, `Picture` with `sizes="100vw"` (`width={800} height={600}`); the first card's photo is `loading="eager"` with `fetchpriority="high"` (it is the LCP of the installed shell once the map is a fixed box), the rest lazy.
- Heart top right (`FavoriteButton`, outside the link, as today). «No disponible» pill no longer needed (closed houses are not listed).
- Below: **name** (Outfit), **zone** (muted), «4 personas · 2 habitaciones» («1 persona», «1 habitación», «Estudio» for 0 bedrooms), and the price, **always per night**: «₡42 000 / noche» (`cardPrice`), also when dates are set; with «Solo alquiler mensual»: «₡350 000 / mes» or «Precio a negociar». Never a total.
- The price pill on the photo goes away (the price is in the text).

**Map as the first list item** (decision A):

- `ExploreMap` (initial JS, tiny) renders a box of **fixed height 220 px**, 20 px corners, arena background, as the first child of the results list, above the first card. It is not sticky: scrolling down moves it away.
- After the first paint and when idle (`shared/idle.ts`), it imports `client/explore-map-leaflet.ts` (own chunk; Leaflet itself stays in the shared `leaflet-*.js` chunk). No button to activate it. Offline or if the import fails, the arena box stays (no error text).
- Markers are **price pills** (`L.divIcon`, `.map-price`): «₡42 000» (or «$80» in dollars, `formatMoney`; with «Solo alquiler mensual»: monthly price or «A negociar»). Positions are the **approximate** points from `listings_public` (`approx`); houses without a point are not on the map. Bounds fit the markers (padding 24 px, max zoom 15); with a zone and no markers, the zone point at zoom 13; with neither, `PROVINCE_CENTERS.Limón`.
- Tapping the small map opens the full-screen map; tapping a marker on it opens the full-screen map with that house's card already shown. OSM attribution stays visible.

**Floating «Mapa» label:** when the map box has scrolled out of view (`IntersectionObserver`), a floating pill «Mapa» (new icon `I.map` + text, centred above the tab bar) appears; tapping it opens the full-screen map.

**Full-screen map:** `/explorar` with `?mapa=1` (so Back closes it; `mapa` is part of `normalizeSearch` but not of the query key). It reuses the same Leaflet module on a full-height box above the tab bar. A floating pill **«N casas»** (`resultsText(n).count`) returns to the list (`mapa` removed, scroll position kept). Tapping a marker highlights it and shows that house's card at the bottom (compact: photo left, name, zone, price, heart); tapping the card opens the ficha. Tapping the map elsewhere hides the card.

### 5. Date availability rule

- Nightly search with llegada **A** and salida **S**: the house appears only if it is **free every night** from A to S − 1: no `listing_days` row with `available = false` in `[A, S)`.
- Monthly search with **«Desde» D**: free every night of `[D, D + 30)`.
- A **closed** house (`listings.available = false`) never appears, whatever its `reopen_at`: it cannot be contacted now (`create_inquiry` refuses `unavailable`), and today's Explorar already hides it.
- Special prices do not matter for the filter.
- Copy never says «Disponible» (A11): the results line says «· 23–27 nov», and the search screen says «casas libres esas noches» only in the help line of ¿Cuándo?.

### 6. The WhatsApp message carries the dates and people

- `Results` already writes people to sessionStorage (`PEOPLE_FILTER_KEY = "bnbtico-personas"`). Add **`DATES_FILTER_KEY = "bnbtico-fechas"`** in `domain/contact-return.ts`, written by `Results` on each search: `{"llegada":"2026-11-23","salida":"2026-11-27"}`, or `{"desde":"2026-12-01"}` with «Solo alquiler mensual», removed when there are no dates.
- `shared/contact-sheet.tsx`: when the sheet starts (no stored draft), it reads both keys; dates are used only if valid and not before today (`validateInquiryDraft` rules), and people only up to the house capacity (as today).
  - Nightly dates prefill **Llegada** and **Salida**; the composed message is today's: «Hola, vi Casa Cocles en bnbtico y me interesa. ¿Está disponible del 23 al 27 de noviembre para 4 personas? Gracias.»
  - Monthly «Desde» does **not** fill Llegada/Salida. `InquiryFields` gains `monthlyFrom?: string | null`, and `composeInquiryMessage` writes, while Llegada and Salida are empty: «Hola, vi Casa Cocles en bnbtico. Me interesa alquilar por meses desde el 1 de diciembre, para 4 personas. ¿Está disponible? Gracias.» (without people: «… desde el 1 de diciembre. ¿Está disponible? Gracias.»). If the client fills Llegada/Salida, the nightly sentence replaces it.
- `create_inquiry` does not change: the monthly start travels in the message. The Actividad card shows «sin fechas» for it, and the owner reads the date in the message, shown on the same card.
- The contact draft keeps working as today (`storeContactDraft`, 30 min); `monthlyFrom` is stored with it.

## Data

### URL (`domain/filters.ts`)

| Param | Meaning | Validation |
|---|---|---|
| `zona` | zone id (`zones.id`, e.g. `701-cocles`) | `^[1-7][0-9]{2}-[a-z0-9-]+$`; must be in `zones_with_listings` when painting, otherwise ignored (like `prov`) |
| `llegada`, `salida` | nightly range, `YYYY-MM-DD` | both or none; `llegada ≥ hoy` (Costa Rica), `salida > llegada`, `salida ≤ hoy + 365`; otherwise both ignored |
| `desde` | monthly start, `YYYY-MM-DD` | `hoy ≤ desde ≤ hoy + 335`; only applied with `mensual=1` |
| `ppl` | people | any integer 1–50 (was `PEOPLE_OPTIONS`); old links with 2/4/6/8/12 keep working |
| `mapa` | full-screen map open | `1`; not in the query key |

- `Filters` gains `zone: string | null`, `arrival`, `departure`, `monthlyFrom` (`string | null`). With a zone, `prov` is dropped from the URL (`toSearchParams`) and from the query.
- `effectiveFilters`: with `monthly`, dates = `monthlyFrom` (llegada/salida ignored but kept in the URL, like the price range today); without it, `monthlyFrom` is ignored but kept.
- `extrasCount` does not count zone, dates or people (they are in the pill).

### SQL (new migration `explorar_fechas_y_zona`)

```sql
-- Casas públicas que cumplen zona y fechas; el resto de filtros los añade PostgREST encima (eq/gte/contains).
create function public.search_listings(p_zone text default null, p_from date default null, p_to date default null)
returns setof public.listings_public
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := public.costa_rica_today();
  z public.zones;
begin
  if (p_from is null) <> (p_to is null) then raise exception 'Revise las fechas.'; end if;
  if p_from is not null and (p_to <= p_from or p_from < today or p_to > today + 366) then
    raise exception 'Revise las fechas.';
  end if;
  if p_zone is not null then
    select * into z from public.zones where id = p_zone and active;
    if not found then return; end if;
  end if;
  return query
    select lp.* from public.listings_public lp
    join public.listings l on l.id = lp.id
    where l.available
      and (p_zone is null or l.zone_id = p_zone
           or extensions.ST_DWithin(extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography,
                                    z.point::extensions.geography, 5000))
      and (p_from is null or not exists (
            select 1 from public.listing_days d
            where d.listing_id = l.id and d.day >= p_from and d.day < p_to and not d.available));
end $$;
revoke all on function public.search_listings(text, date, date) from public;
grant execute on function public.search_listings(text, date, date) to anon, authenticated;
```

- The distance uses the **real** point (`listings.lat/lng`), inside the function; nothing about it leaves the database except membership in the result. `listings_public` keeps exposing only the approximate point.
- The monthly rule is the client's job: it calls `search_listings(zone, D, D + 30)`.
- `p_to ≤ today + 366` because `[A, S)` with S = today + 366 still only reads days up to today + 365, the calendar's window.
- No index is needed at launch volume (hundreds of rows; `listing_days` has its primary key `(listing_id, day)`, which serves the `not exists`).

```sql
-- Zonas con al menos una casa activa y abierta a 5 km o menos (o con esa zona elegida). Para «¿Dónde?».
create view public.zones_with_listings as
  select z.id, z.name, z.canton_code, n.name as canton, z.lat, z.lng, count(l.id)::int as listings
  from public.zones z
  join geo.admin_names n on n.code = z.canton_code
  join public.listings l on l.status = 'active' and l.available and l.lat is not null
    and (l.zone_id = z.id or extensions.ST_DWithin(
          extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography,
          z.point::extensions.geography, 5000))
  where z.active
  group by z.id, z.name, z.canton_code, n.name, z.lat, z.lng;
grant select on public.zones_with_listings to anon, authenticated;
```

Like `listings_public`, the view runs with its owner's rights (no `security_invoker`), so it reads `listings` without exposing it. `zones` and `geo.admin_names` grants do not change.

- Telemetry: extend `events_name_check` and `domain/telemetry.ts` with `search_submit` (no listing), `explore_map_open` (no listing) and `map_marker_tap` (with listing). `search_submit` carries flags only (`zona`, `fechas`, `personas` as booleans), never the values.

### Adapter and contract

- `PublicListingsApi.searchPublic(f)` always calls the RPC: `db.rpc("search_listings", { p_zone, p_from, p_to }).select(PUBLIC_COLUMNS)` and then the existing filters (`province` only without zone, `accepts_monthly`, `capacity`, `bedrooms`, `features`, price), `order("created_at", { ascending: false }).limit(SEARCH_LIMIT)`. The explicit `.eq("available", true)` moves into the RPC.
- New `PublicListingsApi.zonesWithListings(): Promise<ZoneWithListings[]>` and `zonesQuery` (staleTime 10 min, like `provincesQuery`).
- The fake (`data/fake/listings.ts`) implements both with the same rules (5 km with `distanceMeters`, busy days from the fake calendar).
- Regenerate `domain/database.types.ts` (`supabase gen types`).

### Size budgets (`apps/app/.size-limit.json`)

- «Zona privada · JS inicial» stays **≤ 150 KB** gz (measured 144.25 KB at the last close). What goes into it: the new header, `AccountButton`, `ExploreMap`'s box and loader, the URL parsing. Add exclusions `!dist/client/assets/buscar-*.js` and `!dist/client/assets/explore-map-leaflet-*.js`.
- New entry «Búsqueda de Explorar · trozo diferido» (`buscar-*.js`): **6 KB**.
- New entry «Mapa de Explorar · trozo diferido» (`explore-map-leaflet-*.js`): **2.5 KB**.
- New entry «Leaflet · trozo compartido» (`leaflet-*.js`, today 42.9 KB gz with no budget; shared by the ficha map, the publish map and Explorar): **44 KB**, so it cannot grow unnoticed.

### Hydration and performance

- Explorar is client-side (the shell); nothing here changes the SSR of `/casa/CT-####`. The contact sheet reads sessionStorage only when it opens, after hydration, so the hydration gate is unaffected.
- Lighthouse «shell instalado» on `/explorar` (< 2.5 s): the map is a fixed box, OSM tiles are blocked in the run and are not the LCP; the LCP becomes the first card's photo, which is eager and high priority.
- Taps on the pill, chips and «Buscar» stay < 50 ms: the search chunk is preloaded on pointer-down.

## Testing (test first)

- **DB (`test:db`, `tests/db/explorar-fechas-zona.test.ts`):**
  - `search_listings` with a busy day inside `[A, S)` excludes the house; a busy day on S does not; no dates returns all active and open houses;
  - a closed house with `reopen_at` before A is excluded;
  - a house 4 km from the Cocles point is included with `p_zone = '701-cocles'`, one at 6 km is not, one with `zone_id = '701-cocles'` at 6 km is;
  - an unknown or inactive zone returns no rows;
  - one date without the other, S ≤ A, A before today, S beyond today + 366 raise «Revise las fechas.»;
  - `anon` can call it and still cannot select `listings`;
  - `zones_with_listings` lists a zone with a house and not one without; a draft house does not count.
- **Contract suite** (`tests/contract/public-reads.contract.ts`): `searchPublic` with zone and dates, `zonesWithListings`, against PostgREST and the fake.
- **Vitest:**
  - `parseFilters`/`normalizeSearch`/`toSearchParams` for `zona`, `llegada`, `salida`, `desde`, `ppl` 1–50 and old values, invalid ranges ignored, zone drops `prov`;
  - the pill summary (`searchSummary`) for every combination;
  - `composeInquiryMessage` with `monthlyFrom`, with and without people, and dates overriding it;
  - the range calendar reducer (first tap, second tap, restart).
- **Playwright** (mobile viewport):
  1. Explorar has no top bar; the pill reads «Empiece su búsqueda»; the account button and «₡ | $» are on the page.
  2. Search «coc» → Cocles, 23–27 nov, 4 personas → «Buscar»: the pill reads «Cocles · 23–27 nov · 4 personas»; a house with 25 nov busy is not listed; the URL has `zona`, `llegada`, `salida`, `ppl`.
  3. With «Solo alquiler mensual», ¿Cuándo? asks «Desde»; results exclude a house busy on D + 10.
  4. Open a result and «Contactar por WhatsApp»: Llegada/Salida and Personas are prefilled and the message carries them; monthly: the message says «Me interesa alquilar por meses desde el …».
  5. The map box is the first list item and shows price markers (tiles stubbed); scrolling down shows «Mapa»; full screen shows «N casas»; tapping a marker shows its card; Back closes the map.
  6. Offline (route aborted), the map box stays as an empty arena box and the list works.
  7. «Borrar todo» clears zone, dates and people and keeps a feature filter.
- **Gates:** `size-limit` with the new entries, Lighthouse shell and ficha.

## Documentation (same day)

- `docs/decisiones.md`: Explorar structure (pill, no top bar, chip row with ₡ | $), search screen, zone search ≤ 5 km over zones with houses, date filter now (A11 trigger dropped), monthly «Desde» = 30 nights, closed houses always out, map as first item and full-screen map, one card per row, dates and monthly start in the WhatsApp message.
- `docs/diseno-v1.md` l.20–21.
- `docs/contacto-whatsapp.md`: the composed messages with dates and «Desde».
- `docs/telemetria.md`: the three events and a p75 note for `/explorar/buscar`.
- `docs/antes-de-produccion.md`: Explorar now loads OSM tiles on most visits; check the OSMF tile usage policy against launch traffic and decide whether to move to a tile provider.
- `.scratch/revision-ux/2026-10-26-revision-ux.md` A11: a line pointing here.

## Out of scope

- Flexible search («fechas flexibles», Skyscanner style): future, per the decisions file.
- Prices for the chosen dates or a total: never («nunca total a pagar»).
- Marker clustering (few houses at launch).
- «Cerca de mí», recent searches, popular destinations.
- Preselecting the dates on the ficha's read-only calendar.
- Desktop layout.
