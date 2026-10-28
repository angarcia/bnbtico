# Alquiler mensual como característica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Every house is rented by the night. «Alquiler mensual» becomes an optional characteristic. Its monthly price is optional: when it is empty, the house shows «Precio a negociar con el dueño». In Explorar, one chip «Alquiler mensual» (`?mensual=1`) replaces the Vacacional/Mensual chips.

**Architecture:** One migration makes `accepts_monthly` not null (default false) and guards `accepts_nightly` with `check (accepts_nightly)`. It also redefines `submit_listing` (nightly price required, monthly price optional) and adds `monthly_filter_tap` to `events_name_check`. The domain (`src/domain`) owns these rules:
- `validateStep` / `normalize` / `parseStep` for the price step;
- `describe()` returns `mainPrice` (nightly) plus `monthly` (amount, negotiable or null);
- `Filters.monthly` and `effectiveFilters()` drop the price range while the filter is on.

The PostgREST adapter and the in-memory fake both apply `eq("accepts_monthly", true)`. The contract suite checks both. The screens (wizard step 1 and the price step, Explorar, Filtros, card, ficha, owner detail, admin review) only render what the domain returns.

**Tech Stack:** Vite + React 19 + TanStack Router/Query, TypeScript strict, zod/mini, Supabase Postgres (RLS, plpgsql RPCs) via PostgREST, Vitest (unit / db / contract), Playwright (mobile viewport), Cloudflare Worker (SSR of `/casa/CT-####`, `POST /events`).

**Spec:** `.scratch/mensual-como-caracteristica/spec.md` (2026-10-27). Runs **after** `.scratch/navegacion-simple/spec.md`: that spec owns the top bar, the ₡/$ switch, Mis casas single-listing view and the deletion of `InicioScreen`. This plan touches only:
- Explorar's chip row and the results count `<span data-testid="results-count">`;
- the cards;
- Filtros;
- the price step;
- the ficha body and CTA bar.

---

## Global Constraints

- UI copy in español de Costa Rica, always **usted**; no voseo, no tuteo.
- Exact strings (verbatim, case included):
  - Chip / Filtros toggle / ficha feature: `Alquiler mensual`
  - Price step question: `¿Acepta alquiler por meses?` with options `No` (default) and `Sí`
  - Price step fields: `Precio por noche` (required); `Precio al mes (opcional)`
  - Help under the monthly field: `Si lo deja vacío, en su ficha dirá «Precio a negociar con el dueño».`
  - Results line, filter on: `N casas aceptan alquiler mensual` / `1 casa acepta alquiler mensual`; filter off: `N casas`. The existing ` en <provincia>` suffix is kept at the end in both cases.
  - Card price, filter on: `₡350 000 / mes` or `Precio a negociar`; filter off: `₡45 000 / noche`. The price always carries its unit.
  - Ficha CTA secondary line: `Mensual: ₡350 000 / mes` or `Mensual: precio a negociar con el dueño`
  - «¿No encuentra lo que busca?» line: `Busca alquiler mensual.` (replaces `Modalidad: …`)
- Error messages (the same text in domain, fake and SQL):
  - `Indique el precio por noche en colones.`
  - `Indique el precio al mes en colones o déjelo vacío.`
- Money is an integer in colones. Format with `formatCRC` / `formatMoney`: `₡95 000` (narrow no-break space, tabular figures). Dollars are only a display conversion. Never write «total a pagar».
- Migrations: `pnpm exec supabase migration new <name> < /dev/null` (from the repo root). Never edit `supabase/migrations/0001_init.sql`.
- Any `update` on `listings` inside a migration is preceded by `select set_config('app.allow_status', 'on', true);` (`listings_protect`).
- After any schema change: `pnpm db:reset` (repo root), then `pnpm db:types` (from `apps/app`). Commit the regenerated `apps/app/src/domain/database.types.ts`.
- Every table, constraint or RPC change has db/contract tests (PostgREST **and** fake) before any screen uses it.
- Test first: write the failing test, run it, see it FAIL, implement, see it PASS.
- Commands run from `apps/app` unless stated otherwise:
  - `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`, `pnpm size`;
  - e2e: `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e --workers=1 <spec>` (mobile viewport, one worker).
- Local Supabase only (`pnpm db:start` / `pnpm db:reset`). Implementation tasks never touch `bnbtico-pruebas` or bnbtico.com. No `git push`.
- Commits: Spanish, imperative, one per task with tests green, **no co-author line**. Paths are listed per task.
- Legacy columns `monthly_mode`, `min_nights` and `min_months` stay in the table. New code neither reads nor writes them: `normalize` stops setting `monthlyMode = "amount"`.
- Out of scope: a monthly price-range filter, minimum stays, monthly calendar availability, dropping legacy columns, the prototype (`design/prototype/` is not changed; its tests must still pass).

## Review Focus

These are the five likeliest failure modes that the tests would not catch on their own. Each one has a pinned test in the task that owns it.

1. **Owner toggles Sí, types a price, then No: the price must not be saved.** Two layers cover this:
   - `parseStep` drops `monthlyPriceCrc` when `acceptsMonthly` ≠ `yes`, and `normalize` clears it when `acceptsMonthly` is false.
   - The UI clears the field, so Sí again shows it empty.

   Tests:
   - Task 2: `parseStep(8, {acceptsMonthly:["no"], monthlyPriceCrc:["480000"]})` → `monthlyPriceCrc: null`.
   - Task 2: contract «Sí con precio y luego No» stores `monthlyPriceCrc: null` in both adapters.
   - Task 4 (e2e): after Sí, 480.000, No, Sí, the field is empty; the stored row has `monthly_price_crc` null.
2. **Old links `?modo=both` / `?modo=nightly` / `?modo=monthly`.**
   - `both` and `nightly` must land unfiltered, not monthly.
   - `monthly` must land with the chip on and serialise back as `mensual=1`, never `modo`.

   Tests:
   - Task 5 unit: `parseFilters({modo:"both"}).monthly === false`, `normalizeSearch({modo:"monthly"})` → `{mensual:"1"}`.
   - Task 5 contract: `filters({modo:"both"})` equals `filters()`.
   - Task 6 e2e: `/explorar?modo=monthly` has the chip pressed.
3. **Filter on with `min`/`max` in the URL.**
   - The query must ignore the range.
   - The URL must keep it, and turning the filter off restores it.
   - «Más filtros» must not count it while it is hidden.

   Tests:
   - Task 5 unit: `effectiveFilters`, `toSearchParams` keeps `min`/`max`, `extrasCount`.
   - Task 5 contract: `filters({mensual:"1", min:"50000", max:"100000"})` returns the monthly houses whatever their nightly price.
   - Task 6 e2e: the price section is hidden while the filter is on and back with its values when it is off.
4. **`accepts_monthly` with price 0 or a non-number.**
   - The table check `monthly_price_crc > 0` already rejects 0.
   - The domain must reject `0` / `abc` typed with Sí.
   - `describe()` must treat any stored non-positive value as negotiable and never show `₡0 / mes`.

   Tests:
   - Task 2 unit: `validateStep(8, {acceptsMonthly:true, monthlyPriceCrc:0})` and `NaN` → monthly error.
   - Task 1 db: `submit_listing` accepts null and the table rejects 0.
   - Task 3 unit: `describe` with `monthlyPriceCrc: 0` gives `{negotiable:true}`.
5. **SSR ficha of a negotiable monthly house.** The server HTML must already contain «Alquiler mensual» and «Mensual: precio a negociar con el dueño». Hydration must not warn (the line must not depend on currency or hydration). The CTA bar must not grow at 320 px.

   Test: Task 3 e2e in `ficha.spec.ts`, which reads the raw response, checks `data-hydrated` and asserts that the `console` warnings/errors list is empty.

## File Structure

