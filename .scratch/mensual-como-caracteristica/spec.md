# Spec · «Alquiler mensual» como característica, con precio al mes opcional

Status: needs-triage
Date: 2026-10-27
Decided by: Daniel, in the brainstorming of 2026-10-27 («Mejoras fase R y 3», project 4 of 4).
Language note: technical artifact in English; all UI copy in Spanish de Costa Rica, treating the user as **usted**.
Supersedes: the «Modalidad y tipo (diseño v1)» rule in `CLAUDE.md` (Vacacional, Mensual or both, one price per modality), the step 1 «¿Cómo alquila?» question and the step 8 per-modality prices of `docs/diseno-v1.md`, and the Vacacional/Mensual chips in Explorar.
Related: `.scratch/navegacion-simple/spec.md` (project 1), which touches the same Explorar header and the ficha header.
Step numbers: «step 8 (precio)» here is the current numbering. If `.scratch/ubicacion-por-punto/spec.md` lands first, steps 2 and 3 merge and the price step becomes step 7.

## Problem Statement

Today a house can be Vacacional, Mensual or both, each with its own price.

Explorar shows two chips, «Vacacional» and «Mensual». Both can be selected at once, which means the same as selecting none. That is confusing.

For a client, «Mensual» is really one more thing a house offers, like Wifi or Mascotas. For an owner, it is a question: «¿Acepta alquiler por meses?», sometimes without a price they want to fix up front.

## Solution

### Model

- **Every house is rented by the night.**
  - `nightly_price_crc` is required.
  - `accepts_nightly` stays in the table, always `true`, guarded by `check (accepts_nightly)`. No screen reads it.
- **«Alquiler mensual»** is `accepts_monthly boolean not null default false`. It is not added to the `feature` enum: for users it is a characteristic, but it is stored apart.
- **Monthly price is optional:** `monthly_price_crc` may be null when `accepts_monthly`. Null means «Precio a negociar con el dueño».
- Legacy columns `monthly_mode`, `min_nights` and `min_months` are left untouched. New code does not read them.

### Migration (`pnpm exec supabase migration new mensual_como_caracteristica < /dev/null`)

1. `accepts_monthly`: set `null` to `false`, then `set default false` and `set not null`. New drafts are inserted with `false` (`data/postgrest/owner.ts` l.74 and the fake).
2. **Existing monthly-only listings** (`accepts_nightly = false`):
   - `draft`: set `accepts_nightly = true`. Step 8 asks for the nightly price.
   - Any other status: set `accepts_nightly = true` and move to `changes`, with the review note «Añada un precio por noche: desde ahora toda casa se alquila por noches y lo mensual es opcional.»
   - These updates need `app.allow_status`, because `listings_protect` freezes content outside `draft`/`changes`. A local `db reset` will not catch a missing flag, so test the migration against data that has such listings.
   - **Before writing it:** count these listings in `bnbtico-pruebas` with the management API.
3. `add constraint listings_accepts_nightly check (accepts_nightly)`.
4. `submit_listing`:
   - requires `nightly_price_crc > 0`;
   - drops the «at least one modality» rule;
   - requires the monthly price only to be `> 0` **when given**.
5. Extend `events_name_check` with `'monthly_filter_tap'`.
6. Regenerate types (`supabase gen types`). `listings_public` keeps its columns.

### Publish wizard

- **Step 1:** remove «¿Cómo alquila?» (`client/publish/fields.tsx` l.300-314).
- **Step 5 (características):** unchanged. The nine feature chips; «Alquiler mensual» is not one of them when publishing.
- **Step 8 (precio)**, top to bottom:
  1. «Precio por noche», required.
  2. A question:
     > **¿Acepta alquiler por meses?** · **No** (selected by default) · **Sí**
  3. When the answer is Sí, *Precio al mes (opcional)* appears below, with the help text «Si lo deja vacío, en su ficha dirá *Precio a negociar con el dueño*».
  - Switching back to No clears the monthly price.
  - Decided 2026-10-27: on the price screen, not in características and not in a step of its own. The wizard keeps 9 steps.
- The step validation (`domain/step-forms.ts`, step 8) always requires the nightly price, and requires the monthly price only to be `> 0` when Sí is chosen and a price is typed.
- The preview (`domain/preview.ts`) and the owner's house detail show the same as the ficha.

