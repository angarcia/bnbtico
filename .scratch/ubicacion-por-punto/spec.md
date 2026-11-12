# Spec · Ubicación por punto: el mapa decide provincia, cantón y zona

Status: ready-for-agent (approved by Daniel 2026-10-27) · implementada en `develop` (28ed452..08d93b3 y el arreglo de la revisión final); plan de pruebas en `docs/pruebas-manuales-fase-r.md` (B11b, B11b1, D10)
Date: 2026-10-27
Decided by: Daniel, in the brainstorming of 2026-10-27 («Mejoras fase R y 3», project 2 of 4).
Language note: technical artifact in English; all UI copy in Spanish de Costa Rica, treating the user as **usted**.
Supersedes: step 2 «¿Dónde está?» (provincia/cantón selects + free-text zone) and step 3 (map) of the publish wizard in `docs/diseno-v1.md` (l.33). The wizard goes from 9 to 8 steps.
Related: `.scratch/mensual-como-caracteristica/spec.md` (also edits the wizard: steps 1 and 8).

## Problem Statement

Today the owner fills four things:

- **Provincia**, a select defaulting to Limón.
- **Cantón**, a select from `domain/cantones.ts`.
- **Zona**, free text with Photon suggestions and eight `FREQUENT_ZONES` chips.
- On the next step, a **pin** on the map.

Nothing ties them together. A house can say «Cocles» and have its pin in Limón centro, or say Talamanca and sit in Cahuita.

The zone is house information shown on cards («Cocles, Talamanca»), the ficha, the province filter and the WhatsApp message, so it has to be right.

Free text also produces spelling variants («Pto Viejo», «Puerto viejo de Talamanca»).

## Solution

**The pin is the source of truth.**

- Province, cantón and district are computed from it in Postgres.
- The zone is chosen only among places near it.
- Search and map share one screen, so the owner sees the pin change the location live.

### Screen «¿Dónde está su casa?» (new step 2; old steps 2 and 3 merged)

```
¿Dónde está su casa?
[ 🔍 Busque un pueblo, playa o barrio… ]
┌───────────────────────────────┐
│          map (~55 %)          │
│              📍               │
└───────────────────────────────┘
Toque el mapa o arrastre el punto hasta su casa.
Talamanca, Limón                  ← computed, read-only
Zona   [ Cocles            ▾ ]    ← nearest preselected
```

1. **Search** (combobox). It only centers the map; it never sets the pin or stores anything.
   - Focused and empty: lists zones from `zones`, Caribe first.
   - Typing: filters those zones, then appends Photon (OSM) results restricted to Costa Rica (the existing `zone-field.tsx` logic, reused).
   - Choosing a result closes the keyboard and flies the map to it at street zoom.
2. **Map.** The existing `location-picker.tsx`.
   - It starts on Limón (`PROVINCE_CENTERS`), per «Caribe por defecto».
   - Tap sets the pin; drag refines it.
   - OSM attribution stays visible.
3. **Province and cantón line.**
   - Calls `place_at(lat, lng)` after the pin settles, debounced about 300 ms.
   - Shows «{cantón}, {provincia}». It is not editable: to change it, move the pin.
   - If the point is outside Costa Rica or in the sea, it shows «Ponga el punto sobre tierra, dentro de Costa Rica».
   - The box has a fixed height, so the layout does not jump.
4. **Zona** (select), recomputed whenever the pin moves. Options, in order:
   - Zones from `zones` within **5 km** of the pin, nearest first.
   - The **district** containing the pin (from `place_at`), always present, deduplicated if a zone has the same name.
   - **«Otra…»**, which opens a combobox:
     - Photon results within 5 km of the pin.
     - As the last item, «Usar "{lo escrito}"», so nobody gets stuck.
   - The nearest option is preselected.
   - If the pin moves and the chosen zone is no longer within 5 km (or is no longer the district), it is replaced by the new nearest one.
   - A zone chosen via «Otra…» stays as long as the pin is within 5 km of where it was chosen.
5. **Continuar** is enabled when there is a pin, a cantón and a zone.

### What is stored on `listings`