| File | Change |
|---|---|
| `supabase/migrations/<ts>_mensual_como_caracteristica.sql` | **new**: column, check, `submit_listing`, `events_name_check` |
| `apps/app/src/domain/database.types.ts` | regenerated |
| `apps/app/src/domain/listing.ts` | `ListingDraft.acceptsMonthly: boolean`, `emptyDraft`, `normalize`, `validateStep` 1 and 8, error consts, `MONTHLY_LABEL`; remove `modesLabel` (Task 4) |
| `apps/app/src/domain/step-forms.ts` | step 1 = kind only; price step parses `acceptsMonthly` |
| `apps/app/src/domain/rows.ts` | `accepts_monthly` read/written as boolean |
| `apps/app/src/domain/describe.ts` | `prices()` → `mainPrice` + `monthly`; `cardPrice`, `monthlyLineText`, consts |
| `apps/app/src/domain/preview.ts` | `acceptsNightly: true` |
| `apps/app/src/domain/filters.ts` | remove `Mode`, `MODES`, `MODE_CHIPS`, `ModeParam`, `modeFilter`, `toggleMode`, `modesFrom`, `modeParam`; add `monthly`, `mensual` param, legacy `modo`, `effectiveFilters`, `resultsText` |
| `apps/app/src/domain/search-help.ts` | `Busca alquiler mensual.`; no price line while monthly |
| `apps/app/src/domain/telemetry.ts`, `apps/app/src/shared/beacon.ts` | `monthly_filter_tap` |
| `apps/app/src/data/postgrest/listings.ts`, `apps/app/src/data/fake/listings.ts` | monthly filter, `effectiveFilters` |
| `apps/app/src/data/postgrest/owner.ts`, `apps/app/src/data/fake/owner.ts` | new draft `accepts_nightly: true, accepts_monthly: false`; fake `submitRefusal` |
| `apps/app/src/client/queries.ts` | `listingsQuery` key from `effectiveFilters` |
| `apps/app/src/client/publish/fields.tsx` | step 1 without «¿Cómo alquila?»; `MonthlyQuestion`; step 9 summary |
| `apps/app/src/client/screens/explorar.tsx` | one chip, results line, cards get `monthly` |
| `apps/app/src/client/screens/filtros.tsx` | toggle after the nine features; price section hidden while monthly |
| `apps/app/src/client/listing-card.tsx` | `monthly` prop, `cardPrice`, no «Mensual» pill |
| `apps/app/src/shared/listing-page.tsx` | no `modesLabel` badge, «Alquiler mensual» tile, CTA monthly line |
| `apps/app/src/shared/monthly-line.tsx` | **new**: `MonthlyLine`, shared by the ficha and the owner detail |
| `apps/app/src/client/screens/propietario.tsx` (or wherever navegacion-simple moved `Detail`) | monthly line; ready-list copy |
| `apps/app/src/client/screens/admin.tsx` | `ReviewDetail` facts and monthly price |
| Tests | `tests/unit/{listing,describe-can,preview,filters,search-help,search-help-note,telemetry,worker,errors-rows}.test.ts(x)`; `tests/contract/{harness,publish,calendar,public-reads}.contract.ts`; `tests/db/{postgrest-harness.ts,listings-alta-segura.test.ts,cliente-directo-fotos.test.ts,telemetria.test.ts,mensual-como-caracteristica.test.ts (new)}`; `tests/e2e/{publicar,explorar,ficha,no-encuentra}.spec.ts` |
| Docs | `docs/decisiones.md`, `CLAUDE.md`, `docs/diseno-v1.md`, `docs/telemetria.md` |

**Step numbering:** the price step is step 8 today (`STEP_NAMES[7] === "Precio"`). If `.scratch/ubicacion-por-punto` lands first, steps 2 and 3 merge and the price step is step 7. Wherever this plan says «price step (8)», use the number whose `STEP_NAMES` entry is `"Precio"`.

---

## Task 0: Pre-flight

**Files:** none (read only).

- [ ] Confirm that navegacion-simple is merged on `develop`:
  - `git log --oneline -15`;
  - `grep -rn "TopBar" apps/app/src/client/chrome.tsx`;
  - `grep -n "CurrencySwitch" apps/app/src/client/screens/explorar.tsx`.

  If the switch is still in Explorar's results row (its «does not fit» fallback), leave that sibling untouched in Task 6.
- [ ] Check where `Detail` lives now: `grep -rn "function Detail\|El precio por noche o por mes" apps/app/src`. Note the paths for Tasks 3 and 4.
- [ ] Check the price step number: `grep -n "STEP_NAMES" apps/app/src/domain/listing.ts`.
- [ ] Check the latest `submit_listing`: `grep -ln "function public.submit_listing" supabase/migrations/*`. Copy from the **newest** file. Today that is `20261027040909_nombre_y_descripcion.sql`; ubicacion-por-punto may have redefined it with district/zone checks, and those must be kept.
- [ ] `pnpm db:start` (repo root), then `pnpm db:reset`. From `apps/app`: `pnpm test && pnpm test:db`. Both must be green before you start.

---

## Task 1: Migration `mensual_como_caracteristica` with db tests

**Files:**
- Create `supabase/migrations/<ts>_mensual_como_caracteristica.sql`.
- Create `apps/app/tests/db/mensual-como-caracteristica.test.ts`.
- Modify:
  - `apps/app/tests/db/telemetria.test.ts`
  - `apps/app/tests/db/postgrest-harness.ts` (l.49)
  - `apps/app/tests/db/listings-alta-segura.test.ts` (l.12)
  - `apps/app/tests/db/cliente-directo-fotos.test.ts` (l.162, 180, 186)
  - `apps/app/src/data/postgrest/owner.ts` (`createDraft`, l.74)
  - `apps/app/src/domain/database.types.ts`

**Interfaces (SQL):**
- `listings.accepts_monthly boolean not null default false`
- `constraint listings_accepts_nightly check (accepts_nightly)`
- `submit_listing(p_listing uuid) returns listing_status` changes from the newest copy:
  - delete the line `Marque Vacacional, Mensual o las dos.`;
  - the nightly line becomes `if coalesce(l.nightly_price_crc, 0) <= 0 then raise exception 'Indique el precio por noche en colones.'; end if;`;
  - the monthly line becomes `if l.accepts_monthly and l.monthly_price_crc is not null and l.monthly_price_crc <= 0 then raise exception 'Indique el precio al mes en colones o déjelo vacío.'; end if;`.
- `events_name_check`: `('page_view','listing_view','whatsapp_tap','inquiry_created','wizard_step','search_help_tap','monthly_filter_tap')`

Steps:

- [ ] **Failing test.** Create `tests/db/mensual-como-caracteristica.test.ts`. Follow the pattern of `nombre-descripcion.test.ts`: `postgrestHarness()`, `h.reset()`, `sql()` from `./local`, `signIn` / `serviceClient` as in `listings-alta-segura.test.ts`. Cases:
  1. «un borrador nuevo nace por noches y sin mensual»: the owner inserts `{owner_id, title:"", description:"", province:"Limón", whatsapp_phone}` without the two flags. Reading it back gives `accepts_nightly: true, accepts_monthly: false`.
  2. «accepts_nightly = false lo rechaza la tabla»:
     - an owner insert with `accepts_nightly: false` fails with `error.message` containing `listings_accepts_nightly`;
     - `sql("update listings set accepts_nightly = false where id = '<draft id>'")` throws (same constraint name).
  3. «accepts_monthly no admite null»: an update to `accepts_monthly: null` on an own draft fails (not-null violation, `error.code === "23502"`).
  4. «submit_listing exige el precio por noche»: `h.seed({ status: "draft", photos: 5, draft: { nightlyPriceCrc: null } })`, then `h.owner("owner").submit(id)` rejects with `Indique el precio por noche en colones.`
  5. «submit_listing acepta mensual sin precio»: `h.seed({ status: "draft", photos: 5, draft: { acceptsMonthly: true, monthlyPriceCrc: null } })`, then submit resolves. `getOwn` gives `{ status: "review", acceptsMonthly: true, monthlyPriceCrc: null }`.
  6. «precio al mes 0 no llega a la tabla»: `sql("update listings set monthly_price_crc = 0 where id = '<draft>'")` throws (existing check `monthly_price_crc > 0`).

  In `telemetria.test.ts`, add «acepta monthly_filter_tap sin casa». Copy the `search_help_tap` case at l.48: insert `{ name: "monthly_filter_tap", page: "explorar", path: "/explorar", build: BUILD, country: "CR" }` with the service client, and expect `{ name: "monthly_filter_tap", listing_public_id: null }`.
- [ ] **Run:** `pnpm test:db tests/db/mensual-como-caracteristica.test.ts tests/db/telemetria.test.ts`. Expected FAIL:
  - case 1 gives `accepts_monthly: null`;
  - case 2 has no constraint;
  - case 4 passes the old rule and fails differently: it still rejects, but case 5 rejects with `Indique el precio por mes en colones.`;
  - `monthly_filter_tap` breaks `events_name_check`.
