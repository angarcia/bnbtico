# Ubicación por punto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** The pin is the source of truth for a listing's location. Postgres computes province, canton and district from it (OSM boundaries, PostGIS). The owner picks the zone only among places within 5 km. Old wizard steps 2 («¿Dónde está?») and 3 (map) become one screen, «¿Dónde está su casa?», so the wizard has 8 screens.

**Architecture:**
- **Boundaries.** A one-off Node script turns OpenStreetMap admin boundaries (Overpass) into a dated SQL data file. It uses the local Supabase PostGIS as its geometry engine; nothing new is installed.
- **Storage.** A migration (a symlink to the data file) loads the data into a private `geo` schema that PostgREST does not expose. The geometry never leaves the database.
- **Lookups.** Two RPCs, `place_at` and `zones_near`, answer location questions. `submit_listing` recomputes province, canton and district and validates the zone.
- **Client.** It sees a new `PlacesApi`: a PostgREST adapter, a fake with hand-drawn polygons, and one contract suite against both.
- **Wizard.** Step 2 becomes a new `LocationStep` with three parts: search combobox, map, and a computed line plus a zone select. A framework-free «place lookup» module (debounce, latest-wins, offline retry) drives it.
- **Step ids.** The URL step ids stay stable screen ids (1, 2, 4–9). Id 3 is retired and redirects to 2.

**Tech Stack:** PostgreSQL 17 + PostGIS 3.3.7 (Supabase local, schema `extensions`), plpgsql RPCs, Vite + React 19 + TanStack Router/Query, Leaflet 1.9, zod/mini, Vitest (unit, db, contract), Playwright (Pixel 7 / 375×667), Node 26 scripts (no extra dependencies).

**Spec:** `.scratch/ubicacion-por-punto/spec.md`. Assumed already implemented and merged, in this order: `.scratch/navegacion-simple/spec.md` and `.scratch/mensual-como-caracteristica/spec.md`. Mensual removes «¿Cómo alquila?» from step 1 and reshapes step 8 (price). Its «Test data reset» of `bnbtico-pruebas` has already run.

---

## Global Constraints

Values (verbatim, never paraphrase):

- Zone radius: **5 km** (`ZONE_RADIUS_M = 5000`); coast fallback: **500 m**; «Otra…» text: at most **60 characters** (`OTHER_ZONE_MAX = 60`, counted like `char_length(btrim())`).
- Place lookup debounce: **300 ms** after the pin settles (tap or `dragend`).
- Expected boundary counts after excluding Conte Burica (relation **14365588**): **7 / 84 / 494**. Province digit from `ISO3166-2`: SJ=1, A=2, C=3, H=4, G=5, P=6, L=7.
- Subdivision: `ST_Subdivide(geom, 256)`. Data file target: **< 8 MB**.

UI copy (Spanish de Costa Rica, **usted**, exact):

| Where | Text |
|---|---|
| Step 2 heading | «¿Dónde está su casa?» |
| Search placeholder / accessible name | «Busque un pueblo, playa o barrio…» / «Busque un pueblo, playa o barrio» |
| Hint under the map | «Toque el mapa o arrastre el punto hasta su casa.» |
| Place line (ok) | «{cantón}, {provincia}», e.g. «Talamanca, Limón» |
| Place line (no row) | «Ponga el punto sobre tierra, dentro de Costa Rica» |
| Place line (loading) | «Buscando el cantón…» *(new, decided here)* |
| Place line (network error) | «No pudimos ubicar el punto. Revise su conexión.» + button «Reintentar» *(new, decided here)* |
| Zone select label / last option | «Zona» / «Otra…» |
| «Otra…» combobox label / last item | «Otra zona» / `Usar "{lo escrito}"` (straight quotes, as in the spec) |
| Admin badge | «Zona propuesta por el dueño» |
| Ayuda attribution | «Límites administrativos © colaboradores de OpenStreetMap, disponibles bajo la Open Database License (ODbL)», linked to https://www.openstreetmap.org/copyright |

Validation messages. The same strings are used in `validateStep`, the fake and `submit_listing`:

- `«Marque en el mapa la ubicación aproximada.»` (no pin; existing string, kept)
- `«Ponga el punto sobre tierra, dentro de Costa Rica.»` (outside the CR box, no canton, or `place_at` gives no row)
- `«Elija la zona.»`
- `«La zona elegida queda a más de 5 km del punto. Elija otra.»` (server only)
- `«La zona no coincide con el distrito del punto. Elija otra.»` (server only)
- `«La zona puede tener como mucho 60 caracteres.»`

Process:

- **Migrations:** create each with `pnpm exec supabase migration new <name> < /dev/null` from the repo root. Apply locally with `pnpm db:reset`. Then run `pnpm db:types` from `apps/app` and commit `src/domain/database.types.ts`. Never edit `0001_init.sql` or older migrations.
- **PostGIS:** `create extension if not exists postgis with schema extensions;`. Qualify or `set search_path = public, geo, extensions` in every function that uses it.
- **Order:** every new table has its policies, grants and a DB test **before** any screen uses it. The contract suite (PostgREST + fake) comes before UI.
- **Polygons are never exposed.** No grants on `geo.*`, no RPC returns geometry, nothing derived from the polygons ships to the client. The fake uses hand-drawn shapes, not OSM-derived ones.
- **Test first:** write the failing test, run it, see it FAIL for the expected reason, implement, see it PASS, then commit.
- **Commands:** run from `apps/app` with `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`, `pnpm size`, `pnpm test:e2e`, `pnpm lighthouse`. Run from the repo root with `pnpm db:reset` and `pnpm test:prototype`.
- **Playwright:** mobile viewport, one worker (shared DB and test numbers), `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`. Intercept tiles and Photon; nothing goes to the network.
- **Commits:** Spanish, imperative, one per completed task with tests green. **No `Co-Authored-By` line** (CLAUDE.md and user memory override the generic attribution). **Never `git push`**, never `supabase db push`, never touch `pruebas.bnbtico.com` or `bnbtico.com`.
- **Downloads:** Overpass is the data source the user asked for, so it is in scope. Ask the user before pulling anything else, such as a GDAL Docker image or `pnpm dlx mapshaper`.

## Review Focus

These are the five likeliest failures that tests miss today. Each one has a test in the task that owns it.

1. **Beach pin outside the OSM polygon.**
   - Risk: OSM's coastline and the tiles differ, so a pin on the sand gets «Ponga el punto…».
   - Tests: `tests/db/ubicacion-limites.test.ts` (100 m offshore → Cahuita; 600 m → no row) in Task 2, and the same pair in `tests/contract/places.contract.ts` (Task 6), which forces the fake to match.
2. **`place_at` race while dragging fast.**
   - Risk: a slow response for an old point lands after the newer one and overwrites the line and the zone.
   - Tests: the unit test «una respuesta vieja no pisa a la nueva» in `tests/unit/place-lookup.test.ts` (Task 5), and the e2e «la primera respuesta llega tarde» in `tests/e2e/ubicacion.spec.ts` (Task 7, delayed `rpc/place_at` route).
3. **The pin crosses a canton border after «Otra…».**
   - Risk: the «Otra…» name must survive within 5 km of where it was chosen, while the line and the stored canton follow the pin.
   - Tests: `reconcileZone` cases in `tests/unit/zone-choice.test.ts` (Task 5), and «'other' con el punto al otro lado del río Estrella guarda el cantón nuevo» in `tests/db/submit-ubicacion.test.ts` (Task 4).
4. **Resuming a draft from an old step URL.**
   - Risk: `/propietario/publicar/$id/3` (the old map) shows «No encontramos…», or `resumeStep` returns a retired id.
   - Tests: `stepFromParam` and `resumeStep` in `tests/unit/listing.test.ts`, and the e2e «el paso 3 viejo lleva a la pantalla nueva» (both in Task 7).
5. **Offline while dragging the pin.**
   - Risk: the lookup fails, the line keeps the old canton, and «Continuar» saves a stale canton or never recovers.
   - Tests: `place-lookup` «sin red: estado error y reintento al volver la conexión» (Task 5), and the e2e with `context.setOffline(true/false)` (Task 7), which checks that «Continuar» is disabled and then recovers.

Also checked, though less likely: a gap where Conte Burica was cut out of Pavón. Task 1 asserts it.

## File Structure

Create:

