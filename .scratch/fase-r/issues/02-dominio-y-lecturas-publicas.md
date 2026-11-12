# 02: Domain foundation and public reads

**What to build:** the framework-free domain module every later ticket depends on, proven with the first real data path: public listings read from PostgREST through the `ListingsApi` interface, with the same contract suite passing against the in-memory fake and against PostgREST on local Supabase. Includes the additive migration that lets the catalog be one query.

**Blocked by:** 01 (Skeleton, pipeline and first deploy).

**Status:** done (2026-10-22)

- [x] Database types generated from the local schema and committed; a CI step regenerates them and fails on a diff.
- [x] Pure modules moved from the old app with their unit tests: per-step validation and normalisation, filters, cantones, geo (approximate point), money and currency formatting, phone, share text, SEO text, image resize helpers. Zod schemas replace the hand-written form parsers with identical semantics.
- [x] Typed row mapping in one place; `acceptsNightly` handled consistently for owner and public rows.
- [x] `describe(listing)` returns main price, unit (noche/mes), situation copy per status, share URL and preview text; table-driven tests cover every status and price combination that the old app rendered in six places.
- [x] `can(listing, action)` for edit, discard, submit, reopen mirrors the SQL rules (editable only in draft/changes; discard only for never-reviewed drafts; reopen only from active/changes/rejected); table-driven tests.
- [x] `ListingsApi` and `AuthApi` interfaces declared with domain types and a domain error type carrying a Spanish message; the PostgREST adapter is the only module importing supabase-js.
- [x] In-memory fake for `ListingsApi` that enforces ownership and status rules and returns the same Spanish messages as the DB for the covered cases.
- [x] Contract harness: one suite file per capability, parametrised by adapter; runs in unit tests against the fake and in the database test project against PostgREST with the test numbers.
- [x] First contracts green on both adapters: `searchPublic` with every filter, `getPublic` for active, never-sent (not found) and reviewed-then-hidden (blocked) listings, `linkState`, provinces with listings.
- [x] Migration `cliente_directo`, part one: `listings_public` exposes an ordered `photos` array; a `provinces_with_listings` view; database tests for both.
- [x] Error mapping: DB-raised messages pass through; PostgREST/GoTrue codes map to Spanish messages; anything else becomes one generic Spanish message; the "looks Spanish" regex is gone.

## Cierre (2026-10-22)

- Dominio en `apps/app/src/domain` (sin frameworks; solo zod): `listing`, `step-forms` (zod), `filters` (zod), `cantones`, `geo`, `money`, `currency`, `phone`, `share`, `seo`, `image`, `rows`, `describe`, `can`, `errors`, `api`, `database.types` (generado con `pnpm --filter app db:types`).
- Interfaces: `ListingsApi` = `PublicListingsApi` + `OwnerListingsApi` + `photos` + `admin`, y `AuthApi`. En este ticket los adaptadores implementan `PublicListingsApi`; el resto llega con los tickets 05–09.
- Adaptadores: `src/data/postgrest/listings.ts` (único que importa supabase-js; lo vigila `tests/unit/architecture.test.ts`) y `src/data/fake/` (en memoria).
- Contrato: `tests/contract/public-reads.contract.ts`, corre en `pnpm test` (fake) y en `pnpm test:db` (PostgREST local).
- Migración `20261023051419_cliente_directo.sql`: `photos` (rutas ordenadas) en `listings_public` y la vista `provinces_with_listings`. Aplicada en local; **falta aplicarla al proyecto alojado** (`supabase db push`), es aditiva y la app vieja la tolera (sus 20 pruebas de base pasan con ella).
- Cambios de semántica a propósito: el texto de vista previa añade «orientativo» también al precio mensual y escribe «1 persona» en singular; el paso 7 ya no lee el número de fotos del formulario.
- CI: Supabase local en el runner, `db:types` + `git diff --exit-code`, `test:db`.
- Pruebas: unitarias 182/182, base 15/15, Playwright 3/3; tamaño de la zona privada sin cambios (101,75 KB gz).