- `lat`, `lng`, as now.
- `province` and `canton`, **computed from the pin by the server**.
- `district`, new column, computed.
- `zone`: the chosen name.
- `zone_id`, new column: references `zones(id)`, or null for the district and for «Otra…».
- `zone_source`, new column: `'list' | 'district' | 'other'`.

`listings_public` exposes `zone`, `canton` and `province` as now, and does not expose `zone_source`.

## Data

### PostGIS and boundaries

- `create extension if not exists postgis with schema extensions;` (available on the Supabase free plan).
- Tables (no public grants; read only inside `security definer` RPCs):
  - `admin_names(code text primary key, level, name)` for provinces (1 digit), cantons (3) and districts (5).
  - `district_shapes(code text references admin_names, geom geometry(Polygon, 4326))`, holding the subdivided pieces, with a GiST index.
- **Source (researched 2026-10-27): OpenStreetMap.**
  - Use relations `boundary=administrative` with admin_level 4 (provinces, 7), 6 (cantons, 84) and 8 (districts), taken from a dated Geofabrik extract (`central-america/costa-rica-latest.osm.pbf`) or Overpass.
  - Live check: OSM has 7 / 84 / 495, including Río Cuarto, Monteverde, Puerto Jiménez, and the 2025 districts Pijije and Cabagra.
  - **Exclude «Conte Burica»** (relation 14365588). It is only a bill (expediente 25.750), not law. Its area belongs to Pavón.
  - Expected after exclusion: **494 districts**. The loader asserts 7 / 84 / 494.
  - District `postal_code` equals the DTA code (e.g. Pijije 50405). Store it as `code`; fill the 2 missing by hand.
- **Rejected sources:**
  - IGN/SNIT: authoritative, but its terms forbid commercial use without written permission. We can ask IGN for permission later and switch.
  - INEC/HDX: statistical units, unclear license, 492 districts, missing the 2025 ones.
  - geoBoundaries: 83 cantons and 472 districts, from 2017.
  - GADM: no commercial use.
- **License: ODbL 1.0.**
  - The polygon table is an internal Derivative Database. Names stored on listings are geocoding results («insubstantial extracts», OSMF Geocoding Guideline), so no share-alike applies.
  - **Never expose the polygons:** no public select on `geom`, no endpoint that returns them, and never ship them to the client. Only `place_at` / `zones_near` results leave the DB.
  - **Attribution** in Ayuda (and the ficha/map credits that already cite OSM): «Límites administrativos © colaboradores de OpenStreetMap, disponibles bajo la Open Database License (ODbL)», linking to https://www.openstreetmap.org/copyright.
- **Geometry:**
  - Load districts at full or near-full resolution.
  - If the versioned file must be smaller, simplify **topology-aware** (mapshaper `-simplify` keeping shared edges) at about 5–10 m, never per polygon. The file target is under about 8 MB.
  - Store `ST_Subdivide(geom, 256)` pieces with a GiST index for fast lookup.
  - Cantons and provinces are not stored as separate polygons: they come from the district's code (province = 1st digit, canton = first 3) joined to a small names table, so the three levels never disagree.
- **Coast fallback:** if `ST_Covers` finds no district, take the nearest district within **500 m** (`ST_DWithin` on geography, ordered by `ST_Distance`). Beyond that, return no row. This covers beach pins where OSM's coastline and the tiles differ.
- **Versioned file:** `supabase/datos/distritos-osm-YYYY-MM-DD.sql`, with a header comment giving the source, date, license and how to regenerate it. The script lives in `scripts/` and is not run in CI. A migration includes or loads it.

### `zones`

- Table with columns `id`, `name`, `canton_code → admin_names`, `point geometry(Point, 4326)`, `active boolean`; RLS public select, writes by admin only.
- **First version:**
  - Prepared by Claude from OSM (`place=village|hamlet|suburb|neighbourhood` and `natural=beach` within the Limón province cantons: Limón, Pococí, Siquirres, Talamanca, Matina, Guácimo).
  - Cleaned up by hand and **reviewed by Daniel before it is loaded**, as a table in a markdown file in `.scratch/ubicacion-por-punto/zonas.md`.
  - Talamanca should at least have: Puerto Viejo, Playa Negra, Cocles, Playa Chiquita, Punta Uva, Manzanillo, Cahuita, Hone Creek, Bribrí.
- Zones outside Limón are added when houses appear there. Until then the district plus «Otra…» covers them.