- [ ] **Implement:**
  - From the repo root: `pnpm exec supabase migration new mensual_como_caracteristica < /dev/null`.
  - Body, in this order: header comment (date 2026-10-27, why, and that `bnbtico-pruebas` is wiped before the push); `select set_config('app.allow_status', 'on', true);`; `update public.listings set accepts_monthly = false where accepts_monthly is null;`; `update public.listings set accepts_nightly = true where not accepts_nightly;`; `alter table public.listings alter column accepts_monthly set default false, alter column accepts_monthly set not null;`; `alter table public.listings add constraint listings_accepts_nightly check (accepts_nightly);`; `create or replace function public.submit_listing` (newest copy with the three changes above); drop and re-add `events_name_check`.
  - Fix the fixtures that insert `accepts_nightly: false` (`postgrest-harness.ts` l.49, `listings-alta-segura.test.ts` l.12, `cliente-directo-fotos.test.ts` l.162/180/186): use `accepts_nightly: true` or drop the key.
  - In `data/postgrest/owner.ts` `createDraft`, insert `accepts_nightly: true, accepts_monthly: false`, and update the comment: «Nada preseleccionado salvo lo que no se pregunta: toda casa se alquila por noches y el mensual empieza en No».
  - Run `pnpm db:reset` (root), then `pnpm db:types` (apps/app).
- [ ] **Run:** `pnpm test:db`. Expected PASS for the new file and `telemetria`. Contract-on-PostgREST failures caused by `acceptsNightly: false` fixtures are fixed in Task 2. If any remain, note them; they must be fixed in Task 2 before that commit. `pnpm typecheck` must pass: `rows.ts` still compiles because `?? null` on a boolean is allowed.
- [ ] **Verify the migration with data.** Locally, against the running db container: open `docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres` and run `begin;`. Insert an active listing with `accepts_monthly null` as `postgres` (with `set local app.allow_status='on'`), rerun the two `update`s of the migration, then `rollback;`. It must not raise `Este anuncio no se puede editar…`.
- [ ] **Commit:** `supabase/migrations/<ts>_mensual_como_caracteristica.sql apps/app/src/domain/database.types.ts apps/app/src/data/postgrest/owner.ts apps/app/tests/db/` — message «Hace de «Alquiler mensual» una característica en la base: toda casa por noches, mensual con precio opcional y evento monthly_filter_tap».

---

## Task 2: Domain model, price step parsing and publish contract

**Files:**
- Modify:
  - `apps/app/src/domain/listing.ts`
  - `apps/app/src/domain/step-forms.ts`
  - `apps/app/src/domain/rows.ts`
  - `apps/app/src/data/fake/owner.ts`
  - `apps/app/src/data/fake/db.ts` (only if `insertListing` needs it)
  - `apps/app/tests/unit/listing.test.ts`
  - `apps/app/tests/unit/errors-rows.test.ts`
  - `apps/app/tests/contract/harness.ts`
  - `apps/app/tests/contract/publish.contract.ts`
  - `apps/app/tests/contract/calendar.contract.ts`
  - `apps/app/tests/contract/public-reads.contract.ts` (fixture `mensual` only)
  - `apps/app/tests/unit/describe-can.test.ts` (fixtures only, so it compiles)

**Interfaces:**
```ts
// listing.ts
export const MONTHLY_LABEL = "Alquiler mensual";
export const NIGHTLY_PRICE_ERROR = "Indique el precio por noche en colones.";
export const MONTHLY_PRICE_ERROR = "Indique el precio al mes en colones o déjelo vacío.";
interface ListingDraft { acceptsNightly: boolean /* always true */; acceptsMonthly: boolean; /* rest unchanged */ }
emptyDraft(): acceptsNightly: true, acceptsMonthly: false
normalize(d): acceptsNightly = true; if (!acceptsMonthly) monthlyPriceCrc = null; monthlyMode/minMonths untouched
validateStep(1): only the kind
validateStep(priceStep): !isInt(nightly,1) → NIGHTLY_PRICE_ERROR;
  acceptsMonthly && monthlyPriceCrc !== null && !isInt(monthlyPriceCrc,1) → MONTHLY_PRICE_ERROR
// step-forms.ts
1: z.object({ kind: text }) → { kind }
priceStep: z.object({ nightlyPriceCrc: colones, acceptsMonthly: choice({ yes: true, no: false }), monthlyPriceCrc: colones })
  → { nightlyPriceCrc, acceptsMonthly: v.acceptsMonthly === true, monthlyPriceCrc: v.acceptsMonthly === true ? v.monthlyPriceCrc : null }
// rows.ts
fromListingRow: acceptsMonthly: row.accepts_monthly === true
toListingUpdate: row.accepts_monthly = d.acceptsMonthly === true
```

Steps:

- [ ] **Failing tests** in `tests/unit/listing.test.ts` (rewrite the cases at l.91, 171–191, 198–199, 221–222, 247–263):
  - `emptyDraft()` → `{ acceptsNightly: true, acceptsMonthly: false }`.
  - Step 1 with `kind: "completo"` and both flags false → `null`. The message `Marque Vacacional, Mensual o las dos.` no longer exists: `grep` gives 0 hits in `src` at the end of the task.
  - Price step, valid draft: `nightlyPriceCrc: null` → `NIGHTLY_PRICE_ERROR` (always, also with `acceptsMonthly: true, monthlyPriceCrc: 480000`).
  - Price step: `acceptsMonthly: true, monthlyPriceCrc: null` → `null` (Sí without a price is valid).
  - Price step: `acceptsMonthly: true, monthlyPriceCrc: 0` → `MONTHLY_PRICE_ERROR`; the same with `Number.NaN` and with `-5`.
  - Price step: `acceptsMonthly: false, monthlyPriceCrc: 0` → `null` (ignored).
  - Price step: `{ nightlyPriceCrc: 85000, acceptsMonthly: true, monthlyPriceCrc: 480000 }` → `null`.
  - `parseStep(priceStep, fd([["nightlyPriceCrc","85.000"]]))` → `{ nightlyPriceCrc: 85000, acceptsMonthly: false, monthlyPriceCrc: null }` (No by default).
  - `parseStep(priceStep, fd([["nightlyPriceCrc","85000"],["acceptsMonthly","yes"],["monthlyPriceCrc",""]]))` → `{ nightlyPriceCrc: 85000, acceptsMonthly: true, monthlyPriceCrc: null }`.
  - `parseStep(priceStep, fd([["nightlyPriceCrc","85000"],["acceptsMonthly","no"],["monthlyPriceCrc","480000"]]))` → `monthlyPriceCrc: null` (Review Focus 1).
  - `parseStep(1, fd([["kind","completo"],["modes","nightly"]]))` → `{ kind: "completo" }` (the old `modes` field is ignored).
  - `normalize({ ...validDraft(), acceptsMonthly: false, monthlyPriceCrc: 150000 }).monthlyPriceCrc` → `null`.
  - `normalize({ ...validDraft(), acceptsNightly: false }).acceptsNightly` → `true`.
  - `normalize({ ...validDraft(), acceptsMonthly: true, monthlyPriceCrc: 480000 }).monthlyMode` → unchanged (`null` in `validDraft`).
  - `planStep(monthlyDraft, priceStep, { nightlyPriceCrc: 85000, acceptsMonthly: false, monthlyPriceCrc: null })` → `changes` equal to `{ acceptsMonthly: false, monthlyPriceCrc: null }`, where `monthlyDraft = { ...validDraft(), acceptsMonthly: true, monthlyPriceCrc: 480000, nightlyPriceCrc: 85000 }`.

  In `errors-rows.test.ts`: `fromListingRow(listingRow({ accepts_monthly: null }))` → `acceptsMonthly: false` (defensive); `toListingUpdate({ acceptsMonthly: true })` → `{ accepts_monthly: true }`.

  Contract (`tests/contract/publish.contract.ts`):
  - `WALK` step 1: invalid only `[{ kind: null }, "Elija Alojamiento completo o Habitación."]`; valid `{ kind: "habitacion" }`.
  - `WALK` price step: invalid `[{ nightlyPriceCrc: null, acceptsMonthly: true, monthlyPriceCrc: 480000 }, NIGHTLY_PRICE_ERROR]` and `[{ nightlyPriceCrc: 42000, acceptsMonthly: true, monthlyPriceCrc: 0 }, MONTHLY_PRICE_ERROR]`; valid `{ nightlyPriceCrc: 42000, acceptsMonthly: true, monthlyPriceCrc: 480000 }`.
  - The final `toMatchObject` drops `monthlyMode: "amount"` and keeps `acceptsNightly: true, acceptsMonthly: true`.
  - The new-draft test expects `acceptsNightly: true` and `acceptsMonthly: false` (replaces `.not.toBe(true)`).
  - Replace the test «guarda todo lo que normalize limpia…» (l.68–74) with «Sí sin precio se guarda; Sí con precio y luego No no guarda el precio»:
    - `saveStep(id, 8, { nightlyPriceCrc: 42000, acceptsMonthly: true, monthlyPriceCrc: null })` → `getOwn` `{ acceptsMonthly: true, monthlyPriceCrc: null }`;
    - then `{ …, acceptsMonthly: true, monthlyPriceCrc: 480000 }` → `480000`;
    - then `{ nightlyPriceCrc: 42000, acceptsMonthly: false, monthlyPriceCrc: 480000 }` → `{ acceptsMonthly: false, monthlyPriceCrc: null }`;
    - then step 1 `{ kind: "completo" }` → `bathroomShared: null`. Keep the parking case.
  - New `describe("enviar: noche obligatoria y mensual opcional")` with its own `beforeAll` reset. It needs its own reset because «enviar a revisión» is already at the 5-open-drafts cap.
    - `noNightly = seed({ status:"draft", photos:5, draft:{ nightlyPriceCrc: null } })` → `submit` rejects with `NIGHTLY_PRICE_ERROR`;
    - `negotiable = seed({ status:"draft", photos:5, draft:{ acceptsMonthly: true, monthlyPriceCrc: null } })` → `submit` resolves, status `review`.

  Fixtures:
  - `calendar.contract.ts` l.26: rename `MONTHLY_ONLY` to `NO_NIGHTLY_PRICE = { nightlyPriceCrc: null }`. The test at l.116 becomes «un borrador sin precio por noche todavía no lleva precio en el calendario, pero sí noches ocupadas», with the same assertions.
  - `public-reads.contract.ts` l.101–104: `mensual` becomes `{ acceptsMonthly: true, monthlyPriceCrc: null, nightlyPriceCrc: 38000, capacity: 4, bedrooms: 2, features: ["wifi","pets"] }`. The «precio por noche» expectations change: `max: "60000"` → `[nicoya, mensual, cahuita]`; rename the test to «precio por noche: mínimo y máximo». The «modalidad» test is rewritten in Task 5: mark it `it.skip` here with a `// Task 5` comment so this commit stays green.
  - `describe-can.test.ts`: change fixtures with `acceptsNightly: false` / `acceptsMonthly: null` only as far as needed to compile. The real rewrite is Task 3.