- `scripts/osm-limites/generar.mjs`: downloads OSM boundaries, builds polygons in the local PostGIS (staging schema), asserts, writes the data file.
- `scripts/osm-zonas/borrador.mjs`: downloads Limón places and beaches, assigns cantons with `place_at`, writes `zonas.md`.
- `supabase/datos/distritos-osm-YYYY-MM-DD.sql`: the versioned data file (header, `geo.admin_names` inserts, `geo.load_district_shape(...)` calls, asserts).
- `supabase/migrations/<ts>_ubicacion_postgis.sql`: PostGIS, schema `geo`, tables, loader, `place_at`.
- `supabase/migrations/<ts>_distritos_osm.sql`: **symlink** to `../datos/distritos-osm-YYYY-MM-DD.sql`.
- `supabase/migrations/<ts>_zonas.sql`: `zones` table, policies, `zones_near`, the draft Caribe zones.
- `supabase/migrations/<ts>_ubicacion_en_listings.sql`: `district`, `zone_id`, `zone_source` and the new `submit_listing`.
- `.scratch/ubicacion-por-punto/zonas.md`: draft zone list (loaded, pending Daniel's review).
- `apps/app/src/data/postgrest/places.ts`, `apps/app/src/data/fake/places.ts`.
- `apps/app/src/client/publish/place-lookup.ts`: framework-free lookup (debounce, latest-wins, retry).
- `apps/app/src/client/publish/location-step.tsx`, `place-search.tsx`, `zone-select.tsx`.
- Tests:
  - `tests/db/ubicacion-limites.test.ts`, `tests/db/zonas.test.ts`, `tests/db/submit-ubicacion.test.ts`;
  - `tests/contract/places.contract.ts`, `tests/unit/contract-places-fake.test.ts`, `tests/db/contract-places-postgrest.test.ts`;
  - `tests/unit/zone-choice.test.ts`, `tests/unit/place-lookup.test.ts`;
  - `tests/e2e/ubicacion.spec.ts`.

Modify:

- Domain:
  - `apps/app/src/domain/zones.ts`: zone choice and Photon-near helpers; later the old helpers go.
  - `domain/geo.ts`: `bboxAround`.
  - `domain/listing.ts`: draft fields, step ids, validation, `locationLine`.
  - `domain/step-forms.ts`, `domain/rows.ts`.
  - `domain/api.ts`: `PlacesApi`, `ListingsApi.places`.
- Data and wiring:
  - `src/data/fake/owner.ts`: submit parity.
  - `src/data/fake/admin.ts`: map the new fields.
  - `src/data/postgrest/session-client.ts`: wire `places`.
  - `src/client/supabase-data.ts`, `src/client/owner.ts`: `places()` accessor.
- Wizard:
  - `src/client/publish/fields.tsx`, `location-picker.tsx`, `location-leaflet.ts`, `step-form.tsx`.
  - `src/client/screens/publicar.tsx`.
- Other screens: `src/client/screens/admin.tsx`, `src/client/screens/cuenta.tsx` (Ayuda), `src/styles/global.css`.
- Tests:
  - `tests/contract/harness.ts` (`COMPLETE`), `tests/contract/publish.contract.ts`, `tests/contract/public-reads.contract.ts`;
  - `tests/unit/listing.test.ts`, `tests/unit/zones.test.ts`;
  - `tests/e2e/publicar.spec.ts`, `tests/e2e/explorar.spec.ts`;
  - `tests/db/cliente-directo.test.ts`.
- Other files:
  - `supabase/seed/seed.sql` (commented example), `.gitignore`, `apps/app/.size-limit.json` (only if justified);
  - `docs/decisiones.md`, `docs/diseno-v1.md`, `docs/telemetria.md`, `docs/publicacion.md`, `docs/antes-de-produccion.md`.

Delete:

- `apps/app/src/domain/cantones.ts`, `tests/unit/cantones.test.ts`;
- `src/client/publish/zone-field.tsx` (its logic moves into `place-search.tsx`), `src/client/publish/zone-center.ts`;
- `tests/e2e/zonas.spec.ts` (replaced by `ubicacion.spec.ts`).

---

## Task 1: OSM boundary data file and its regeneration script

**Files:** create `scripts/osm-limites/generar.mjs` and `supabase/datos/distritos-osm-YYYY-MM-DD.sql` (date = download day). Modify `.gitignore` (add `scripts/osm-limites/.cache/`).

**Tools found on this machine (2026-10-27):**
- Available: `node` v26.8.1, `python3` (without shapely), `docker` with the local Supabase container `supabase_db_bnbtico` (`project_id` in `supabase/config.toml`), and PostGIS **3.3.7** available but not installed.
- Not available: `osmium`, `ogr2ogr`, `mapshaper`, `psql`. Reach the database only through `docker exec -i supabase_db_<project_id> psql -U postgres`, as `tests/db/local.ts` `sql()` does.
- Overpass works with a User-Agent, but it sometimes answers «502 … at capacity», and `out geom` for districts streams slowly (more than 20 MB took more than 400 s).
- A tag-only check today gave 7 / 84 / 495. 493 districts have `postal_code`. The two without it are **Conte Burica** (14365588, excluded) and **Cabagra** (18957876; canton Buenos Aires 603, whose codes run 60301–60309). Cahuita = `70403`. The cantons carry no code.

**Interfaces:**
- CLI: `node scripts/osm-limites/generar.mjs [--from-cache] [--decimals 6|5]`, run with `pnpm db:start` up. It writes `supabase/datos/distritos-osm-<date>.sql` and prints counts and size.
- The data file calls `geo.load_district_shape(p_code text, p_wkt text)`, created in Task 2. The file is only valid after that migration, which is correct for the migration order.

- [ ] **Step 1: Write the script's self-checks first (they are the test).**

  At the end of the script, before writing the file, add hard assertions that throw with a clear message:
  - provinces = 7, cantons = 84, districts = 494;
  - every district code matches `/^[1-7]\d{4}$/` and is unique;
  - the 84 canton prefixes (`code.slice(0,3)`) are distinct, and every canton polygon contains the `ST_PointOnSurface` of every district with its prefix;
  - each canton's first digit equals the digit of the province polygon that contains it;
  - no row has OSM id 14365588;
  - `ST_Area(ST_Difference(conteBurica, pavón)::geography) < 1000` **after** the Pavón fix (see Step 3);
  - every canton name equals an entry of the current `CANTONES[province]` in `apps/app/src/domain/cantones.ts` (parse with a regex). If not, apply the small `CANTON_NAME_OVERRIDES` map in the script so names keep the official spelling («Vázquez de Coronado», «León Cortés Castro»), and print the overrides used.

- [ ] **Step 2: Download (with backoff and a cache).**
  - Query (POST `data=` to `https://overpass-api.de/api/interpreter`, header `User-Agent: bnbtico-limites/1.0 (+https://bnbtico.com)`):
    ```
    [out:json][timeout:900];
    area["ISO3166-1"="CR"][admin_level=2]->.cr;
    rel(area.cr)[boundary=administrative][admin_level~"^(4|6|8)$"]->.r;
    .r out body;
    way(r.r);
    out geom;
    ```
    Each way comes once with its geometry. Relations carry member way ids and roles.
  - Retry on 429/502/503/504 with backoff 30 s, 60 s, 120 s, 240 s. Save the response to `scripts/osm-limites/.cache/overpass-<date>.json`. `--from-cache` reuses it.
  - Fallback, only if Overpass keeps failing: the Geofabrik `central-america/costa-rica-latest.osm.pbf` via a GDAL Docker image. **Ask the user before pulling the image.**

- [ ] **Step 3: Build in a staging schema of the local DB.**

  Write the inputs into `osm_staging` over `docker exec psql`, building the SQL text in Node:
  - `ways(id bigint, geom geometry(LineString,4326))`;
  - `rels(id bigint, level int, name text, postal_code text, iso text, way_ids bigint[])`.

  Build each relation's polygon with `ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_BuildArea(ST_Union(geom))),3))`. Then:
  - drop Conte Burica from districts and union its area into **Pavón** (district named «Pavón» whose code starts with the canton prefix that contains it; log the code);
  - set Cabagra's code to its canton prefix plus the next free number. Expected `60310`; log it as «asignado a mano».

  Run the Step 1 assertions as SQL. Drop `osm_staging` at the end, also on failure (try/finally).

- [ ] **Step 4: Export.**

  Write the header comment:
  - source and date;
  - «ODbL 1.0 — © colaboradores de OpenStreetMap; base de datos derivada interna, los polígonos nunca salen de la base»;
  - Conte Burica excluded (expediente 25.750) and joined to Pavón;
  - the Cabagra code;
  - precision and whether it was simplified;
  - «Regenerar: node scripts/osm-limites/generar.mjs (con pnpm db:start)».

  Then write the body:
  - `insert into geo.admin_names(code, level, name) values ...` for 7 + 84 + 494 rows (`level` ∈ `province|canton|district`);
  - one `select geo.load_district_shape('70403', 'MULTIPOLYGON(...)');` per district, using `ST_AsText(geom, 6)`;
  - a final `do $$ begin assert (select count(*) from geo.admin_names where level='province')=7; ... =84; ... =494; assert (select count(distinct code) from geo.district_shapes)=494; end $$;`.

  Size rule:
  - If the file is ≥ 8 MB at 6 decimals, rerun with `--decimals 5`. Rounding is per vertex, so shared edges stay shared.
  - If it is still ≥ 8 MB, stop and ask about `pnpm dlx mapshaper -simplify interval=5` (topology-aware), never per-polygon simplification.
  - Record the choice in the header.

- [ ] **Step 5: Run.**

  `pnpm db:start` (repo root), then `node scripts/osm-limites/generar.mjs`.
  - Expected: `provincias 7 · cantones 84 · distritos 494 · Conte Burica → Pavón (<code>) · Cabagra = 60310 · <size> MB`.
  - Then `ls -la supabase/datos/` shows a file under 8 MB.

- [ ] **Step 6: Commit.**
  ```
  git add scripts/osm-limites/generar.mjs supabase/datos/distritos-osm-*.sql .gitignore
  git commit -m "Añade los límites de OpenStreetMap de provincias, cantones y distritos y el script que los regenera"
  ```

## Task 2: PostGIS, private boundaries and `place_at`

**Files:**
- Create `supabase/migrations/<ts>_ubicacion_postgis.sql`, `supabase/migrations/<ts>_distritos_osm.sql` (symlink), `apps/app/tests/db/ubicacion-limites.test.ts`.
- Modify `apps/app/src/domain/database.types.ts`.

**Interfaces (SQL):**
```sql
create extension if not exists postgis with schema extensions;
create schema geo;                                   -- not in config.toml [api] schemas: never exposed
revoke all on schema geo from public, anon, authenticated;
create table geo.admin_names (code text primary key check (code ~ '^[1-7](\d{2}(\d{2})?)?$'),
  level text not null check (level in ('province','canton','district')), name text not null);
create table geo.district_shapes (id bigserial primary key, code text not null references geo.admin_names(code),
  geom extensions.geometry(Polygon, 4326) not null);
create index district_shapes_geom on geo.district_shapes using gist (geom);
-- RLS on both, no policies; revoke all from anon, authenticated.
create function geo.load_district_shape(p_code text, p_wkt text) returns void   -- inserts (ST_Dump(ST_Subdivide(ST_MakeValid(ST_GeomFromText(p_wkt,4326)),256))).geom, polygons only
  language sql security definer set search_path = geo, extensions;            -- revoke execute from public, anon, authenticated
create function public.place_at(p_lat double precision, p_lng double precision)
  returns table (province text, canton text, district text, district_code text)
  language sql stable security definer set search_path = public, geo, extensions;
-- grant execute on function public.place_at(double precision, double precision) to anon, authenticated;
```

`place_at` body:
- CTE `inside`: `ST_Covers(s.geom, pt)` limit 1.
- CTE `near`: only `where not exists (select 1 from inside)`. Uses `s.geom && ST_Expand(pt, 0.01)` and `ST_DWithin(s.geom::geography, pt::geography, 500)`, ordered by `ST_Distance(...)`, limit 1.
- Join `admin_names` three times: district `code`, canton `left(code,3)`, province `left(code,1)`.
- Null coordinates give no row.

- [ ] **Step 1: Write the failing test** `tests/db/ubicacion-limites.test.ts`.
  ```ts
  import { describe, expect, it } from "vitest";
  import { anonClient, sql } from "./local";

  const at = async (lat: number, lng: number) => (await anonClient().rpc("place_at", { p_lat: lat, p_lng: lng })).data ?? [];
  // Puntos fijos (comprobados con ST_Covers al escribir la prueba; ver el paso 3).
  const COCLES = { lat: 9.6418, lng: -82.733 };
  const LIMON_CENTRO = { lat: 9.9925, lng: -83.036 };
  const MAR = { lat: 10.2, lng: -82.8 };
  const PANAMA = { lat: 9.43, lng: -82.52 };
  // BEACH_100 / BEACH_600: calculados en el paso 3 y escritos aquí como números.

  describe("place_at y los límites de OpenStreetMap", () => {
    it("Cocles: Limón / Talamanca / Cahuita", async () => {
      expect(await at(COCLES.lat, COCLES.lng)).toEqual([{ province: "Limón", canton: "Talamanca", district: "Cahuita", district_code: "70403" }]);
    });
    it("Limón centro: Limón / Limón / Limón", async () => {
      expect((await at(LIMON_CENTRO.lat, LIMON_CENTRO.lng))[0]).toMatchObject({ province: "Limón", canton: "Limón", district: "Limón" });
    });
    it("mar adentro y Panamá: sin fila", async () => {
      expect(await at(MAR.lat, MAR.lng)).toEqual([]);
      expect(await at(PANAMA.lat, PANAMA.lng)).toEqual([]);
    });
    it("un pin en la playa a 100 m fuera del polígono cae en el distrito más cercano; a 600 m, sin fila", async () => {
      expect((await at(BEACH_100.lat, BEACH_100.lng))[0]).toMatchObject({ district: "Cahuita" });
      expect(await at(BEACH_600.lat, BEACH_600.lng)).toEqual([]);
    });
    it("7 / 84 / 494 y sin Conte Burica", () => {
      expect(sql("select string_agg(level || '=' || n, ',' order by level) from (select level, count(*) n from geo.admin_names group by 1) t")).toBe("canton=84,district=494,province=7");
      expect(sql("select count(*) from geo.admin_names where name = 'Conte Burica'")).toBe("0");
    });
    it("anon y authenticated no leen los polígonos ni los nombres", () => {
      for (const role of ["anon", "authenticated"]) for (const t of ["geo.district_shapes", "geo.admin_names"])
        expect(sql(`select has_table_privilege('${role}', '${t}', 'select')`)).toBe("f");
      expect(sql("select has_function_privilege('anon', 'geo.load_district_shape(text,text)', 'execute')")).toBe("f");
    });
    it("place_at no devuelve geometría", () => {
      expect(sql("select string_agg(data_type, ',') from information_schema.routines r join information_schema.parameters p using (specific_name) where r.routine_name = 'place_at' and p.parameter_mode = 'OUT'")).toBe("text,text,text,text");
    });
  });
  ```

- [ ] **Step 2: Run it.** `pnpm test:db tests/db/ubicacion-limites.test.ts`. Expected: FAIL (`Could not find the function public.place_at`).

- [ ] **Step 3: Implement.**
  - `pnpm exec supabase migration new ubicacion_postgis < /dev/null` and write the SQL above.
  - `pnpm exec supabase migration new distritos_osm < /dev/null`, then replace the created file: `ln -sf ../datos/distritos-osm-<date>.sql supabase/migrations/<ts>_distritos_osm.sql`.
  - `pnpm db:reset`. If the CLI refuses the symlink, copy the file instead and add a unit test asserting both files have the same SHA-256. Record the choice in Task 10's decision entry.
  - Compute the beach points (do not guess them):
    ```sql
    with c as (select ST_Boundary(ST_Union(geom)) b from geo.district_shapes where code='70403'),
    sea as (select ST_SetSRID(ST_MakePoint(-82.70, 9.66),4326) g),
    cp as (select ST_ClosestPoint(c.b, sea.g) p, ST_Azimuth(ST_ClosestPoint(c.b, sea.g)::geography, sea.g::geography) az from c, sea)
    select ST_AsText(ST_Project(p::geography, 100, az)::geometry), ST_AsText(ST_Project(p::geography, 600, az)::geometry), ST_AsText(p) from cp;
    ```
    Paste the two points into the test as `BEACH_100` and `BEACH_600` (6 decimals), and keep the closest point `C` and the azimuth in a comment: Task 6's fake needs them.
  - If `COCLES` or `LIMON_CENTRO` is not covered (`ST_Covers`), move it 200 m inland and note it.
  - Run `pnpm db:types` from `apps/app` (the `geo` schema stays out of the types).

- [ ] **Step 4: Run.** `pnpm test:db tests/db/ubicacion-limites.test.ts`, then the whole `pnpm test:db`. Expected: PASS, and no other db test changes.

- [ ] **Step 5: Commit.**
  ```
  git add supabase/migrations/*_ubicacion_postgis.sql supabase/migrations/*_distritos_osm.sql apps/app/tests/db/ubicacion-limites.test.ts apps/app/src/domain/database.types.ts
  git commit -m "Calcula provincia, cantón y distrito de un punto con PostGIS (place_at) sobre límites privados"
  ```

## Task 3: Draft Caribe zones, the `zones` table and `zones_near`

**Files:**
- Create `scripts/osm-zonas/borrador.mjs`, `.scratch/ubicacion-por-punto/zonas.md`, `supabase/migrations/<ts>_zonas.sql`, `apps/app/tests/db/zonas.test.ts`.
- Modify `database.types.ts` and `docs/antes-de-produccion.md`.

**Interfaces (SQL):**
```sql
create table public.zones (
  id text primary key check (id ~ '^[1-7][0-9]{2}-[a-z0-9-]+$'),      -- '<cantón>-<slug>', p. ej. '704-cocles'
  name text not null check (char_length(name) between 1 and 60),
  canton_code text not null references geo.admin_names(code),
  point extensions.geometry(Point, 4326) not null,
  lat double precision generated always as (extensions.ST_Y(point)) stored,
  lng double precision generated always as (extensions.ST_X(point)) stored,
  active boolean not null default true,
  created_at timestamptz not null default now());
create index zones_point on public.zones using gist (point);
alter table public.zones enable row level security;
create policy zones_read on public.zones for select to anon, authenticated using (active);
create policy zones_admin on public.zones for all to authenticated using (is_admin()) with check (is_admin());
revoke all on public.zones from anon, authenticated;
grant select (id, name, canton_code, lat, lng, active) on public.zones to anon, authenticated;
grant insert, update, delete on public.zones to authenticated;           -- RLS: only admin (aal2)
create function public.zones_near(p_lat double precision, p_lng double precision, p_km double precision default 5)
  returns table (id text, name text, distance_m integer)
  language sql stable security definer set search_path = public, extensions;
  -- active zones with ST_DWithin(point::geography, pt::geography, least(greatest(p_km,0),50)*1000),
  -- distance_m = round(ST_Distance(...))::int, order by distance_m, name
-- grant execute on function public.zones_near(double precision, double precision, double precision) to anon, authenticated;
```
`lat`/`lng` are generated from `point`, so PostgREST returns plain numbers and `point` stays the single source of truth.

- [ ] **Step 1: Write the draft generator and produce `zonas.md`.**
  - Query Overpass (same UA and backoff as Task 1):
    ```
    [out:json][timeout:180];
    area["ISO3166-2"="CR-L"]->.lim;
    ( node(area.lim)[place~"^(city|town|village|hamlet|suburb|neighbourhood)$"][name];
      nwr(area.lim)[natural=beach][name]; );
    out center tags;
    ```
    `city|town` are added to the spec's list so Limón, Guápiles and Siquirres appear (flag in the doc).
  - For each element, call `place_at` through `docker exec psql` and keep only cantons `701`–`706`.
  - Cleaning rules (applied in the script, listed at the top of `zonas.md`):
    - drop unnamed elements;
    - drop beaches «Playa X» within 1.5 km of a place «X»;
    - dedupe the same normalised name within 1 km (keep `place` over `natural`);
    - rename the city node «Limón» to «Limón centro».
  - Assert that Puerto Viejo, Playa Negra, Cocles, Playa Chiquita, Punta Uva, Manzanillo, Cahuita, Hone Creek, Bribrí and Limón centro are present. Add any missing one by hand with the current `FREQUENT_ZONES` coordinates, marked `manual`.
  - Table columns: `| id | Zona | Cantón | Distrito | lat | lng | OSM | Incluir |`, with `Incluir` ∈ `sí | revisar`.
  - Header:
    > **Status: borrador cargado sin revisar (Daniel no disponible el 2026-10-27). Revisar antes del lanzamiento; los cambios van en una migración nueva.**
  - Run with `node scripts/osm-zonas/borrador.mjs`. Expected: it prints `N zonas (M para revisar)` and writes the file.

- [ ] **Step 2: Write the failing test** `tests/db/zonas.test.ts`.
  ```ts
  import { describe, expect, it } from "vitest";
  import { anonClient, signIn, sql } from "./local";

  const COCLES = { p_lat: 9.6418, p_lng: -82.733 };
  describe("zones y zones_near", () => {
    it("ordena por distancia y respeta el radio de 5 km", async () => {
      const { data } = await anonClient().rpc("zones_near", COCLES);
      const names = data!.map((z) => z.name);
      expect(names[0]).toBe("Cocles");
      expect(names).toEqual(expect.arrayContaining(["Puerto Viejo", "Playa Chiquita"]));
      expect(names).not.toContain("Manzanillo"); // ~8,2 km
      expect(names).not.toContain("Cahuita"); // ~16 km
      const d = data!.map((z) => z.distance_m);
      expect(d).toEqual([...d].sort((a, b) => a - b));
      expect(Math.max(...d)).toBeLessThanOrEqual(5000);
      expect((await anonClient().rpc("zones_near", { ...COCLES, p_km: 10 })).data!.map((z) => z.name)).toContain("Manzanillo");
    });
    it("anon lee las zonas activas sin la geometría; un usuario que no es admin no escribe", async () => {
      const read = await anonClient().from("zones").select("id, name, canton_code, lat, lng").eq("id", "704-cocles").single();
      expect(read.data).toMatchObject({ name: "Cocles", canton_code: "704" });
      expect((await anonClient().from("zones").select("point").limit(1)).error?.code).toBe("42501");
      const owner = await signIn("owner");
      const ins = await owner.from("zones").insert({ id: "704-prueba", name: "Prueba", canton_code: "704", point: "SRID=4326;POINT(-82.7 9.6)" } as never);
      expect(ins.error).not.toBeNull();
    });
    it("cada zona cae en su cantón según place_at", () => {
      expect(sql("select count(*) from zones z where not exists (select 1 from place_at(z.lat, z.lng) p join geo.admin_names c on c.name = p.canton and c.level = 'canton' where c.code = z.canton_code)")).toBe("0");
    });
  });
  ```
  The ids (`704-cocles`, etc.) are the ones in `zonas.md`. If the generator slugs differently, use its ids here and in Tasks 4–7.

- [ ] **Step 3: Run it.** `pnpm test:db tests/db/zonas.test.ts`. Expected: FAIL (`zones_near` missing).

- [ ] **Step 4: Implement.**
  - `pnpm exec supabase migration new zonas < /dev/null`, with the SQL above plus one `insert into public.zones(id, name, canton_code, point) values (..., ST_SetSRID(ST_MakePoint(lng, lat),4326))` per `Incluir = sí` row.
  - The «revisar» rows are inserted too (Daniel is unavailable). They are marked in `zonas.md`, not in the DB.
  - End with a `do $$` assert that the Talamanca ten are present.
  - `pnpm db:reset`, then `pnpm db:types`.
  - Add to `docs/antes-de-produccion.md`: «Revisar con Daniel `.scratch/ubicacion-por-punto/zonas.md` (zonas del Caribe cargadas como borrador el 2026-10-27) y aplicar sus cambios con una migración».

- [ ] **Step 5: Run.** `pnpm test:db`. Expected: PASS.

- [ ] **Step 6: Commit.**
  ```
  git add scripts/osm-zonas/borrador.mjs .scratch/ubicacion-por-punto/zonas.md supabase/migrations/*_zonas.sql apps/app/tests/db/zonas.test.ts apps/app/src/domain/database.types.ts docs/antes-de-produccion.md
  git commit -m "Añade las zonas del Caribe (borrador de OpenStreetMap, pendiente de revisar) y zones_near"
  ```

## Task 4: Location columns on `listings` and `submit_listing`

**Files:**
- Create `supabase/migrations/<ts>_ubicacion_en_listings.sql`, `apps/app/tests/db/submit-ubicacion.test.ts`.
- Modify `database.types.ts`, `apps/app/tests/contract/harness.ts` (`COMPLETE`), `tests/contract/public-reads.contract.ts`, `tests/db/cliente-directo.test.ts`, `tests/e2e/explorar.spec.ts` and every other fixture that overrides `zone`/`lat`, plus `supabase/seed/seed.sql`.

**Interfaces (SQL):**
```sql
alter table public.listings
  add column district text,
  add column zone_id text references public.zones(id) on delete set null,
  add column zone_source text check (zone_source in ('list','district','other'));
-- listings_public unchanged (explicit column list): zone_source and zone_id are not exposed.
create or replace function public.submit_listing(p_listing uuid) returns listing_status ...  -- from the LATEST definition
```
Start from the latest definition: `grep -l "function public.submit_listing" supabase/migrations/* | tail -1`. That is the mensual migration, not `nombre_y_descripcion`.

Replace its two location lines (`province/canton/zone` and the `lat/lng` box) with the block below, in the same position:
1. `lat`/`lng` null → `'Marque en el mapa la ubicación aproximada.'`.
2. `select * into pl from place_at(l.lat, l.lng)`; if not found → `'Ponga el punto sobre tierra, dentro de Costa Rica.'`.
3. Empty `zone` or null `zone_source` → `'Elija la zona.'`.
4. `'list'`: `zone_id` must be in `zones_near(l.lat, l.lng, 5)`; otherwise `'La zona elegida queda a más de 5 km del punto. Elija otra.'`. Take `zname` from `zones`.
5. `'district'`: `zone = pl.district` and `zone_id is null`; otherwise `'La zona no coincide con el distrito del punto. Elija otra.'`.
6. `'other'`: `zone_id is null` (otherwise `'Elija la zona.'`) and `char_length(btrim(zone)) <= 60` (otherwise `'La zona puede tener como mucho 60 caracteres.'`).

The final update becomes:
`update listings set status='review', review_note=null, province=pl.province, canton=pl.canton, district=pl.district, zone = case when l.zone_source='list' then zname else btrim(l.zone) end where id = p_listing;`
It runs inside the RPC with `app.allow_status` on, so `listings_protect` lets it through.

- [ ] **Step 1: Write the failing test** `tests/db/submit-ubicacion.test.ts`.
  ```ts
  import { beforeAll, beforeEach, describe, expect, it } from "vitest";
  import { serviceClient } from "./local";
  import { postgrestHarness } from "./postgrest-harness";

  const COCLES = { lat: 9.6418, lng: -82.733 };
  let h: Awaited<ReturnType<typeof postgrestHarness>>;
  beforeAll(async () => { h = await postgrestHarness(); });
  beforeEach(async () => { await h.reset(); });

  async function submitWith(patch: Record<string, unknown>) {
    const { id } = await h.seed({ status: "draft", photos: 5 });
    await serviceClient().from("listings").update(patch as never).eq("id", id);
    let error: string | null = null;
    try { await h.owner("owner").submit(id); } catch (e) { error = (e as Error).message; }
    const row = (await serviceClient().from("listings").select("status, province, canton, district, zone, zone_id").eq("id", id).single()).data!;
    return { error, row };
  }

  describe("submit_listing con la ubicación por punto", () => {
    it("sobrescribe un cantón equivocado que manda el cliente", async () => {
      const { error, row } = await submitWith({ ...lat(COCLES), province: "Limón", canton: "Limón", district: "", zone: "Cocles", zone_id: "704-cocles", zone_source: "list" });
      expect(error).toBeNull();
      expect(row).toMatchObject({ status: "review", province: "Limón", canton: "Talamanca", district: "Cahuita", zone: "Cocles" });
    });
    it("rechaza una zona de la lista a más de 5 km", async () => {
      expect((await submitWith({ ...lat(COCLES), zone: "Cahuita", zone_id: "704-cahuita", zone_source: "list" })).error).toBe("La zona elegida queda a más de 5 km del punto. Elija otra.");
    });
    it("rechaza 'district' con otro nombre", async () => {
      expect((await submitWith({ ...lat(COCLES), zone: "Bratsi", zone_id: null, zone_source: "district" })).error).toBe("La zona no coincide con el distrito del punto. Elija otra.");
    });
    it("acepta 'other' y rechaza más de 60 caracteres", async () => {
      expect((await submitWith({ ...lat(COCLES), zone: "Rancho Escondido", zone_id: null, zone_source: "other" })).row).toMatchObject({ status: "review", zone: "Rancho Escondido", zone_id: null });
      expect((await submitWith({ ...lat(COCLES), zone: "x".repeat(61), zone_id: null, zone_source: "other" })).error).toBe("La zona puede tener como mucho 60 caracteres.");
    });
    it("un punto en el mar no se envía", async () => {
      expect((await submitWith({ lat: 10.2, lng: -82.8, zone: "Cocles", zone_id: "704-cocles", zone_source: "list" })).error).toBe("Ponga el punto sobre tierra, dentro de Costa Rica.");
    });
    it("'other' con el punto al otro lado del río Estrella guarda el cantón nuevo", async () => {
      // Punto en el cantón Limón cerca del límite con Talamanca (comprobar con place_at al escribir la prueba).
      const { row } = await submitWith({ lat: 9.8, lng: -82.93, province: "Limón", canton: "Talamanca", zone: "Finca Los Almendros", zone_id: null, zone_source: "other" });
      expect(row).toMatchObject({ canton: "Limón", zone: "Finca Los Almendros" });
    });
    it("listings_public no expone zone_source", async () => {
      expect((await serviceClient().from("listings_public").select("zone_source" as never).limit(1)).error).not.toBeNull();
    });
  });
  const lat = (p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng });
  ```

- [ ] **Step 2: Run it.** `pnpm test:db tests/db/submit-ubicacion.test.ts`. Expected: FAIL (`column "zone_source" does not exist`).

- [ ] **Step 3: Implement.**
  - Write the migration (`pnpm exec supabase migration new ubicacion_en_listings < /dev/null`), then `pnpm db:reset` and `pnpm db:types`.
  - In `tests/contract/harness.ts`, `COMPLETE` gains `district: "Cahuita", zoneId: "704-cahuita", zoneSource: "list"`. The type is extended in Task 7; until then, `postgrest-harness.ts` maps these three keys to snake_case in its insert (`district`, `zone_id`, `zone_source`).
  - Fix every fixture: find them with `grep -rnE "zone: \"|lat: [0-9]" apps/app/tests`. When a fixture's zone differs from Cahuita, set `zoneSource: "other", zoneId: null`; the name is kept. This covers «Casa Punta Uva», Sámara, Uvita and Turrialba. Fixtures in other provinces must have a point inside the stated canton (Sámara 9.88,-85.53 → Nicoya; Uvita 9.15,-83.75 → Osa).
  - Update the commented example in `supabase/seed/seed.sql`: Manzanillo with its point, `zone_id '704-manzanillo'`, `zone_source 'list'`.

- [ ] **Step 4: Run.** `pnpm test:db`, `pnpm test` and `CHROMIUM_PATH=… pnpm test:e2e tests/e2e/explorar.spec.ts`. Expected: all PASS.

- [ ] **Step 5: Commit.**
  ```
  git add supabase/migrations/*_ubicacion_en_listings.sql apps/app/tests apps/app/src/domain/database.types.ts supabase/seed/seed.sql
  git commit -m "Hace que submit_listing calcule provincia, cantón y distrito desde el pin y valide la zona"
  ```

## Task 5: Zone choice rules and the place lookup (pure modules)

**Files:**
- Modify `apps/app/src/domain/zones.ts` (additive) and `apps/app/src/domain/geo.ts`.
- Create `apps/app/src/client/publish/place-lookup.ts`, `tests/unit/zone-choice.test.ts`, `tests/unit/place-lookup.test.ts`.

**Interfaces (TS):**
```ts
// domain/zones.ts (añadido; lo viejo se quita en la tarea 8)
export const ZONE_RADIUS_M = 5000;
export const OTHER_ZONE_MAX = 60;
export const PLACE_DEBOUNCE_MS = 300;
export type ZoneSource = "list" | "district" | "other";
export interface Place { province: string; canton: string; district: string; districtCode: string }
export interface NearZone { id: string; name: string; distanceM: number }
export interface Zone { id: string; name: string; cantonCode: string; lat: number; lng: number }
export interface ZoneChoice { name: string; source: ZoneSource; zoneId: string | null; anchor: LatLng | null }
export interface ZoneSelectOption { key: string; name: string; source: "list" | "district"; zoneId: string | null; distanceM: number | null }
export interface PhotonPlace extends LatLng { name: string; detail: string }
/** Zonas a ≤ 5 km (la más cercana primero) y el distrito, sin repetir nombre (manda la de la lista). */
export function zoneOptions(near: readonly NearZone[], place: Place | null): ZoneSelectOption[];
/** La zona que queda tras mover el pin; null solo si no hay ninguna opción todavía. */
export function reconcileZone(current: ZoneChoice | null, pin: LatLng, options: readonly ZoneSelectOption[], place: Place | null): ZoneChoice | null;
export function placeLine(place: Place): string;            // "Talamanca, Limón"
export function searchZones(zones: readonly Zone[], text: string, limit?: number): Zone[]; // vacío: todas, Caribe (7xx) primero; si no, filtra sin tildes
export function photonNearUrl(query: string, near: LatLng, withinM?: number): string | null; // bbox de CR, o bboxAround(near, withinM)
export function parsePhotonNear(json: unknown, near: LatLng, withinM?: number): PhotonPlace[]; // CR, sin repetidos, por distancia, ≤ 5
// domain/geo.ts
export function bboxAround(p: LatLng, meters: number): [west: number, south: number, east: number, north: number];

// client/publish/place-lookup.ts (sin React)
export type LookupState =
  | { status: "idle" }
  | { status: "loading"; point: LatLng }
  | { status: "ready"; point: LatLng; place: Place | null; near: NearZone[] }
  | { status: "error"; point: LatLng };
export interface PlaceLookup { set(point: LatLng): void; retry(): void; dispose(): void }
export function createPlaceLookup(
  api: { placeAt(lat: number, lng: number): Promise<Place | null>; zonesNear(lat: number, lng: number, km?: number): Promise<NearZone[]> },
  onChange: (s: LookupState) => void,
  opts?: { debounceMs?: number; online?: { subscribe(cb: () => void): () => void } }, // por defecto, el evento `online` de window
): PlaceLookup;
```

- [ ] **Step 1: Write the failing tests.**
  - `tests/unit/zone-choice.test.ts`, exact values:
    ```ts
    const place = { province: "Limón", canton: "Talamanca", district: "Cahuita", districtCode: "70403" };
    const near = [{ id: "704-cocles", name: "Cocles", distanceM: 120 }, { id: "704-puerto-viejo", name: "Puerto Viejo", distanceM: 2902 }];
    it("zonas cercanas primero, luego el distrito, y la más cercana va preseleccionada", () => {
      const o = zoneOptions(near, place);
      expect(o.map((x) => [x.name, x.source])).toEqual([["Cocles", "list"], ["Puerto Viejo", "list"], ["Cahuita", "district"]]);
      expect(reconcileZone(null, PIN, o, place)).toEqual({ name: "Cocles", source: "list", zoneId: "704-cocles", anchor: null });
    });
    it("el distrito no se repite si una zona se llama igual (sin tildes ni mayúsculas)", () => {
      expect(zoneOptions([{ id: "704-cahuita", name: "Cahuita", distanceM: 300 }], place).map((x) => x.source)).toEqual(["list"]);
    });
    it("sin zonas cerca, el distrito es la única opción y queda elegido", () => {
      expect(reconcileZone(null, PIN, zoneOptions([], place), place)).toMatchObject({ name: "Cahuita", source: "district", zoneId: null });
    });
    it("una zona de la lista que sale del radio se cambia por la más cercana; si sigue, se queda", () => { /* current Puerto Viejo, options sin Puerto Viejo → Cocles; con Puerto Viejo → Puerto Viejo */ });
    it("el distrito elegido se cambia si el pin pasa a otro distrito", () => { /* current {Cahuita,district}, place.district 'Limón' → primera opción */ });
    it("'Otra…' se queda a 4,9 km de donde se eligió, aunque cambie el cantón; a 5,1 km se cambia", () => {
      const anchor = { lat: 9.8, lng: -82.93 };
      const other = { name: "Finca Los Almendros", source: "other" as const, zoneId: null, anchor };
      const limon = { ...place, canton: "Limón", district: "Valle La Estrella" };
      expect(reconcileZone(other, offset(anchor, 4900), zoneOptions([], limon), limon)).toBe(other);
      expect(reconcileZone(other, offset(anchor, 5100), zoneOptions([], limon), limon)).toMatchObject({ source: "district" });
    });
    it("sin opciones (buscando o sin red) no borra lo elegido", () => {
      expect(reconcileZone(other, PIN, [], null)).toBe(other);
    });
    ```
    Add `placeLine`, `searchZones` (empty text gives all with 7xx first; «coc» finds «Cocles»; «limon» finds «Limón centro») and `parsePhotonNear` (drops results beyond 5 km and outside CR; orders by distance).
  - `tests/unit/place-lookup.test.ts`, with `vi.useFakeTimers()` and a deferred fake API:
    - «espera 300 ms tras el último punto»: three `set` calls 100 ms apart give one call, with the last point.
    - «una respuesta vieja no pisa a la nueva»: `set(A)`, advance 300, `set(B)`, advance 300; resolve B, then A. The last `ready` state has point B, and no `ready` for A is emitted after B's.
    - «sin red: estado error y reintento al volver la conexión»: placeAt rejects with `TypeError("Failed to fetch")` and the state becomes `error` with point B. Firing the fake `online` subscription calls the API again for B, and the state becomes `ready`.
    - «retry() repite el último punto» and «dispose() cancela el temporizador y deja de avisar».

- [ ] **Step 2: Run.** `pnpm test tests/unit/zone-choice.test.ts tests/unit/place-lookup.test.ts`. Expected: FAIL (exports missing).

- [ ] **Step 3: Implement.**
  - Latest-wins uses a sequence number; responses for an older `seq` are dropped.
  - `placeAt` and `zonesNear` run in parallel (`Promise.all`).
  - Any rejection gives `error`; the `online` event retries only if the state is `error`.
  - `reconcileZone` uses `distanceMeters` from `geo.ts` and the normalised name (same `norm` as today).

- [ ] **Step 4: Run.** `pnpm test`, `pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit.**
  ```
  git add apps/app/src/domain/zones.ts apps/app/src/domain/geo.ts apps/app/src/client/publish/place-lookup.ts apps/app/tests/unit/zone-choice.test.ts apps/app/tests/unit/place-lookup.test.ts
  git commit -m "Añade las reglas de la zona por cercanía y la búsqueda del lugar con espera, última respuesta y reintento"
  ```

## Task 6: `PlacesApi`: PostgREST adapter, fake and contract suite

**Files:**
- Modify `apps/app/src/domain/api.ts`, `src/data/postgrest/session-client.ts`, `src/client/supabase-data.ts`, `src/client/owner.ts`.
- Create `src/data/postgrest/places.ts`, `src/data/fake/places.ts`, `tests/contract/places.contract.ts`, `tests/unit/contract-places-fake.test.ts`, `tests/db/contract-places-postgrest.test.ts`.

**Interfaces:**
```ts
// domain/api.ts
export interface PlacesApi {
  /** RPC place_at: provincia, cantón y distrito del punto (500 m de margen en la costa); null fuera de Costa Rica o mar adentro. */
  placeAt(lat: number, lng: number): Promise<Place | null>;
  /** RPC zones_near: zonas activas a ≤ km (5 por defecto), la más cercana primero. */
  zonesNear(lat: number, lng: number, km?: number): Promise<NearZone[]>;
  /** Zonas activas para el buscador del paso 2 (tabla zones: id, name, canton_code, lat, lng), Caribe primero. */
  listZones(): Promise<Zone[]>;
}
export interface ListingsApi extends PublicListingsApi, OwnerListingsApi { photos: PhotosApi; admin: AdminListingsApi; places: PlacesApi }
// data/postgrest/places.ts
export function createPostgrestPlaces(db: SupabaseClient<Database>): PlacesApi;
// data/fake/places.ts: polígonos dibujados a mano (no derivados de OSM) y zonas copiadas de la migración
export const FAKE_DISTRICTS: readonly { code: string; province: string; canton: string; district: string; ring: readonly LatLng[] }[];
export const FAKE_ZONES: readonly Zone[];
export function fakePlaceAt(lat: number, lng: number): Place | null;     // punto en anillo; si no, el más cercano a ≤ 500 m
export function fakeZonesNear(lat: number, lng: number, km?: number): NearZone[];
export function createFakePlaces(): PlacesApi;
// client/owner.ts
export function places(): Promise<PlacesApi>;   // mismo patrón diferido que api()
```

- [ ] **Step 1: Write the failing contract** `tests/contract/places.contract.ts`, exported as `placesContract(name, make: () => Promise<{ places: PlacesApi }>)`.

  Use the same points as Tasks 2–4. Import `BEACH_100`/`BEACH_600` from a shared `tests/contract/points.ts`, created here and also used by Task 2's test (move the constants).
  - `placeAt(COCLES)` → `{ province: "Limón", canton: "Talamanca", district: "Cahuita", districtCode: "70403" }`.
  - `placeAt(LIMON_CENTRO)` → canton «Limón», district «Limón».
  - `placeAt(MAR)`, `placeAt(PANAMA)` and `placeAt(BEACH_600)` → `null`; `placeAt(BEACH_100)` → district «Cahuita».
  - `zonesNear(COCLES)`: first «Cocles», includes «Puerto Viejo», excludes «Manzanillo», distances ascending and ≤ 5000. `zonesNear(COCLES, 10)` includes «Manzanillo».
  - `listZones()` contains the Talamanca ten plus «Limón centro»; every `cantonCode` starts with `7`.

  Wire it up: `tests/unit/contract-places-fake.test.ts` → `placesContract("fake en memoria", async () => ({ places: createFakePlaces() }))`; `tests/db/contract-places-postgrest.test.ts` → the same with `createPostgrestPlaces(anonClient())`.

- [ ] **Step 2: Run.** `pnpm test tests/unit/contract-places-fake.test.ts` and `pnpm test:db tests/db/contract-places-postgrest.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement.**
  - PostgREST:
    - `db.rpc("place_at", …)` maps `district_code` to `districtCode`; an empty array gives `null`.
    - `zonesNear` maps `distance_m` to `distanceM`.
    - `listZones` selects `id, name, canton_code, lat, lng` with `.eq("active", true).order("canton_code", { ascending: false }).order("name")`; Caribe comes first while every zone is in Limón. Sort in TS with 7xx first if other provinces appear.
    - Errors go through `toDomainError`.
  - Fake:
    - `FAKE_DISTRICTS`: hand-drawn quadrilaterals for Cahuita (70403) and Limón (70101), plus one for Valle La Estrella (Task 4's Estrella point). Draw Cahuita's seaward edge through Task 2's closest point `C`, perpendicular to its azimuth, so `BEACH_100` lies 100 m out and `BEACH_600` 600 m out.
    - Distances: equirectangular point-to-segment.
    - `FAKE_ZONES`: the Talamanca ten plus «Limón centro», copied from the `zonas` migration (same ids and coordinates).
  - Add `places: createPostgrestPlaces(db)` to `createBrowserData`, `placesApi()` to `supabase-data.ts`, and `places()` to `client/owner.ts`.

- [ ] **Step 4: Run.** `pnpm test`, `pnpm test:db`, `pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit.**
  ```
  git add apps/app/src/domain/api.ts apps/app/src/data apps/app/src/client/supabase-data.ts apps/app/src/client/owner.ts apps/app/tests/contract apps/app/tests/unit/contract-places-fake.test.ts apps/app/tests/db
  git commit -m "Añade PlacesApi (place_at, zones_near y lista de zonas) con adaptador, fake y suite de contrato"
  ```

## Task 7: The merged step «¿Dónde está su casa?» (model, map, line, zone select, old URLs)

**Files:**
- Modify:
  - Domain: `src/domain/listing.ts`, `src/domain/step-forms.ts`, `src/domain/rows.ts`.
  - Data: `src/data/fake/owner.ts` (`submitRefusal` parity), `src/data/fake/admin.ts` (new fields).
  - Wizard: `src/client/publish/fields.tsx`, `location-picker.tsx`, `location-leaflet.ts`, `step-form.tsx`, `src/client/screens/publicar.tsx`.
  - Other: `src/styles/global.css`, `tests/contract/publish.contract.ts`, `tests/unit/listing.test.ts`, `tests/e2e/publicar.spec.ts`.
- Create `src/client/publish/location-step.tsx`, `src/client/publish/zone-select.tsx`, `tests/e2e/ubicacion.spec.ts`.

**Interfaces:**
```ts
// domain/listing.ts
export type Step = 1 | 2 | 4 | 5 | 6 | 7 | 8 | 9;            // ids de pantalla estables; el 3 (mapa) se retiró el 2026-10-27
export const STEPS: readonly Step[] = [1, 2, 4, 5, 6, 7, 8, 9];
export const LAST_STEP: Step = 9;
export const STEP_COUNT = STEPS.length;                        // 8
export const RETIRED_STEPS: Readonly<Record<string, Step>> = { "3": 2 };
export function stepFromParam(paso: string): { step: Step } | { redirect: Step } | null;
export function stepPosition(step: Step): number;              // 1…8, para «Paso n de 8» y la barra
export const WIZARD_STAGES: readonly { name: string; steps: readonly Step[] }[]; // Su casa [1,2,4,5] · Fotos y texto [6,7] · Precio [8,9]
export function locationLine(l: { zone: string; district: string; canton: string; province: string }): string; // «Cocles · Cahuita, Talamanca, Limón»
export const isProposedZone = (l: { zoneSource: ZoneSource | null }) => l.zoneSource === "other";
// ListingDraft gains: district: string; zoneId: string | null; zoneSource: ZoneSource | null   (emptyDraft: "", null, null)
// client/publish/step-form.tsx
export function useStepReady(ready: boolean): void;            // «Continuar» deshabilitado mientras false (contexto de StepForm)
// client/publish/location-leaflet.ts: PickerMap gains view(p: LatLng, zoom: number): void (setView sin animación)
// client/publish/location-step.tsx
export function LocationStep({ listing, draft }: { listing: Listing; draft: ListingDraft }): JSX.Element;
// client/publish/zone-select.tsx (la parte «Otra…» llega en la tarea 8)
export function ZoneSelect({ options, value, onChange }: { options: ZoneSelectOption[]; value: ZoneChoice | null; onChange(c: ZoneChoice): void }): JSX.Element;
```

Hidden form fields on step 2: `lat`, `lng`, `province`, `canton`, `district`, `zone`, `zoneId`, `zoneSource`. Step-forms schema 2 parses them; there is no schema 3.

`validateStep(2)` checks in this order:
1. no pin → «Marque en el mapa la ubicación aproximada.»;
2. `!inCostaRica` or empty canton/province → «Ponga el punto sobre tierra, dentro de Costa Rica.»;
3. empty zone, null `zoneSource`, `'list'` without `zoneId`, or `'district'` with `zone !== district` → «Elija la zona.»;
4. `'other'` with `charCount(zone) > 60` → «La zona puede tener como mucho 60 caracteres.».

The fake `submitRefusal` mirrors Task 4's order and messages, using `fakePlaceAt`/`fakeZonesNear`.

- [ ] **Step 1: Write the failing unit and contract tests.**
  - `tests/unit/listing.test.ts`:
    - `STEPS` equals `[1,2,4,5,6,7,8,9]`; `stepPosition(4)` = 3; `stepPosition(9)` = 8.
    - `stepFromParam("3")` → `{ redirect: 2 }`; `("2")` → `{ step: 2 }`; `("10")` and `("x")` → `null`.
    - `resumeStep` never returns 3 (a draft with zone but no pin resumes at 2).
    - `validateStep(2, …)` for each message above.
    - `wizardStage(4)` → `{ name: "Su casa", position: 3, size: 4 }`.
    - `locationLine(...)` → «Cocles · Cahuita, Talamanca, Limón».
    - Remove the old `validateStep(2/3)` cases («Elija la provincia.», «Elija el cantón.», etc.).
  - `tests/contract/publish.contract.ts` `WALK`: replace steps 2 and 3 with one step 2.
    - invalid:
      - `{lat:null,lng:null}` → «Marque en el mapa…»;
      - `{lat:40.4,lng:-3.7}` → «Ponga el punto…»;
      - `{...COCLES, province:"", canton:""}` → «Ponga el punto…»;
      - `{...ok, zone:" "}` → «Elija la zona.»;
      - `{...ok, zone:"x".repeat(61), zoneSource:"other", zoneId:null}` → «La zona puede tener como mucho 60 caracteres.».
    - valid: `{ lat: 9.7366, lng: -82.8431, province: "Limón", canton: "Talamanca", district: "Cahuita", zone: "Cahuita", zoneId: "704-cahuita", zoneSource: "list" }`.
    - Add a submit case: a draft whose `canton` is «Limón» at the Cahuita point is stored with «Talamanca» in **both** adapters (fake parity).

- [ ] **Step 2: Run.** `pnpm test`. Expected: FAIL (types and exports missing; old WALK messages).

- [ ] **Step 3: Implement the model.**
  - `listing.ts`: the new `Step`, `normalize` (`'other'`/`'district'` → `zoneId = null`), `validateStep(2)`, and the removal of `case 3` and the `esCanton` import.
  - `rows.ts`: map `district`, `zone_id` and `zone_source` both ways.
  - `step-forms.ts`: schema 2; no 3.
  - Fake: owner `submitRefusal` and admin mapping.
  - `publicar.tsx`: `toStep` → `stepFromParam`. With `redirect`, render `<Navigate to="/propietario/publicar/$id/$paso" params={{ id, paso: String(redirect) }} replace />`. The progress bar maps over `STEPS`; `StageLabel` shows «Paso {stepPosition} de {STEP_COUNT}».
  - `fields.tsx`:
    - `SendSummary` row «Dónde» → `locationLine(d)` or «Falta la ubicación», linking to step 2.
    - `case 2` → `<h2>¿Dónde está su casa?</h2><LocationStep … />`; delete `case 3` and `PlaceFields`.
    - Update the comments that say «nueve pantallas».

- [ ] **Step 4: Write the failing e2e** `tests/e2e/ubicacion.spec.ts`.

  Setup: viewport 375×667; tiles and Photon intercepted as in today's `zonas.spec.ts`; seed a draft with `COMPLETE` and `zone: "", lat: null, lng: null, zoneSource: null, zoneId: null`; `injectSession(page, "owner")`. Tap the map with `const b = await page.locator(".map-box").boundingBox(); await page.mouse.click(b!.x + b!.width / 2, b!.y + b!.height / 2)`.

  Tests:
  1. «busca Cocles, toca el mapa: Talamanca, Limón y Cocles elegida». Go to `/2`. Since Task 8 adds the search, this test first enters via the draft's pin: seed `lat/lng` = the Cocles zone point and assert on load. Task 8 replaces the entry with the search. Assert `getByText("Talamanca, Limón")` and that `getByRole("combobox", { name: "Zona" })` shows «Cocles». «Continuar» is enabled, and `expectNoScroll`.
  2. «mover el punto a Limón centro cambia la línea y la zona». With the draft's pin at Limón centro, tap the center again, then drag the marker (`.pin-icon`) 40 px with `page.mouse.down/move/up`. Assert at least one new `rpc/place_at` request (count with `page.on("request")`) and the line «Limón, Limón» with the zone «Limón centro».
  3. «el paso 3 viejo lleva a la pantalla nueva». `page.goto(/propietario/publicar/${id}/3)` → `toHaveURL(/\/2$/)` and the heading «¿Dónde está su casa?».
  4. «la primera respuesta llega tarde y no pisa a la segunda». `page.route("**/rest/v1/rpc/place_at", …)` delays only the first call by 1500 ms. Tap Limón centro (pin seeded there), then within 300–600 ms tap at a pixel the test maps from a known second point (zoom in first so both are on land). Assert the final line is the second place's, and it stays so 2 s later.
  5. «sin red al mover el punto: aviso, Continuar deshabilitado y se recupera». `context.setOffline(true)`; tap → «No pudimos ubicar el punto. Revise su conexión.» and «Continuar» disabled. `context.setOffline(false)` → the line returns automatically; «Continuar» is enabled.

  Update `tests/e2e/publicar.spec.ts`: «las ocho pantallas», step 2 uses the new screen and the step 3 block goes. Run with `CHROMIUM_PATH=… pnpm test:e2e tests/e2e/ubicacion.spec.ts`. Expected: FAIL.

- [ ] **Step 5: Implement the screen.**
  - `LocationStep` holds pin state from `draft.lat/lng`. `createPlaceLookup(await places(), setState)` is created in an effect and disposed on unmount. Each pick calls `lookup.set(pin)`; a draft with a pin triggers one lookup on mount.
  - The place line sits in a fixed-height box (`.place-line { min-height: 2.75rem }`) and shows the copy from Global Constraints for `loading` / `ready` / `ready` with null / `error` (with «Reintentar» → `lookup.retry()`).
  - Zone state:
    - initial = `draft.zoneSource ? { name: draft.zone, source, zoneId, anchor: source === "other" ? pin : null } : null`;
    - on each `ready` → `reconcileZone(choice, state.point, zoneOptions(state.near, state.place), state.place)`.
  - `useStepReady(!!pin && state.status === "ready" && !!state.place && !!choice)`.
  - Hidden inputs are filled from the state (province, canton and district from `state.place`).
  - `LocationPicker` keeps its role and API but takes `onPick` and exposes `view()` through a ref. It starts at the pin, or `PROVINCE_CENTERS["Limón"]` at zoom 9.
  - Map share: the map box grows (`flex: 1; min-height: 200px`) so the whole screen fits 375×667 without scroll; `expectNoScroll` enforces it. The spec's «~55 %» is the target where space allows.
  - Keep the OSM attribution visible and «Usar mi ubicación».
  - `step-form.tsx`: `ReadyContext` provider; the submit button is `disabled={sending || !ready}`.

- [ ] **Step 6: Run.** `pnpm test`, `pnpm typecheck`, `pnpm test:db`, `pnpm build`, then `CHROMIUM_PATH=… pnpm test:e2e tests/e2e/ubicacion.spec.ts tests/e2e/publicar.spec.ts`. Expected: PASS.

- [ ] **Step 7: Commit.**
  ```
  git add apps/app/src apps/app/tests
  git commit -m "Une los pasos 2 y 3 en «¿Dónde está su casa?»: el pin decide cantón y provincia y la zona sale de lo cercano"
  ```

## Task 8: Search combobox, «Otra…» with Photon, and removal of the old fields

**Files:**
- Create `src/client/publish/place-search.tsx`.
- Modify `zone-select.tsx`, `location-step.tsx`, `src/domain/zones.ts` (drop the old exports), `tests/unit/zones.test.ts`, `tests/e2e/ubicacion.spec.ts`, `src/styles/global.css`, and `apps/app/.size-limit.json` only if Step 5 justifies it.
- Delete `src/domain/cantones.ts`, `tests/unit/cantones.test.ts`, `src/client/publish/zone-field.tsx`, `src/client/publish/zone-center.ts`, `tests/e2e/zonas.spec.ts`.

**Interfaces:**
```ts
// place-search.tsx: el combobox de zone-field.tsx (espera de 300 ms, AbortController, flechas/Enter/Escape, crédito de OSM) hecho genérico
export function PlaceSearch(props: {
  label: string; placeholder: string;
  local(text: string): { key: string; name: string; detail: string; point: LatLng | null }[];   // zonas de la lista
  photon(text: string): string | null;                                                          // URL o null (texto corto)
  near: LatLng; withinM?: number;
  extra?(text: string): { key: string; name: string; detail: string; point: null } | null;       // «Usar "…"»
  onChoose(item: { name: string; point: LatLng | null; key: string }): void;
}): JSX.Element;
// domain/zones.ts after the cleanup: FREQUENT_ZONES, frequentZone, zoneCenter and the old photonUrl/parsePhoton(prefer) go;
// ZONE_QUERY_MIN, ZONE_DEBOUNCE_MS, ZONE_SUGGESTIONS, ZONE_ZOOM, PHOTON_ORIGIN stay.
```

- [ ] **Step 1: Write the failing tests.**
  - `tests/e2e/ubicacion.spec.ts`, test 1 rewritten:
    - focus «Busque un pueblo, playa o barrio» with no text → the list shows «Cocles» among zones from the DB, before any Photon request (`photon.length === 0`);
    - type «Cocles» → choose it → the input loses focus (`toBeFocused` false), and the pin is still absent (`.pin-icon` count 0) because the search only moves the map;
    - tap the center → «Talamanca, Limón» with «Cocles» selected.
  - Same file, test 2: the entry is a search for «Limón centro».
  - New test 6, «Otra… con un nombre inventado y Usar»:
    - choose «Otra…» in «Zona»;
    - the combobox «Otra zona» appears; type «Rancho Escondido» (Photon answers `[]`);
    - the last item is `Usar "Rancho Escondido"`; click it;
    - «Zona» shows «Rancho Escondido» and the hidden `zoneSource` is `other`;
    - the Photon request carries a 5 km `bbox` around the pin (check `photon.at(-1)!.searchParams.get("bbox")` against `bboxAround(pin, 5000)` with 3 decimals).
  - `tests/unit/zones.test.ts`: drop the `FREQUENT_ZONES`/`frequentZone`/`zoneCenter`/`parsePhoton(prefer)` cases and keep the Photon URL tests rewritten for `photonNearUrl`.

- [ ] **Step 2: Run.** `CHROMIUM_PATH=… pnpm test:e2e tests/e2e/ubicacion.spec.ts`. Expected: FAIL (no search box, no «Otra…»).

- [ ] **Step 3: Implement.**
  - The search uses `PlaceSearch` with `local = searchZones(zonesQuery.data, text)` and `photon = photonNearUrl(text, mapCenter)`. On choose, `picker.view(point, ZONE_ZOOM)` and `input.blur()`. It never sets the pin or a form field.
  - `zonesQuery` is `queryOptions({ queryKey: ["zones"], queryFn: async () => (await places()).listZones(), staleTime: 86_400_000 })`, one query function for this screen.
  - `ZoneSelect` is a native `<select aria-label="Zona">`:
    - the options from `zoneOptions`;
    - if the choice is `'other'`, an extra option with its name;
    - last, «Otra…».
  - Choosing «Otra…» reveals `PlaceSearch` labelled «Otra zona», with `photon = photonNearUrl(text, pin, 5000)`, `parsePhotonNear(..., pin, 5000)` and `extra = text.trim() ? Usar "${text.trim().slice(0, 60)}" : null`. Choosing sets `{ name, source: "other", zoneId: null, anchor: pin }`.
  - Enter inside either combobox never submits the step (keep `stopPropagation` from `zone-field.tsx`).
  - Delete the old files and exports listed above.
  - `grep -rnE "cantones|FREQUENT_ZONES|zoneCenter|rememberZone|PlaceFields|ZoneField" apps/app/src apps/app/tests` must print nothing.

- [ ] **Step 4: Run.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `CHROMIUM_PATH=… pnpm test:e2e tests/e2e/ubicacion.spec.ts tests/e2e/publicar.spec.ts`. Expected: PASS.

- [ ] **Step 5: Size gate.** Run `pnpm size`. Expected: «Asistente de publicar» ≤ 15 KB and «Zona privada» ≤ 150 KB.
  - If the publish chunk exceeds its limit, first move the `PlaceSearch` Photon code behind the same lazy boundary as Leaflet.
  - Raise the limit only with a one-line reason in the entry name and in Task 10's decision.

- [ ] **Step 6: Commit.**
  ```
  git add -A apps/app/src apps/app/tests apps/app/.size-limit.json
  git commit -m "Añade el buscador del mapa y «Otra…» con Photon a 5 km, y quita cantones, zonas frecuentes y la zona en texto libre"
  ```

## Task 9: Admin badge and OSM attribution in Ayuda

**Files:** modify `src/client/screens/admin.tsx`, `src/client/screens/cuenta.tsx` (`AyudaScreen`), `tests/e2e/ubicacion.spec.ts`, `tests/unit/listing.test.ts` (already covers `locationLine`/`isProposedZone`), and `src/styles/global.css` if a badge class is needed.

- [ ] **Step 1: Write the failing e2e.** Extend test 6 in `ubicacion.spec.ts`:
  - after «Usar "Rancho Escondido"», continue to step 9 (the seeded draft has 5 photos and everything else complete) and «Enviar a revisión»;
  - in a second context, enter as admin with the second factor (reuse `adminCode()`/`secondCode(page)` from `tests/e2e/admin.spec.ts`; move them to `tests/e2e/helpers/admin.ts` if both files need them);
  - open `/admin/anuncios/${id}` and expect `getByText("Rancho Escondido · Cahuita, Talamanca, Limón")` and `getByText("Zona propuesta por el dueño")`.
  - Add a second check: open `/ayuda` and expect a link «colaboradores de OpenStreetMap» with `href` `https://www.openstreetmap.org/copyright` and the text «Open Database License (ODbL)».

- [ ] **Step 2: Run.** `CHROMIUM_PATH=… pnpm test:e2e tests/e2e/ubicacion.spec.ts`. Expected: FAIL (old facts line, no badge).

- [ ] **Step 3: Implement.**
  - `ReviewDetail` facts use `locationLine(l)` instead of `[l.zone, l.canton]`, and `isProposedZone(l)` renders `<span className="badge badge-sun">Zona propuesta por el dueño</span>` next to that line. The queue card (`l.zone`) stays as is.
  - In `AyudaScreen`, add after the card: `<p className="xs muted">Límites administrativos © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a>, disponibles bajo la Open Database License (ODbL).</p>`.

- [ ] **Step 4: Run.** The same e2e plus `CHROMIUM_PATH=… pnpm test:e2e tests/e2e/admin.spec.ts tests/e2e/cuenta.spec.ts`. Expected: PASS.

- [ ] **Step 5: Commit.**
  ```
  git add apps/app/src apps/app/tests
  git commit -m "Marca en la revisión las zonas propuestas por el dueño y cita los límites de OpenStreetMap en Ayuda"
  ```

## Task 10: Documentation (same day)

**Files:** modify `docs/decisiones.md`, `docs/diseno-v1.md`, `docs/telemetria.md`, `docs/publicacion.md`. Check `docs/antes-de-produccion.md` (done in Task 3).

- [ ] **Step 1: `docs/decisiones.md`.** Add a new **top** entry «## 2026-10-27 · Ubicación por punto: el mapa decide provincia, cantón y zona». Contents:
  - The pin is the source of truth; province, canton and district are computed in Postgres and cannot be edited.
  - The cascade selects and free-text zone are replaced by a select of zones within 5 km, plus the district, plus «Otra…» (Photon within 5 km and `Usar "…"`).
  - Boundary source: OSM admin_level 4/6/8 (Overpass, `<date>`), ODbL, polygons in the private schema `geo` and never exposed. Conte Burica (14365588, expediente 25.750) is excluded and joined to Pavón. Cabagra = 60310, assigned by hand. IGN rejected (commercial-use terms), INEC/HDX, geoBoundaries and GADM rejected (reasons from the spec).
  - 500 m coast fallback.
  - The data file is loaded through a symlinked migration, or a copy if the CLI refused it.
  - Step ids stay stable (1, 2, 4–9), so old URLs keep working; `/3` redirects to `/2`. The spec said «step numbers shift»; this is the safer equivalent.
  - The Caribe zones were loaded **without Daniel's review** (pending, `zonas.md`), and `city|town` was added to the OSM query.
  - The zones table lives in `public` with `lat/lng` generated from `point`.
  - Any `size-limit` change.

- [ ] **Step 2: `docs/diseno-v1.md`.** In item 11:
  - «9 pantallas» becomes «8 pantallas (ids 1, 2, 4–9 en la ruta)»;
  - point (2) is replaced by the new screen (search, map, computed line, zone select with «Otra…»);
  - point (3) is removed;
  - the header reads «Paso n de 8».

- [ ] **Step 3: `docs/telemetria.md`.** Above the `wizard_step` query, add:
  «Desde el 2026-10-27 la pantalla 3 (mapa) no existe: la 2, «¿Dónde está su casa?», la incluye. Los números de la ruta son ids de pantalla, no posiciones; los datos de antes y después se comparan tal cual salvo el 3».

- [ ] **Step 4: `docs/publicacion.md`.** Add a section «Ubicación (2026-10-27)» with:
  - the rules (pin, server-computed location, 5 km, «Otra…» up to 60 characters, «Zona propuesta por el dueño» in the review);
  - the admin query for repeated proposed names:
    `select zone, count(*) from listings where zone_source = 'other' group by 1 having count(*) > 1 order by 2 desc;`
  - «se añaden a `zones` con una migración».

- [ ] **Step 5: Commit.**
  ```
  git add docs
  git commit -m "Documenta la ubicación por punto: decisiones, diseño del paso 2, telemetría y reglas de publicación"
  ```

## Task 11: Final verification

- [ ] **Step 1: Run the full suite.**
  - Repo root: `pnpm db:reset`.
  - From `apps/app`, in order:
    - `pnpm typecheck`
    - `pnpm test`
    - `pnpm test:db`
    - `pnpm build`
    - `pnpm size`
    - `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e`
    - `pnpm lighthouse`
  - Repo root: `pnpm test:prototype`.

  Expected: all green, with no hydration warnings on the ficha test.

- [ ] **Step 2: Check what leaves the database.**
  - `grep -rn "district_shapes\|admin_names" apps/app/src` prints nothing.
  - `grep -rn "geom" apps/app/src/domain/database.types.ts` shows only `zones.point`, which is not granted.
  - `pnpm test:db tests/db/ubicacion-limites.test.ts` passes.

- [ ] **Step 3: Look at it on the phone viewport.**
  - Start the `app` launch config.
  - Open a draft at `/propietario/publicar/<id>/2` in the mobile preset.
  - Check: no scroll at 375×667; the line box does not jump while it loads; the OSM attribution is visible; «Otra…» works with the keyboard open.
  - Do not use `pruebas.bnbtico.com`.

- [ ] **Step 4: Hand-off note.** Not done by this plan. Report it to the user so Daniel can schedule it:
  - Before `supabase db push` to `bnbtico-pruebas`, confirm there are 0 listings with the management API (the mensual reset already ran).
  - The push includes the `distritos_osm` migration (about 8 MB).
  - Daniel still has to review `zonas.md`.

---

## Self-review

- **Spec coverage:**

  | Spec item | Task |
  |---|---|
  | PostGIS in `extensions`, private boundary tables, GiST, subdivide | 2 |
  | OSM source, Conte Burica, codes, 7/84/494, header, regeneration script | 1 |
  | 500 m fallback | 2, and 6 for the fake |
  | `zones` with RLS and admin writes, the Caribe draft, the Talamanca list | 3 |
  | `place_at` and `zones_near` signatures and grants | 2, 3 |
  | `submit_listing` recompute and zone rules | 4 |
  | New columns, `listings_public` unchanged | 4 |
  | Seeds and fixtures | 4 |
  | Screen: search, map, line, zone select, «Otra…», `Usar "…"`, «Continuar» gating | 7, 8 |
  | Removals | 8 |
  | Old step redirect | 7 |
  | Admin badge | 9 |
  | ODbL attribution | 9 |
  | Docs (decisiones, diseño, telemetría, publicación) | 10 |
  | Vitest, DB and contract tests | 2–7 |
  | Playwright 1–4 | 7, 8, 9 |
  | Size and Lighthouse gates | 8, 11 |

- **Deviations, each decided and documented in Task 10:**
  - **Stable step ids instead of renumbering.** Renumbering makes old URLs `/4`–`/8` ambiguous and breaks the spec's own «old 3 lands on the merged screen» test.
  - **Private `geo` schema.** It is stronger than «no grants».
  - **`zones.lat/lng` generated columns.**
  - **`city|town` added** to the OSM place query.
  - **Zones loaded unreviewed**, because Daniel is unavailable.
- **Type consistency:**
  - `ZoneSource`, `Place`, `NearZone`, `Zone` and `ZoneChoice` are defined once, in `domain/zones.ts` (Task 5), and used in Tasks 6–9.
  - The `Step` change (Task 7) is the only cross-cutting type change. Grep `STEPS|LAST_STEP|resumeStep|wizardStage|STEP_NAMES` across `src` after Task 7; screens left over from navegación simple may still use it.
- **Open risks:**
  - Overpass capacity. Mitigated by the backoff and cache, with the Geofabrik + GDAL fallback asked first.
  - The Supabase CLI and symlinked migrations: verified in Task 2, with a fallback.
  - Exact OSM coordinates of the zones: the tests assert names and order, not metres.