### RPCs

- `place_at(p_lat, p_lng) → (province, canton, district, district_code)`:
  - `stable security definer`, granted to `anon` and `authenticated`;
  - point-in-polygon on `district_shapes`, with the 500 m coast fallback;
  - returns no row outside Costa Rica or further out at sea.
- `zones_near(p_lat, p_lng, p_km default 5) → setof (id, name, distance_m)`, ordered by distance.
- `submit_listing` changes (latest version in `20261027040909_nombre_y_descripcion.sql` l.21):
  - recomputes `province`, `canton` and `district` from `lat/lng` with `place_at` and overwrites them; rejects if there is no row;
  - validates the zone:
    - `zone_source = 'list'` requires that zone to be within 5 km;
    - `'district'` requires `zone = district`;
    - `'other'` requires non-empty text, at most 60 characters.
  - The writes happen inside the RPC, so `listings_protect` allows them.

### Existing listings

None are kept. Test listings in `bnbtico-pruebas` are wiped before these migrations are applied (Daniel, 2026-10-27); the procedure is «Test data reset» in `.scratch/mensual-como-caracteristica/spec.md`. Production has no listings.

The migration does no data repair. `district`, `zone_id` and `zone_source` are added as nullable columns, and `submit_listing` enforces them from now on.

Local seeds (`supabase/seed.sql` and test fixtures) must be updated so seeded listings have points inside their canton and valid zones.

### Admin review

`RevisarScreen` shows the location line with a «Zona propuesta por el dueño» badge when `zone_source = 'other'`. Repeated names are added to `zones` by a migration.

### Removed

- `domain/cantones.ts` and `esCanton`.
- `FREQUENT_ZONES` (`domain/zones.ts`).
- `PlaceFields` and the old step 3.
- The free-text zone.
- Step numbers shift. `/propietario/publicar/$id/$paso` must redirect old step numbers ≥ 3 to the new ones, so drafts resumed from a link land on the right step. `wizard_step` queries in `docs/telemetria.md` note the change of numbering from this date.

## Testing (test first)

- **DB (`test:db`):**
  - `place_at`:
    - a point in Cocles gives Limón / Talamanca / Cahuita;
    - Limón centro gives Limón / Limón / Limón;
    - a point in the sea gives no row;
    - a point in Panamá gives no row;
    - a beach pin 100 m outside the polygon falls back to the nearest district;
    - `anon` cannot select from `district_shapes`.
  - `zones_near` gives order and radius.
  - `submit_listing`:
    - overwrites a wrong canton sent by the client;
    - rejects a `'list'` zone 10 km away;
    - rejects `'district'` with another name;
    - accepts `'other'`.
- **Vitest:**
  - building the zone options (dedupe district, preselection);
  - replacement when the pin moves;
  - step validation.
- **Contract suite:** `placeAt` and `zonesNear` in `ListingsApi`, against PostgREST and the fake. The fake uses a few fixed polygons.
- **Playwright** (mobile viewport):
  1. Search «Cocles» and tap the map near it. The line shows «Talamanca, Limón» and Cocles is preselected.
  2. Drag the pin to Limón centro. The line becomes «Limón, Limón» and the zone changes.
  3. «Otra…» with a made-up name, then «Usar …». The admin review shows the badge.
  4. Resume a draft at the old step number 3. It lands on the merged screen.
- **Gates:** `size-limit` for the publish chunk (the combobox replaces `zone-field.tsx` and the selects), and Lighthouse.

## Documentation (same day)

- `docs/decisiones.md`: pin as the source of truth; cascade selects replaced; 5 km radius; «Otra…» with Photon and «Usar …»; boundary data source (OSM, ODbL, Conte Burica excluded, IGN rejected for its commercial-use terms).
- `docs/diseno-v1.md`: the wizard is 8 steps; the new step 2.
- `docs/telemetria.md`: step renumbering for `wizard_step`.
- `docs/publicacion.md`: location rules.

## Out of scope

- Google Places (rejected 2026-10-27: display and caching terms, third-party script under the CSP, cost).
- Showing districts or zones as filters in Explorar. Province stays the only location filter.
- Owner-editable province or cantón.
- Exact address handling (`address_private` unchanged).