- [ ] **Run:** `pnpm test tests/unit/listing.test.ts tests/unit/errors-rows.test.ts tests/unit/contract-publish-fake.test.ts tests/unit/contract-calendar-fake.test.ts` and `pnpm test:db tests/db/contract-publish-postgrest.test.ts`. Expected FAIL on the cases above.
- [ ] **Implement** the interfaces above.
  - Update the comment at the top of `listing.ts`: «toda casa se alquila por noches; «Alquiler mensual» opcional con precio al mes opcional».
  - `data/fake/owner.ts`:
    - `createDraft` → `db.insertListing(owner)` (drop `{ acceptsMonthly: null }`);
    - `submitRefusal` drops the modes line and uses `(l.nightlyPriceCrc ?? 0) <= 0 → NIGHTLY_PRICE_ERROR` and `l.acceptsMonthly && l.monthlyPriceCrc !== null && l.monthlyPriceCrc <= 0 → MONTHLY_PRICE_ERROR`, in the same position as the SQL.
  - `fields.tsx` keeps compiling: in step 1, `draft.acceptsMonthly` is still a boolean. The UI is rewritten in Task 4.
- [ ] **Run:** `pnpm typecheck && pnpm test && pnpm test:db`. Expected PASS (the «modalidad» contract test is skipped).
- [ ] **Commit:** `apps/app/src/domain/{listing,step-forms,rows}.ts apps/app/src/data/fake/owner.ts apps/app/tests/unit/{listing,errors-rows,describe-can}.test.ts apps/app/tests/contract/` — message «Exige siempre el precio por noche y deja el precio al mes opcional en el dominio, el fake y el contrato».

---

## Task 3: `describe()` prices, ficha, preview, owner detail and admin

**Files:**
- Create `apps/app/src/shared/monthly-line.tsx`.
- Modify:
  - `apps/app/src/domain/describe.ts`
  - `apps/app/src/domain/preview.ts`
  - `apps/app/src/shared/listing-page.tsx`
  - `apps/app/src/client/screens/propietario.tsx` (`Detail`, or its new home from Task 0)
  - `apps/app/src/client/screens/admin.tsx` (`ReviewDetail`, l.335–377)
  - `apps/app/tests/unit/describe-can.test.ts`
  - `apps/app/tests/unit/preview.test.ts`
  - `apps/app/tests/e2e/ficha.spec.ts`

**Interfaces:**
```ts
// describe.ts
export type MonthlyPrice = { amount: number; unit: "mes" } | { negotiable: true };
export const isNegotiable = (m: MonthlyPrice): m is { negotiable: true } => "negotiable" in m;
export interface ListingDescription {
  /** Precio por noche: toda casa lo tiene al publicarse; null solo en un borrador sin precio todavía. */
  mainPrice: Price | null;
  /** null si no acepta alquiler mensual; negociable si lo acepta sin precio (o con uno no positivo). */
  monthly: MonthlyPrice | null;
  statusLabel: string; situation: string | null; shareUrl: string; previewText: string;
}   // `secondaryPrice` is removed
export type CardPrice = Price | { negotiable: true } | null;
export function cardPrice(d: Pick<ListingDescription, "mainPrice" | "monthly">, monthlyFilter: boolean): CardPrice;
export const NEGOTIABLE_CARD = "Precio a negociar";
export const NEGOTIABLE_LINE = "Mensual: precio a negociar con el dueño";
export function monthlyLineText(m: MonthlyPrice, format: (crc: number) => string): string; // "Mensual: ₡350 000 / mes" | NEGOTIABLE_LINE
// prices(): main = l.nightlyPriceCrc && l.nightlyPriceCrc > 0 ? { amount, unit: "noche" } : null  (acceptsNightly not read)
//           monthly = !l.acceptsMonthly ? null : l.monthlyPriceCrc && l.monthlyPriceCrc > 0 ? { amount, unit: "mes" } : { negotiable: true }
// shared/monthly-line.tsx
export function MonthlyLine({ monthly, format }: { monthly: MonthlyPrice; format: (crc: number) => string }): JSX.Element
// <span className="xs muted" data-testid="monthly-line">…</span>; the amount goes in <b className="ink num">
```

Steps:

- [ ] **Failing tests** in `tests/unit/describe-can.test.ts`. Replace the `describe · precios` table (l.68–80) with `[name, over, main, monthly]`:
  - «solo por noche»: `{ nightlyPriceCrc: 85000, acceptsMonthly: false, monthlyPriceCrc: null }` → `{ amount: 85000, unit: "noche" }`, `null`.
  - «mensual con precio»: `{ nightlyPriceCrc: 85000, acceptsMonthly: true, monthlyPriceCrc: 350000 }` → nightly, `{ amount: 350000, unit: "mes" }`.
  - «mensual a negociar»: `{ nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null }` → `{ amount: 45000, unit: "noche" }`, `{ negotiable: true }`.
  - «mensual con 0 guardado es a negociar»: `monthlyPriceCrc: 0` → `{ negotiable: true }` (Review Focus 4).
  - «precio al mes sin aceptar mensual no cuenta»: `acceptsMonthly: false, monthlyPriceCrc: 480000` → monthly `null`.
  - «borrador sin precio»: `nightlyPriceCrc: null, acceptsMonthly: false` → `null`, `null`.

  Each row is checked for `describe(owned(...))` and `describe(publicOf(...))`.

  `cardPrice`:
  - filter off → the nightly `Price`;
  - filter on with an amount → `{ amount: 350000, unit: "mes" }`;
  - filter on and negotiable → `{ negotiable: true }`.

  `monthlyLineText({ amount: 350000, unit: "mes" }, formatCRC)` → `"Mensual: ₡350 000 / mes"` (use the separator `formatCRC` really emits; see the existing `₡480 000` case); `monthlyLineText({ negotiable: true }, formatCRC)` → `"Mensual: precio a negociar con el dueño"`.

  Rewrite the previewText case «mensual» (l.115) as `{ nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null }` → `"Alojamiento completo en Manzanillo, Limón · 5 personas · ₡45 000 por noche · orientativo"`.

  `preview.test.ts`: `previewListing` of a draft with `acceptsNightly: false` gives `acceptsNightly: true`. A draft with `acceptsMonthly: true, monthlyPriceCrc: null` keeps `acceptsMonthly: true, monthlyPriceCrc: null`.

  E2E `ficha.spec.ts`: in `beforeAll`, add `negociable = seed({ status:"active", photos:5, draft:{ title:"Casa Cocles mensual", zone:"Cocles", nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null, features:["wifi"] } })`. Remove `monthlyMode: "amount"` from `cara`. New test «una casa con mensual a negociar llega del servidor con la línea y la característica, e hidrata sin avisos»:
  - `watch(page)`, then `page.goto('/casa/'+negociable.publicId)`; the raw `source` contains `Alquiler mensual` and `Mensual: precio a negociar con el dueño`;
  - `data-hydrated="true"`;
  - `getByTestId("monthly-line")` has text `Mensual: precio a negociar con el dueño`;
  - `.feature-tiles` contains `Alquiler mensual` as the last tile;
  - no `.badge` with text `Vacacional` or `Mensual`;
  - `seen.problems` is `[]`.

  Extend the existing 320 px bar test, or add a sibling: at `{ width: 320, height: 640 }`, the CTA bar `offsetHeight` of `negociable` in CRC equals the one in USD, and the bar does not cover the last paragraph (same assertion as the existing 320 px test). The test `cara` keeps `getByTestId("monthly-line")` = `Mensual: ₡2 500 000 / mes`, using the same separator as `main-price`.