### Explorar and Filtros

- **Chip row:** «Alquiler mensual» · «Más filtros».
- **URL:** `?mensual=1` replaces `modo`.
  - Old links: `modo=monthly` maps to `mensual=1`; `nightly` and `both` are dropped.
  - `domain/filters.ts`: remove `Mode`, `MODE_CHIPS`, `modeParam` and `modesFrom`, and add `monthly: boolean`.
- **Query:** `eq("accepts_monthly", true)` when set (`data/postgrest/listings.ts` and the fake).
- **With the filter on:**
  - The results line reads «N casas aceptan alquiler mensual» (singular «1 casa acepta alquiler mensual»).
  - Cards show «₡350 000 / mes», or «Precio a negociar» when there is no monthly price.
  - Filtros hides the price range and the query does not apply it. The `min`/`max` values stay in the URL, so they come back when the filter is turned off.
- **With the filter off:** «N casas» and «₡45 000 / noche».
- **The price always carries its unit.**
- In Filtros, «Alquiler mensual» is listed among the characteristics, after the nine, as the same toggle as the chip.
- Tapping the chip sends `monthly_filter_tap` (`shared/beacon.ts`, `domain/telemetry.ts`).
- «¿No encuentra lo que busca?» (`domain/search-help.ts`) writes «Busca alquiler mensual.» instead of «Modalidad: …».

### Ficha (`/casa/CT-####`) and cards

- Remove the `modesLabel` badge (`shared/listing-page.tsx` l.247, `domain/listing.ts` l.253).
- `domain/describe.ts` `prices()` becomes:
  - **main** = nightly, always;
  - **monthly** = `{ amount, unit: "mes" }`, or `{ negotiable: true }`, or null.
- When the house accepts monthly rentals:
  - The features grid shows «Alquiler mensual» with an icon (calendar).
  - The CTA bar's secondary line reads «Mensual: ₡350 000 / mes», or «Mensual: precio a negociar con el dueño».
- The contact sheet and the WhatsApp message do not change.

## Testing (test first)

- **Vitest:**
  - `filters.ts`: parse and serialise `mensual`, map old `modo` values, and ignore price when `monthly`.
  - `describe.ts`: card and ficha price for nightly only, monthly with price and monthly negotiable.
  - `step-forms.ts` (step 8):
    - the monthly answer defaults to No;
    - Sí without a price is valid;
    - Sí with a price ≤ 0 is invalid;
    - a nightly price is always required.
  - `search-help.ts`: the monthly line.
- **DB (`test:db`):**
  - `submit_listing` rejects a listing without a nightly price, and accepts `accepts_monthly` with a null monthly price.
  - `accepts_nightly = false` is rejected by the check.
  - The migration moves a non-draft monthly-only listing to `changes` with the note, and a draft only gets `accepts_nightly = true`.
- **Contract suite:** the monthly filter against PostgREST and the fake.
- **Playwright** (mobile viewport):
  1. Publish with «Sí» and no monthly price. After approval, the ficha shows «Mensual: precio a negociar con el dueño» and the «Alquiler mensual» feature.
  2. In Explorar, the chip changes the results line and card prices to «/ mes» or «Precio a negociar». Turning it off restores «/ noche» and the price range.
  3. `/explorar?modo=monthly` lands with the chip on.
- Prototype tests (`tests/prototype/*.cjs`) still pass. The prototype is not changed.
- Ficha hydration test and Lighthouse gate stay green.

## Documentation (same day)

- `docs/decisiones.md`: new entry with the new model, the monthly question on the price step defaulting to No, «Precio a negociar con el dueño», the single chip and the measurement event.
- `CLAUDE.md`:
  - Rewrite «Modalidad y tipo (diseño v1)»: toda casa se alquila por noches, «Acepta alquiler mensual» opcional con precio opcional, and Alojamiento completo or Habitación as before.
  - The characteristics list notes that filters add «Alquiler mensual».
- `docs/diseno-v1.md`: steps 1 and 8, Explorar and the ficha.
- `docs/telemetria.md`: the `monthly_filter_tap` event and a query for its share of Explorar sessions.

## Out of scope

- A monthly price-range filter.
- Minimum stay rules (`min_nights`, `min_months`).
- Monthly availability in the calendar.
- Dropping the legacy columns.