- [ ] **Run:** `pnpm test tests/unit/describe-can.test.ts tests/unit/preview.test.ts`. Expected FAIL (no `monthly` / `cardPrice`). `pnpm build` and then the e2e spec `tests/e2e/ficha.spec.ts`. Expected FAIL (no line, `Vacacional` badge present).
- [ ] **Implement:**
  - `describe.ts` as specified. `preview.ts`: `acceptsNightly: true`.
  - `listing-page.tsx`:
    - remove the import and the badge `modesLabel(l)` (l.247);
    - render the badge row only when there is a habitación or no-disponible badge;
    - add the feature grid condition `l.features.length || l.acceptsMonthly`; after the nine features, when `d.monthly`, add a tile `<div><I.calendar size={22} />{MONTHLY_LABEL}</div>`;
    - replace the `secondaryPrice` block (l.318–322) with `{d.monthly ? <MonthlyLine monthly={d.monthly} format={(crc) => formatMoney(crc, currency, fx.crcPerUsd)} /> : null}`. The amount follows the currency, as `main-price` already does. The server renders colones, as now.
  - Owner `Detail`: after the photo, `{d.monthly ? <MonthlyLine monthly={d.monthly} format={formatCRC} /> : null}`.
  - `admin.tsx` `ReviewDetail`:
    - `facts[0]` becomes `l.acceptsMonthly ? MONTHLY_LABEL : null`;
    - after the nightly price, `d.monthly ? <span className="muted"> · {isNegotiable(d.monthly) ? "mensual a negociar" : `mensual ${formatCRC(d.monthly.amount)}`}</span> : null`.
  - `listing-card.tsx` keeps using `describe(...).mainPrice` until Task 6, with no type break.
- [ ] **Run:** `pnpm typecheck && pnpm test`, then `pnpm build` and `CHROMIUM_PATH=… pnpm test:e2e --workers=1 tests/e2e/ficha.spec.ts tests/e2e/admin.spec.ts`. Expected PASS.
- [ ] **Commit:** `apps/app/src/domain/{describe,preview}.ts apps/app/src/shared/{listing-page,monthly-line}.tsx apps/app/src/client/screens/{propietario,admin}.tsx apps/app/tests/unit/{describe-can,preview}.test.ts apps/app/tests/e2e/ficha.spec.ts` — message «Muestra «Alquiler mensual» en la ficha con su precio al mes o «precio a negociar con el dueño»».

---

## Task 4: Publish wizard (step 1, price step, summary)

**Files:**
- Modify:
  - `apps/app/src/client/publish/fields.tsx`
  - `apps/app/src/domain/listing.ts` (remove `modesLabel`)
  - the screen with the ready-list (`propietario.tsx` l.156 or its new home from Task 0)
  - `apps/app/tests/e2e/publicar.spec.ts`

**Interfaces:**
```tsx
/** Paso del precio: «¿Acepta alquiler por meses?» No (por defecto) / Sí; con Sí, «Precio al mes (opcional)». Volver a No vacía el campo. */
function MonthlyQuestion({ accepts, price }: { accepts: boolean; price: number | null }): JSX.Element
// radios name="acceptsMonthly" values "no" | "yes", chip style like BathroomChoice; controlled state `yes` and `text`;
// onNo → setText(""); field id="pub-monthlyPriceCrc" name="monthlyPriceCrc", shown only while yes.
```

Steps:

- [ ] **Failing e2e** in `publicar.spec.ts`:
  - The ready-list (l.56) becomes `["5 fotos horizontales o más", "El precio por noche", "Unos 10 minutos"]`, if the ready-list still exists after navegacion-simple. Otherwise assert the copy wherever it moved.
  - Step 1 (l.66–76): no `«¿Cómo alquila?»` heading (`getByRole("heading", { name: "¿Cómo alquila?" })` count 0). After `Alojamiento completo`, `continuar` goes straight to `/2`. `label.choice[aria-pressed="true"]` count is 1.
  - Price step (l.~195–205):
    - `getByRole("group", { name: "¿Acepta alquiler por meses?" })` has the `No` radio checked and `getByLabel("Precio al mes (opcional)")` count 0;
    - `getByLabel("Precio por noche")` has `enterkeyhint` `done` while No;
    - `continuar` with the nightly price empty → alert `Indique el precio por noche en colones.`;
    - fill `85.000`, click `Sí`: `Precio al mes (opcional)` is visible with help `Si lo deja vacío, en su ficha dirá «Precio a negociar con el dueño».`, the nightly field has `enterkeyhint` `next` and the monthly one `done`;
    - fill `0`, continue → alert `Indique el precio al mes en colones o déjelo vacío.`;
    - fill `480.000`, click `No`, then `Sí`: the monthly field has value `""` (Review Focus 1); click `No`;
    - `expectNoScroll(page, "paso del precio")` with Sí shown, then with No.
  - Continue. In step 9, the «Precio» row shows `₡85 000 / noche`. The final `getOwn` (l.123) expects `{ nightlyPriceCrc: 85000, acceptsMonthly: false, monthlyPriceCrc: null }`.
  - New test «publicar con mensual sin precio: tras aprobarla, la ficha dice «precio a negociar con el dueño» y lleva «Alquiler mensual»» (spec Playwright 1):
    - seed a complete draft (`h.seed({ status: "draft", photos: 5 })`);
    - open `/propietario/publicar/<id>/<priceStep>`; fill `Precio por noche` `45000`; click `Sí`; leave the monthly field empty; continue;
    - in step 9 the «Precio» row reads `₡45 000 / noche · mensual a negociar`;
    - «Enviar a revisión»;
    - `await h.admin("aal2").review(id, "approve", "")`;
    - `page.goto('/casa/'+publicId)`: `getByTestId("monthly-line")` = `Mensual: precio a negociar con el dueño` and `.feature-tiles` contains `Alquiler mensual`.
- [ ] **Run:** `pnpm build && CHROMIUM_PATH=… pnpm test:e2e --workers=1 tests/e2e/publicar.spec.ts`. Expected FAIL (the old step 1 and price step).
- [ ] **Implement** `fields.tsx`:
  - Step 1: delete the «¿Cómo alquila?» section (l.302–314).
  - Price step: `<h2>Precio</h2>`, then the nightly field labelled `Precio por noche` (`id="pub-nightlyPriceCrc"`, `name="nightlyPriceCrc"`, placeholder `95 000`), then `<MonthlyQuestion accepts={draft.acceptsMonthly} price={draft.monthlyPriceCrc} />` with:
    - group `role="group"` and `aria-labelledby` pointing at the question text `¿Acepta alquiler por meses?`;
    - the monthly field, placeholder `350 000`, with `aria-describedby` on the help text.

    Keep the trailing note «En colones; el cliente puede verlo en dólares. El precio final lo acuerda por WhatsApp.»
  - `SendSummary`:
    - the step 1 row value is only `KIND_LABELS[d.kind]`;
    - `prices` = `[d.nightlyPriceCrc ? \`${formatCRC(d.nightlyPriceCrc)} / noche\` : null, d.acceptsMonthly ? (d.monthlyPriceCrc ? \`${formatCRC(d.monthlyPriceCrc)} / mes\` : "mensual a negociar") : null]`.
  - Remove `modesLabel` from `listing.ts`, `fields.tsx` and `admin.tsx` (Task 3 already removed it from `listing-page.tsx`). `grep -rn modesLabel apps/app/src` must return 0 hits.
  - Ready-list copy: `El precio por noche`.
- [ ] **Run:** `pnpm typecheck && pnpm test`, then `pnpm build` and the e2e `tests/e2e/publicar.spec.ts tests/e2e/telemetria.spec.ts`. Expected PASS.
- [ ] **Commit:** `apps/app/src/client/publish/fields.tsx apps/app/src/domain/listing.ts apps/app/src/client/screens/ apps/app/tests/e2e/publicar.spec.ts` — message «Pregunta «¿Acepta alquiler por meses?» en la pantalla del precio, con el precio al mes opcional, y quita «¿Cómo alquila?»».

---

## Task 5: Monthly filter: domain, query and contract

**Files:**
- Modify:
  - `apps/app/src/domain/filters.ts`
  - `apps/app/src/domain/search-help.ts`
  - `apps/app/src/data/postgrest/listings.ts`
  - `apps/app/src/data/fake/listings.ts`
  - `apps/app/src/client/queries.ts`
  - `apps/app/src/client/screens/explorar.tsx` (chip row only)
  - `apps/app/src/client/screens/filtros.tsx` (remove the «Modalidad» section and add the toggle)
  - `apps/app/tests/unit/filters.test.ts`
  - `apps/app/tests/unit/search-help.test.ts`
  - `apps/app/tests/unit/search-help-note.test.tsx`
  - `apps/app/tests/contract/public-reads.contract.ts`

**Interfaces:**
```ts
// filters.ts — removed: Mode, MODES, MODE_CHIPS, ModeParam, modeFilter, toggleMode, modesFrom, modeParam
export interface Filters { prov: string; monthly: boolean; ppl: number; beds: number; features: Feature[]; min: number; max: number; open: boolean }
// searchSchema: mensual: flag; modo: z.pipe(first, z.transform((v) => v === "monthly"))   // legacy links only
// parseFilters: monthly = p.mensual || p.modo
export type SearchKey = "prov" | "mensual" | "ppl" | "beds" | "min" | "max" | "mas" | Feature;
// toSearchParams: after prov, `if (f.monthly) p.set("mensual", "1")`; min/max are written even while monthly (they stay in the URL)
// normalizeSearch: `if (p.mensual || p.modo) out.mensual = "1"`; never outputs `modo`
/** Lo que pregunta la consulta: con el mensual, sin rango de precio (el rango es por noche). */
export function effectiveFilters(f: Filters): Filters;          // monthly ? { ...f, min: 0, max: 0 } : f
export function extrasCount(f: Filters): number;                // min/max not counted while monthly; monthly itself is not counted (it is on the chip row)
/** Línea de resultados: { count: "2 casas", rest: " aceptan alquiler mensual en Limón" }. */
export function resultsText(n: number, f: Pick<Filters, "prov" | "monthly">): { count: string; rest: string };
```

Steps:

- [ ] **Failing tests** in `tests/unit/filters.test.ts`. Replace the cases at l.75–76 and 125–143:
  - `parseFilters({}, []).monthly` → `false`; `parseFilters({ mensual: "1" }, []).monthly` → `true`; `parseFilters({ mensual: "0" }, []).monthly` → `false`.
  - Old links: `parseFilters({ modo: "monthly" }, []).monthly` → `true`; `{ modo: "nightly" }` and `{ modo: "both" }` → `false`; `{ modo: "otra" }` → `false`.
  - `normalizeSearch({ modo: "monthly", mas: "1", beds: 9 })` → `{ mensual: "1", mas: "1" }`; `normalizeSearch({ modo: "both" })` → `{}`; `normalizeSearch({ mensual: "1", modo: "nightly" })` → `{ mensual: "1" }`; the l.75 case with `modo: "otra"` stays `{ prov: "Guanacaste", ppl: "4", pool: "1", min: "50000" }`.
  - `toSearchParams({ ...parseFilters({}, []), monthly: true, min: 40000, max: 90000 }, { prov: "Todas" }).toString()` → `"mensual=1&min=40000&max=90000"`; no `modo` key ever.
  - `effectiveFilters({ ...base, monthly: true, min: 40000, max: 90000 })` → `min: 0, max: 0, monthly: true`; with `monthly: false` the same object values (`toEqual` input).
  - `extrasCount({ ...base, monthly: true, min: 40000, max: 90000, ppl: 4 })` → `1`; with `monthly: false` → `3`.
  - `resultsText(2, { prov: "Limón", monthly: true })` → `{ count: "2 casas", rest: " aceptan alquiler mensual en Limón" }`; `resultsText(1, { prov: "Todas", monthly: true })` → `{ count: "1 casa", rest: " acepta alquiler mensual" }`; `resultsText(8, { prov: "Limón", monthly: false })` → `{ count: "8 casas", rest: " en Limón" }`; `resultsText(9, { prov: "Todas", monthly: false })` → `{ count: "9 casas", rest: "" }`.
  - Round trip: `searchFor(parseFilters({ mensual: "1", prov: "Limón" }, ["Limón"]), ["Limón"])` → `{ mensual: "1" }`.

  `search-help.test.ts`:
  - `none` uses `monthly: false`;
  - `lines({ monthly: true })` contains `Busca alquiler mensual.`;
  - `searchHelpMessage(none)` contains neither `Modalidad` nor `mensual`;
  - `lines({ monthly: true, max: 80000 })` has no `Precio por noche` line;
  - the l.42 full-message case uses `monthly: false` and keeps its exact text minus the `Modalidad: Vacacional.` line;
  - the l.56 «no personal data» cases use `monthly: true` instead of `modes`.

  `search-help-note.test.tsx` l.8: `monthly: false`.

  Contract (`public-reads.contract.ts`): un-skip and rewrite «modalidad» (Task 2) as «alquiler mensual»:
  - `ids(filters({ mensual: "1" }))` → `[grande.publicId, mensual.publicId]`;
  - `ids(filters({ modo: "monthly" }))` → the same;
  - `ids(filters({ modo: "both" }))` and `ids(filters({ modo: "nightly" }))` → `ids(filters())`;
  - `ids(filters({ mensual: "1", min: "50000", max: "100000" }))` → `[grande.publicId, mensual.publicId]`: price ignored (Review Focus 3); `mensual` costs 38 000 a night and `grande` 150 000;
  - `(await h.anon.getPublic(mensual.publicId))` matches `{ acceptsNightly: true, acceptsMonthly: true, monthlyPriceCrc: null }`.

  (Check what `filters(...)` does in this file: it is `parseFilters({ prov: "Todas", ...x }, …)`.)
- [ ] **Run:** `pnpm test tests/unit/filters.test.ts tests/unit/search-help.test.ts tests/unit/search-help-note.test.tsx tests/unit/contract-fake.test.ts` and `pnpm test:db tests/db/contract-postgrest.test.ts`. Expected FAIL (no `monthly`; `modes` everywhere).
- [ ] **Implement:**
  - `filters.ts` as specified. Update the header comment: «Zona → Alquiler mensual → Para quiénes → Qué necesitan → Precio».
  - `search-help.ts`: `const q = effectiveFilters(f)`; line `q.monthly ? "Busca alquiler mensual." : null` in the old `Modalidad` position; the price line uses `q.max`.
  - Adapters:
    - `const q = effectiveFilters(f)`;
    - replace the `modeFilter` block with `if (q.monthly) query = query.eq("accepts_monthly", true)` (PostgREST) and `.filter((l) => !q.monthly || l.acceptsMonthly === true)` (fake);
    - the price filters read `q.min` / `q.max`.
  - `queries.ts`: `const { open: _open, ...key } = effectiveFilters(f)`, so a hidden range shares the cache.
  - Screens, minimal, so they compile and behave:
    - **Explorar chip row:** `<button type="button" className="chip" aria-pressed={f.monthly} onClick={() => go({ ...f, monthly: !f.monthly })}>{MONTHLY_LABEL}</button>` then «Más filtros»;
    - **Explorar `onClear`:** `f.monthly || extras`;
    - **Filtros:** delete the «Modalidad» section (l.66–78); in «Qué necesitan», after the nine `FEATURES` chips, add `<button … aria-pressed={f.monthly} onClick={() => set("mensual", f.monthly ? undefined : "1")}>{MONTHLY_LABEL}</button>`. The price section is hidden in Task 6.
- [ ] **Run:** `pnpm typecheck && pnpm test && pnpm test:db`. Expected PASS. `grep -rn "modeFilter\|MODE_CHIPS\|toggleMode\|modeParam\|\.modes\b" apps/app/src apps/app/tests` → 0 hits.
- [ ] **Commit:** `apps/app/src/domain/{filters,search-help}.ts apps/app/src/data/{postgrest,fake}/listings.ts apps/app/src/client/queries.ts apps/app/src/client/screens/{explorar,filtros}.tsx apps/app/tests/unit/ apps/app/tests/contract/public-reads.contract.ts` — message «Filtra por «Alquiler mensual» con ?mensual=1, mantiene los enlaces viejos de modo y no aplica el precio por noche con el filtro».

---

## Task 6: Explorar and Filtros screens, card prices and `monthly_filter_tap`

**Files:**
- Modify:
  - `apps/app/src/client/screens/explorar.tsx`
  - `apps/app/src/client/screens/filtros.tsx`
  - `apps/app/src/client/listing-card.tsx`
  - `apps/app/src/domain/telemetry.ts`
  - `apps/app/src/shared/beacon.ts`
  - `apps/app/tests/unit/telemetry.test.ts`
  - `apps/app/tests/unit/worker.test.ts`
  - `apps/app/tests/e2e/explorar.spec.ts`
  - `apps/app/tests/e2e/no-encuentra.spec.ts`

**Interfaces:**
```ts
// telemetry.ts events enum and beacon.ts EventName gain "monthly_filter_tap"; parseBeacon lets it through without `listing`
// (the condition at l.118 becomes a set NO_LISTING = new Set(["page_view", "search_help_tap", "monthly_filter_tap"]))
export function ListingCard({ listing, monthly = false }: { listing: PublicListing; monthly?: boolean }): JSX.Element
// price pill: p = cardPrice(describe(l, { base: "" }), monthly);
//   Price → `${formatMoney(p.amount, currency, fx)} <span>/ ${p.unit}</span>`; negotiable → NEGOTIABLE_CARD; null → no pill.
// The «Mensual» pill (pills-tl) is removed; «No disponible» stays.
```

Steps:

- [ ] **Failing tests:**
  - `telemetry.test.ts`, next to `search_help_tap` (l.69): `parseBeacon("events", JSON.stringify({ ...base, name: "monthly_filter_tap", path: "/explorar?mensual=1" }))` → `{ ok: true, row: { name: "monthly_filter_tap", page: "explorar", path: "/explorar", build: "abc123" } }`.
  - `worker.test.ts`: copy the case at l.557 for `/events` with `monthly_filter_tap`.
  - `explorar.spec.ts`:
    - Seed fixture (l.19): `manzanillo` keeps `acceptsMonthly: true, monthlyPriceCrc: 480000, nightlyPriceCrc: 85000`. Add `cocora = seed({ status:"active", draft:{ title:"Casa Cocles mensual", zone:"Cocles", capacity:2, nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null } })`. Explorar in Limón now shows 9; update every count in the file: `8 casas en Limón` → `9 casas en Limón`, Todas `9` → `10`, and the price-range counts as they fall.
    - Replace the test «Vacacional y Mensual no se excluyen…» (l.99–139) with «Alquiler mensual: un chip, la línea y los precios por mes; al quitarlo vuelven «/ noche» y el rango» (spec Playwright 2). At 360×740:
      1. `.chiprow .chip` texts are `["Alquiler mensual", "Más filtros"]`, and the chip row has no horizontal scroll (same `scrollWidth ≤ clientWidth` check).
      2. Start at `/explorar?min=40000&max=90000` (Limón). Count the houses priced 40 000–90 000 a night and assert `results` with that number plus ` en Limón`. A card shows `/ noche`.
      3. Watch the `/events` beacons, as `telemetria.spec.ts` does with its local db query. Click «Alquiler mensual»:
         - the URL contains `mensual=1`, `min=40000` and `max=90000`;
         - `results` = `2 casas aceptan alquiler mensual en Limón` (manzanillo and cocora, whatever their nightly price);
         - the Manzanillo card pill = `₡480 000 / mes`;
         - the Cocles mensual card pill = `Precio a negociar`;
         - no card pill contains `/ noche`;
         - a `monthly_filter_tap` row appears in `public.events` with path `/explorar`.
      4. «Más filtros»:
         - `getByLabel("Precio mínimo por noche")` count 0;
         - in the «Qué necesitan» group the last chip is `Alquiler mensual` with `aria-pressed="true"`;
         - the badge on «Más filtros» does not count the hidden range;
         - turn the toggle off: the price inputs are back with values `40000` / `90000`;
         - «Ver N casas» applies.
      5. Back in Explorar: the URL has no `mensual`, the results line has no `aceptan`, and the card pills end in `/ noche`.
    - New test «un enlace viejo /explorar?modo=monthly llega con el chip encendido» (spec Playwright 3):
      - `goto("/explorar?modo=monthly")` → the chip has `aria-pressed="true"` and `results` = `2 casas aceptan alquiler mensual en Limón`;
      - `goto("/explorar?modo=both")` → the chip is `false` and `results` = `9 casas en Limón`.
  - `no-encuentra.spec.ts` l.47: change `modo=nightly` to `mensual=1`. The expected WhatsApp text contains `Busca alquiler mensual.`; adapt the asserted message lines.
- [ ] **Run:** `pnpm test tests/unit/telemetry.test.ts tests/unit/worker.test.ts`. Expected FAIL (unknown event → 400). `pnpm build`, then the e2e `tests/e2e/explorar.spec.ts tests/e2e/no-encuentra.spec.ts`. Expected FAIL.
- [ ] **Implement:**
  - `telemetry.ts` / `beacon.ts` as specified.
  - `explorar.tsx`:
    - the chip `onClick` is `{ track("monthly_filter_tap"); void go({ ...f, monthly: !f.monthly }); }`; it sends on every tap of the Explorar chip, not from Filtros;
    - the results span becomes `{listings ? (() => { const r = resultsText(listings.length, f); return <><b className="ink num">{r.count}</b>{r.rest}</>; })() : "Buscando casas…"}`. Keep `data-testid="results-count"` and leave any sibling (the currency switch fallback) alone;
    - `<ListingCard listing={l} monthly={f.monthly} />`.
  - `filtros.tsx`: render the «Precio orientativo por noche» section only when `!f.monthly`. The `prices` state and `draft.min` / `draft.max` stay untouched, so they come back. While `f.monthly`, `badRange` is false (`priceRangeInvalid` on the effective range), so a hidden bad range cannot block «Ver N casas».
  - `listing-card.tsx` as specified.
- [ ] **Run:** `pnpm typecheck && pnpm test`, `pnpm build && pnpm size` (private JS < 150 KB gz; note the delta), then the e2e `tests/e2e/explorar.spec.ts tests/e2e/no-encuentra.spec.ts tests/e2e/favoritos.spec.ts tests/e2e/telemetria.spec.ts`. Expected PASS.
- [ ] **Commit:** `apps/app/src/client/screens/{explorar,filtros}.tsx apps/app/src/client/listing-card.tsx apps/app/src/domain/telemetry.ts apps/app/src/shared/beacon.ts apps/app/tests/unit/{telemetry,worker}.test.ts apps/app/tests/e2e/{explorar,no-encuentra}.spec.ts` — message «Con «Alquiler mensual» Explorar cuenta las casas que lo aceptan, muestra el precio por mes u «Precio a negociar», oculta el rango y mide el toque».

---

## Task 7: Documentation (same day, 2026-10-27)

**Files:**
- Modify `docs/decisiones.md`, `CLAUDE.md`, `docs/diseno-v1.md`, `docs/telemetria.md`.
- Set `.scratch/mensual-como-caracteristica/spec.md` to `Status: ready-for-human` only if the triage flow asks for it; otherwise leave it.

- [ ] `docs/decisiones.md`: new top entry `## 2026-10-27 · «Alquiler mensual» como característica, con precio al mes opcional`, «Decisión de Daniel.», covering:
  - toda casa se alquila por noches (`accepts_nightly` siempre true, con `check`);
  - «¿Acepta alquiler por meses?» en la pantalla del precio, No por defecto, sin paso propio (el asistente sigue en 9 pasos);
  - precio al mes opcional: vacío = «Precio a negociar con el dueño»;
  - un solo chip «Alquiler mensual» (`?mensual=1`; `modo=monthly` se mantiene como enlace viejo) que oculta el rango de precio por noche sin borrarlo de la URL;
  - evento `monthly_filter_tap`;
  - the copy choices made here: summary «mensual a negociar», error «Indique el precio al mes en colones o déjelo vacío.», and results line with ` en <provincia>` at the end;
  - the test data of `bnbtico-pruebas` is wiped before the push (Task 9).
- [ ] `CLAUDE.md`, «Reglas de producto vigentes»:
  - replace the bullet «Modalidad y tipo (diseño v1)» with: «**Alquiler y tipo:** toda casa se alquila por noches, con precio por noche obligatorio; «Acepta alquiler mensual» es opcional, con precio al mes opcional (vacío = «Precio a negociar con el dueño»); es Alojamiento completo o Habitación (con baño privado o compartido).»
  - append to the Características bullet: «Los filtros añaden «Alquiler mensual» (no se marca en características al publicar: se pregunta en el precio).»
- [ ] `docs/diseno-v1.md`:
  - l.15: the «Mensual» pill is gone;
  - l.20 Explorar: chips «Alquiler mensual» · «Más filtros», the results line with the filter, card prices with their unit;
  - l.22 Ficha: no Vacacional badge, the «Alquiler mensual» tile, the CTA line;
  - l.33: step (1) only «¿Qué es?», and step (8) «Precio por noche» + «¿Acepta alquiler por meses?» + «Precio al mes (opcional)».
- [ ] `docs/telemetria.md`:
  - add `monthly_filter_tap` to the `/events` row: tap on the Explorar chip, on or off, without a house; path `/explorar`; migration `mensual_como_caracteristica`;
  - add a query: weekly taps over Explorar page views, as a proxy for the share of Explorar sessions (there are no session ids by design):
    ```sql
    select date_trunc('week', created_at at time zone 'America/Costa_Rica')::date as semana,
           count(*) filter (where name = 'monthly_filter_tap') as toques_mensual,
           count(*) filter (where name = 'page_view' and page = 'explorar') as vistas_explorar,
           round(100.0 * count(*) filter (where name = 'monthly_filter_tap') / nullif(count(*) filter (where name = 'page_view' and page = 'explorar'), 0), 1) as pct
    from public.events where created_at > now() - interval '12 weeks' group by 1 order by 1;
    ```
- [ ] **Commit:** `docs/decisiones.md CLAUDE.md docs/diseno-v1.md docs/telemetria.md` — message «Documenta «Alquiler mensual» como característica con precio al mes opcional».

---

## Task 8: Final verification

- [ ] Repo root: `pnpm db:reset`. From `apps/app`, in order, each green:
  1. `pnpm typecheck`
  2. `pnpm test`
  3. `pnpm test:db`
  4. `pnpm build`
  5. `pnpm size`
  6. `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e --workers=1` (full suite; the ficha hydration test is included)
  7. `CHROMIUM_PATH=… pnpm lighthouse`
- [ ] Repo root: `pnpm test:prototype`. All `tests/prototype/*.cjs` pass, and `git diff --stat design/` is empty.
- [ ] Greps, each with 0 hits in `apps/app/src`:
  - `Vacacional`
  - `Marque Vacacional`
  - `modesLabel`
  - `MODE_CHIPS`
  - `modeFilter`
  - `secondaryPrice`
  - `"modo"`
  - `por noche o por mes`
- [ ] Manual check in the browser pane (`.claude/launch.json` `app`, mobile 375×812), done by actually opening the screens:
  - Explorar with the chip on and off;
  - Filtros;
  - a negotiable ficha;
  - the price step with No and with Sí (no scroll).
- [ ] No commit unless something was fixed. A fix goes in its own commit with the task's tests.

---

## Task 9 (remote — only run when migrations are pushed to bnbtico-pruebas): Test data reset

> Run this once, through the Supabase management API, **before** the first `supabase db push` of this project or of `.scratch/ubicacion-por-punto` to `bnbtico-pruebas` (ref `bpxiggdzgzolcazaaboj`).
>
> - It is not a migration and never runs in production.
> - It is **irreversible**: show the counts to Daniel and get his explicit «sí» in chat right before step 2.
> - If the counts in step 1 are already 0 (ubicacion-por-punto already ran it), skip to the push.
> - Do not open pruebas.bnbtico.com.
> - Never print the CLI token or the service role key: read them inside the same command.
>
> What is kept: `auth.users`, `profiles` (admins included), `payment_methods`, `payment_customers`, `payment_events`, `requests`, `fx_rates` and the telemetry tables. `events.listing_public_id` is plain text with no FK, so it stays.
>
> Deleting `subscriptions` also frees the launch-offer slots (`launch_offer_taken()` = `max(promo_slot)`), which is intended for test data.
>
> `listings_purge_page` / `listing_photos_purge_page` fire `pg_net` purge calls per deleted active row. That is expected.

Helper (run SQL via the management API; the body is a JSON `{"query": …}`):
```bash
q() { curl -sS -X POST "https://api.supabase.com/v1/projects/bpxiggdzgzolcazaaboj/database/query" \
  -H "Authorization: Bearer $(security find-generic-password -s 'Supabase CLI' -w)" -H "Content-Type: application/json" \
  --data "$(jq -n --arg q "$1" '{query:$q}')"; }
```

- [ ] **1. Counts (show them to Daniel):**
```sql
select 'listings' as tabla, count(*) from public.listings
union all select 'listing_photos', count(*) from public.listing_photos
union all select 'listing_rates', count(*) from public.listing_rates
union all select 'listing_days', count(*) from public.listing_days
union all select 'favorites', count(*) from public.favorites
union all select 'inquiries', count(*) from public.inquiries
union all select 'subscriptions', count(*) from public.subscriptions
union all select 'subscription_reminders (outbox)', count(*) from public.subscription_reminders
union all select 'request_matches', count(*) from public.request_matches
union all select 'admin_actions con casa (quedan, casa a null)', count(*) from public.admin_actions where target_listing_id is not null
union all select 'storage listings (objetos)', count(*) from storage.objects where bucket_id = 'listings'
union all select 'profiles (se quedan)', count(*) from public.profiles
union all select 'admins (se quedan)', count(*) from public.profiles where is_admin;
```
- [ ] **2. Delete the rows, children first, in one transaction** (only after Daniel's «sí»):
```sql
begin;
delete from public.subscription_reminders;
delete from public.subscriptions;
delete from public.request_matches;
delete from public.inquiries;
delete from public.favorites;
delete from public.listing_days;
delete from public.listing_rates;
delete from public.listing_photos;
update public.admin_actions set target_listing_id = null where target_listing_id is not null;
delete from public.listings;
commit;
```
  Every child FK is `on delete cascade` (`0001_init.sql`), so the explicit order is a safety net, not a requirement. `admin_actions.target_listing_id` is `on delete set null`.
- [ ] **3. Delete the photo objects** (bucket `listings`; paths `<listing id>/<uuid>/<480|800|1600>.jpg` or the older `<listing id>/<uuid>.jpg`). Supabase blocks `delete from storage.objects` (`storage.protect_delete`), so use the Storage API with the service role key, in batches of up to 1000 names:
```bash
KEY=$(curl -sS "https://api.supabase.com/v1/projects/bpxiggdzgzolcazaaboj/api-keys?reveal=true" \
  -H "Authorization: Bearer $(security find-generic-password -s 'Supabase CLI' -w)" | jq -r '.[] | select(.name=="service_role") | .api_key')
q "select name from storage.objects where bucket_id = 'listings' order by name" | jq -c '[.[].name] | _nwise(1000)' | while read -r batch; do
  curl -sS -X DELETE "https://bpxiggdzgzolcazaaboj.supabase.co/storage/v1/object/listings" \
    -H "Authorization: Bearer $KEY" -H "apikey: $KEY" -H "Content-Type: application/json" \
    --data "$(jq -n --argjson p "$batch" '{prefixes:$p}')" | jq 'length'
done; unset KEY
```
- [ ] **4. Check:** rerun step 1. Every row except `profiles` and `admins` is 0, and those two equal their step 1 values.
- [ ] **5. Push:** from the repo root, `pnpm exec supabase db push --yes`. Report the counts before and after to Daniel. He checks the deployment himself.
