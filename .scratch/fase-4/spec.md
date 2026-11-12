# Spec · Fase 4 · Owner calendar

Status: ready-for-agent (approved by Daniel 2026-10-23)
Date: 2026-10-23
Decided by: Daniel (brief of 2026-10-23), on top of `CLAUDE.md`, `docs/plan-implementacion.md` (Fase 4), `docs/decisiones.md` (2026-10-20 «calendario simple», 2026-10-13 «Ficha móvil más corta», 2026-10-12 «Calendario visual, cierre temporal y reapertura opcional» and «Selección primero y edición conjunta»), `docs/diseno-v1.md` (13, 15, 3) and the prototype (`design/prototype/calendar.js`, mobile view, `tests/prototype/calendar.cjs`).
Language note: this spec is in English because it is a technical artifact; all UI copy stays in Spanish de Costa Rica, treating the user as **usted**.

## Problem Statement

After phase 3 a client can write to an owner, but nothing tells the client which nights are already taken or which dates cost more. Owners answer «ya está ocupado» on WhatsApp over and over, and have no way to close a house to consultations «hasta el 15 de enero» without remembering to reopen it. The Calendario tab is a placeholder («Llega más adelante»), the house detail row «Calendario y precios» says the same, and the «Marcar las noches ocupadas» button after submitting a house leads nowhere useful.

The database already has `listing_days` (one row per day that differs from the default: occupied and/or a special price) and `listings.available` / `listings.reopen_at`, but: owners write `listing_days` directly through REST with a policy that only checks ownership (no date range, no price validation, no all-or-nothing save, no refresh of the cached public page), the reopen date is never set nor applied (no `pg_cron`), and the public listing page shows no availability at all.

## Solution

- **Owner calendar** (design 17, `/propietario/calendario`): house selector, month with arrows, Monday-first grid of 46 px days showing each night's price («95k»), occupied nights in terracotta-light with «ocupado», ★ on nights with a price different from the base. Selection first: the owner taps one or more days; a fixed bottom panel «N noches · 20–22 dic» offers Disponible / Ocupado and the price; «Guardar cambios» saves everything at once or nothing. No seasons, no weekend price, no «Configurar tarifas».
- **«No disponible» with optional reopening date** (design 19 switch «Disponible para consultas»): switching it off asks, in a small sheet, for an optional date; at 00:00 Costa Rica time of that date a nightly database job opens the house to consultations again. Reopening by hand cancels the date. Closing never hides the listing; reopening never republishes a hidden one.
- **Availability on the public listing** (SSR `/casa/CT-####` and its SPA twin): a new «Disponibilidad» section with the month grid, read-only: occupied nights marked, a figure only on nights whose price differs from the base, and a line with the base price. It is mounted after hydration in a fixed-size box from data that already came in the page (no extra request, no effect on LCP).
- **The public page reflects a change at once:** every calendar save and every opening/closing asks the worker to drop the cached copy of that listing page (the existing `pg_net` purge), once per save.

## User Stories

### Owner

1. As an owner, I want to mark the nights that are already taken, so that clients stop asking for them.
2. As an owner, I want to select several days at once and mark them occupied or available together, so that a week takes one save.
3. As an owner, I want to change the price of specific dates (Christmas, a festival) without touching the rest, so that I can charge more on busy days.
4. As an owner, I want to see each night's price in the grid and a ★ on the ones I changed, so that I know at a glance what is special.
5. As an owner, I want occupying a night to keep its price and freeing it to keep it too, so that availability and price never undo each other.
6. As an owner who selected days with different prices, I want the price field empty («Varios precios») and untouched unless I type one, so that changing only availability doesn't overwrite my prices.
7. As an owner, I want typing the base price to remove the ★, so that going back to normal is obvious.
8. As an owner, I want a save to apply completely or not at all, with the reason in Spanish if it fails, so that the calendar never ends half-changed.
9. As an owner with several houses, I want to switch house in the calendar and never see another house's days, so that I don't mix them up.
10. As an owner, I want past days greyed and not editable, and to move up to 12 months ahead, so that I only edit what matters.
11. As an owner, I want to close a house to consultations with an optional reopening date, so that I don't have to remember to reopen it.
12. As an owner of a closed house, I want the calendar to tell me it is closed (and until when) and to keep all my days and prices for when it reopens, so that nothing is lost.
13. As an owner who just submitted a house, I want «Marcar las noches ocupadas» to take me to its calendar, so that it is ready when it's approved.
14. As an owner, I want the house detail to tell me how many nights are taken this month, so that I see it without opening the calendar.

### Client

15. As a client on a listing, I want to see which nights are occupied, so that I only ask for free dates.
16. As a client, I want to see a figure only on the dates that cost something different from the price in the bar, so that the page stays short and honest.
17. As a client on a closed house, I want to see «Calendario cerrado» and when it reopens, so that I know when to come back.
18. As a client opening a link from WhatsApp, I want the page to appear as fast as today, so that the calendar doesn't make me wait.

### bnbtico (operator)

19. As the operator, I want every calendar write to go through one validated database function, so that no client can write arbitrary rows.
20. As the operator, I want a change by the owner to be visible on the cached public page within seconds, so that clients never see stale availability.

## Implementation Decisions

### What already exists

- `listing_days(listing_id, day date, available boolean default true, special_price_crc int > 0)` in `0001`; select policy `days_select` → `listing_visible(listing_id)` (active, own or admin; anon can read days of active houses); write policy `days_owner_write for all using (owner)` with no `with check`, no status rule, no range. No purge trigger on it.
- `listing_rates` (seasons and weekend): out of v1, unused by the app. Same open owner-write policy.
- `listings.available boolean`, `listings.reopen_at date` (comment in `0001`: «reapertura automática a medianoche CR; null = manual»); `set_listing_available(p_listing uuid, p_available boolean)` (owner, active only, clears `reopen_at`). `listings_public` exposes `available` and `reopen_at`; `PublicListing.reopenAt` and `reopenLabel()` already exist and the contact button already shows «No disponible para consultas · Vuelve a estar disponible el …».
- Purge: `purge_listing_page(public_id)` (Vault secrets, `pg_net`, no-op without secrets); triggers on `listings` (active-or-was-active, any change but `updated_at`) and on `listing_photos`. A change of `available`/`reopen_at` already purges.
- Owner screens in `src/client/screens/propietario.tsx` (lazy chunk `propietario-*`): `CalendarioScreen` placeholder, «Calendario» button on active cards in Mis casas, «Calendario y precios … llega más adelante» row in the detail, «Marcar las noches ocupadas» in «enviada»; availability switch optimistic with rollback (`["own-listings", uid]`).
- `costaRicaToday()` in `src/domain/inquiry.ts`; `longDate`, `reopenLabel` in `src/domain/dates.ts`.
- Sizes: private initial JS **136.51 KB gz of 150**; tab screens 18.58 / 20; contact sheet 4.86 / 5 (not to be touched); SSR listing hydration closure ≈ 91.5 KB; Lighthouse listing LCP 1.60 s (gate 2.0 s), installed shell 0.28 s.

### Schema (one additive migration, `fase4_calendario`)

- **Writes only through RPCs.** Drop `days_owner_write` and `rates_owner_write`; `revoke insert, update, delete` on `listing_days` and `listing_rates` from `anon, authenticated`. Select policies stay.
- **`save_listing_days(p_listing uuid, p_days date[], p_available boolean default null, p_price_crc int default null) returns void`**, `security definer`, `search_path = ''`, execute for `authenticated` only:
  - caller owns the listing; status is anything but `rejected` («No encontramos ese anuncio.» for not-own/missing, same message as elsewhere; rejected: «Este anuncio fue rechazado; publique uno nuevo.»);
  - the listing is `available` («La casa está cerrada a consultas. Ábrala para cambiar el calendario.») — prototype rule «closed calendar cannot be edited»;
  - `p_days` non-empty, ≤ 366 distinct days, each in `[today CR, today CR + 365]` («Elija días entre hoy y dentro de un año.»);
  - at least one of `p_available` / `p_price_crc` is not null («No hay cambios que guardar.»);
  - `p_price_crc` integer in `1..100 000 000` («Escriba un precio por noche en colones, mayor que cero y sin decimales.»); not allowed when the house has no nightly price (Mensual only);
  - per day: availability set if given (price kept); price set if given — equal to the listing's `nightly_price_crc` ⇒ `special_price_crc = null` (back to base, no ★), otherwise the special price (availability kept). Rows that end as `available = true and special_price_crc is null` are deleted (only differences are stored);
  - all in the one statement/transaction (atomic by construction);
  - if the listing is `active`, `purge_listing_page(public_id)` **once** at the end (no row trigger on `listing_days`: a 30-day save must not enqueue 30 purges).
- **`set_listing_available(p_listing uuid, p_available boolean, p_reopen_at date default null)`** replaces the two-argument version (drop + create; PostgREST resolves by named args). Owner, active only (unchanged message). Closing: `reopen_at` optional, must be in `[tomorrow CR, today CR + 365]` («La fecha de reapertura debe ser a partir de mañana y dentro de un año.»). Opening: `available = true, reopen_at = null` (manual reopening cancels the date); a date with `p_available = true` is refused. Purges through the existing `listings` trigger.
- **Automatic reopening:** `create extension if not exists pg_cron`; `reopen_due_listings(p_today date default (now() at time zone 'America/Costa_Rica')::date) returns int` (`security definer`, not executable by anon/authenticated): `update listings set available = true, reopen_at = null where not available and reopen_at <= p_today` — it **never touches `status`** (a hidden or in-review house stays hidden; it only stops being closed to consultations), sets `app.allow_status` like `set_listing_available` so `listings_protect` lets it through; returns the count. Job `cron.schedule('bnbtico-reabrir-casas', '0 6 * * *', 'select public.reopen_due_listings()')` — 06:00 UTC = 00:00 Costa Rica (no DST). The `listings` purge trigger refreshes each reopened page.
- **Public read:** `public_listing_days(p_public_id text) returns table(day date, available boolean, special_price_crc int)` (`security definer`, `stable`, execute for `anon, authenticated`): only for a publicly visible (active) listing, days in `[today CR, today CR + 365]`, ordered. Used by the worker (SSR data) and by the SPA listing. `listings_public` is **not** changed (Explorar must not carry calendars).
- `0001_init.sql` is not edited. Types regenerated (`pnpm --filter app db:types`).

### Domain (`src/domain/calendar.ts`, no framework; the Vitest port of `tests/prototype/calendar.cjs`)

- Types: `CalendarDay { day: string /* YYYY-MM-DD */; available: boolean; specialPriceCrc: number | null }`, `DayState` (effective: `available`, `priceCrc | null`, `special: boolean`), `CalendarChange { days: string[]; available?: boolean; priceCrc?: number }`.
- `effectiveDay(days, base, date)`; `monthGrid(month, today)` → Monday-first weeks with leading blanks, `past` flag; `calendarWindow(today)` → first and last editable month (today … today + 365); `compactPrice(crc)` («95k», «180k», «1,2M»; USD variant via `currency.ts` for the public page).
- Selection model as a pure reducer (`selectDay`, `clearSelection`, `setAvailability`, `setPrice`): prefill = the common availability and the common effective price of the selected days; mixed prices ⇒ empty field with placeholder «Varios precios»; editing intent tracked (`priceEdited`, `availabilityChosen`); deselecting the last day clears the draft; `changeFromSelection()` returns `null` when nothing was chosen (no mutation).
- `validateChange(change, ctx)` with exactly the RPC's messages (`CALENDAR_MESSAGES`); `applyChange(days, base, change)` = the same per-day rules as the RPC (used by the fake and for optimistic updates).
- `selectionLabel(days)` («1 noche · 20 dic», «3 noches · 20–22 dic», «4 noches · 30 dic – 2 ene», non-contiguous: «3 noches · 20, 22 y 24 dic»); `occupiedNightsIn(days, month)` for the detail row («Diciembre: 9 noches ocupadas»).
- `validateReopenDate(date, today)` with the RPC's message.
- Rules from `calendar.cjs` that apply to v1 and must be Vitest cases (seasons, weekend and «Configurar tarifas» rules are out of v1 and not ported): availability and price independent (occupy keeps price, free keeps price); per-house isolation; invalid bulk edit is atomic (empty selection, day out of range, price 0 / negative / > 100 000 000 / non-numeric / empty); guest cannot edit; closed calendar cannot be edited and closing preserves per-day availability and prices; reopening restores the exact previous state; unavailable listing stays visible (Explorar) and cannot be contacted; reactivating a hidden listing does not mark it available by itself; past and nonexistent reopening dates invalid; due date reopens automatically and keeps prices; no date stays closed; scheduled reopening never reactivates a hidden listing; selection-first prefill; mixed untouched prices allow availability-only changes; nothing chosen = no mutation; combined save atomic; price equal to base is not special; last deselection clears the draft; no panel before selecting days; same bulk price stays independent per day afterwards.

### API (interfaces in `src/domain/api.ts`, two adapters, contract suites)

- `OwnerCalendarApi`: `days(listingId) → CalendarDay[]` (today … +365, own listing; `[]` for someone else's), `save(listingId, change)`.
- `OwnerListingsApi.setAvailable(id, available, reopenAt?: string | null)` (extended; same name).
- `PublicListingsApi.getPublicDays(publicId) → CalendarDay[]` (`[]` if not public).
- Fake: `FakeDb` gains `days`, an injectable «today» (same clock as inquiries) and `reopenDue(today)`; same messages as the RPCs.
- Contract `tests/contract/calendar.contract.ts` (fake + local Supabase): own house read/save; another owner reads `[]` and cannot save; anonymous cannot save; occupy keeps price and free keeps price; price equal to base removes ★ and deletes the row; bulk save atomic (one bad day ⇒ nothing changes); range limits (yesterday, today, +365, +366); price limits; Mensual-only refuses a price; nothing to save; closed house refuses; rejected refuses; draft / in review / changes allowed; public read only for active houses, only the window, the days of a draft never public; close with date (tomorrow ok, today and +366 refused), reopen clears date, date with open refused; `reopenDue` opens due houses, leaves future ones and never changes status.
- DB tests `tests/db/fase4-calendario.test.ts`: direct insert/update/delete on `listing_days` and `listing_rates` → 42501 for owner and anon; `reopen_due_listings` not callable by anon/authenticated; cron job `bnbtico-reabrir-casas` registered with `0 6 * * *`; `reopen_due_listings('<date>')` reopens a due active house and a due draft without changing either status; a 30-day save enqueues exactly one purge request (Vault secrets set inside a rolled-back transaction, as in `admin-aal2-purga.test.ts`); closing/opening enqueues one; a save on a draft enqueues none.

### Owner calendar screen (design 17)

- Route `/propietario/calendario` with search `casa=<listing id>&mes=YYYY-MM` (validated; default: last house used — kept in `localStorage` — or the first non-rejected house; current month). **Own lazy chunk** (`calendario-*.js`) with its own `size-limit` entry (≤ 8 KB gz) and excluded from the private initial and from the tab-screens entry; prefetched on intent and on idle with the other owner screens.
- Root header: logo, H1 «Calendario» + house selector pill (white, 1.5 px border, name with ellipsis, chevron) that opens a list of the owner's non-rejected houses. Month line: arrows «Mes anterior»/«Mes siguiente» (disabled at the window ends) + «Diciembre 2026» + «Toque los días para editarlos».
- Grid: weekday header «L K M J V S D»; 46 px day buttons, 12 px radius: available `#DCE8DF` with price «95k» in `#2F5D45`; occupied `#F5DDD4` / `#9E3D22` with «ocupado»; ★ next to the number when special; selected = 2 px border `#BF4D2E`, `aria-pressed`; past days disabled and faded; each button has an `aria-label` with the full date, state and price. Legend: Disponible · Ocupado · ★ Precio distinto. Mensual-only house: no prices in the grid nor the panel.
- Panel (fixed at the bottom over the tab bar, only while days are selected): «N noches · fechas» + «Cancelar»; segmented Disponible / Ocupado (`aria-pressed`, none pressed when mixed and untouched); price field «₡» with placeholder «Varios precios» when mixed (`inputmode="numeric"`, `enterKeyHint="done"`); when some selected day has ★, a text link «Usar el precio base (₡95 000)» that fills the base price (not in design 17; the prototype's «Restaurar tarifa» in its simplest form); one filled button «Guardar cambios», disabled until something was chosen. The keyboard must not hide the field (same `--kb` approach as the wizard and the contact sheet on iPhone).
- Save: optimistic (`applyChange` on the cached days, selection cleared, panel closed at once, < 50 ms), then `save`; on refusal or no network, roll back and show the DB message / «Sin conexión…» in a toast; query `["calendar", uid, listingId]` (all days of the window in one request, so month navigation needs no network; stale 30 s, persisted with the private keys, removed on sign-out, refetch on focus/resume). A successful save also invalidates the public listing and days queries of that house.
- Closed house: instead of the grid's interactivity, a note «Esta casa está cerrada a consultas[ hasta el <fecha>]. Ábrala para cambiar el calendario; sus noches y precios se conservan.» + outline button «Abrir a consultas» (the same mutation as the detail switch); days shown read-only and dimmed.
- No houses: «Publique su casa para usar el calendario.» + «Publicar casa». House not editable (rejected) is not offered.
- Entry points: the tab; Mis casas card «Calendario» (`casa=<id>`); detail row «Calendario y precios»; «Marcar las noches ocupadas» on «enviada» (`casa=<id>`).

### «No disponible» with reopening date (design 19)

- Detail switch «Disponible para consultas» (subtitle unchanged: «Si la cierra, la ficha sigue visible pero sin botón de contacto»): switching **off** opens a small bottom sheet «Cerrar a consultas» with «¿Cuándo vuelve a abrir? (opcional)» date input (min tomorrow, max +365), help text «Sin fecha, queda cerrada hasta que usted la abra.», filled «Cerrar a consultas» and «Cancelar». Switching **on** is one tap, optimistic as today, and clears the date.
- When closed with a date, the row shows «Cerrada hasta el 15 de enero» (`reopenLabel`); without date «Cerrada a consultas». Mis casas card «No disponible» pill unchanged.
- The detail row «Calendario y precios» shows «<Mes>: N noches ocupadas» (current month; «Sin noches ocupadas este mes» at 0) from the same calendar query (fetched with the detail; one light request).
- Sheet in the `propietario` chunk (small); tab-screens limit may rise from 20 to 21 KB only if needed, justified in the closing notes.

### Public listing (SSR and SPA)

- The worker loads `getPublic` and `getPublicDays` **in parallel** (no added latency); the days go into the existing `ssr-data` JSON. Status pages (404, 410, 503) unchanged. The cache key and `s-maxage` are unchanged.
- New section «Disponibilidad» after the features and before «Zona aproximada»: title + ₡/$ is already elsewhere (prices follow the page's currency choice), month line with arrows (current month … +12), the read-only grid (same `MonthGrid` component as the owner screen, without buttons: `role="grid"` with labelled cells), occupied in terracotta-light without figure, available plain, a figure only on ★ days, past days faded, legend «Disponible · Ocupado · ★ Precio distinto», and the line «Precio base ₡95 000 por noche; los días con ★ tienen otro precio.» (Mensual-only: no figures and no base line). Closed house: the box shows «Calendario cerrado» + «Vuelve a estar disponible el …» when there is a date.
- **Mounted after hydration** in a box of fixed height (header + 6 week rows), from a **lazy chunk** (`listing-calendar-*.js`, own `size-limit` entry ≤ 4 KB gz) requested after hydration on idle or when the section approaches the viewport. Before that the box is an empty placeholder of the same size. The SSR HTML contains no calendar markup (only the data). The hydration closure must not grow by more than 0.5 KB gz; no new request at hydration; the hydration test stays green; Lighthouse listing LCP must stay ≤ 1.70 s locally (today 1.60 s, gate 2.0 s).
- SPA twin `/casa/$publicId`: `["listing-days", publicId]` public query (persisted with the public keys, stale 60 s, refetch on mount), seeded from `ssr-data` when present.
- Fresh after a change: the RPC purge drops the edge copy; the service worker is network-first for `/casa/*`; the SPA refetches. Playwright proves it end to end locally: Vault secrets pointing to the local worker (`host.docker.internal:<E2E_PORT>`, secret from the dev vars), owner saves in one context, a fresh anonymous context loads `/casa/CT-####` and sees the change in its HTML within 5 s. If the local worker turns out not to cache, the test still asserts the purge request was delivered (`net._http_response` 200) and the closing notes say so.

### Copy (usted; design 17 and 19)

All strings above. Dates: «20–22 dic», «30 dic – 2 ene», «Diciembre 2026», «Vuelve a estar disponible el 15 de enero». No «orientativo» in the calendar (design v1 removed it; the ficha bar line stays as approved).

## Testing Decisions

- Test first, as in phases R and 3. Seams: (1) Vitest for `calendar.ts` with every v1 rule of `calendar.cjs` (the prototype file itself is not modified and must keep passing); (2) contract suite `calendar.contract.ts` against the fake and local Supabase; (3) DB tests for grants, cron, reopening and purge counts; (4) worker HTTP seam: `ssr-data` carries the days, parallel loads, no days on status pages; (5) Playwright on Pixel 7.
- Playwright: owner calendar (select 3 days → occupied → saved in < 50 ms visually → reload keeps it → base row deleted when freeing; special price ★ → equal base removes ★; mixed prices availability-only; out-of-window arrows disabled; past days disabled; switch house; offline save rolls back with «Sin conexión…»; closed house read-only and «Abrir a consultas»); detail close with date → «Cerrada hasta el …» → `reopen_due_listings` called with that date through SQL → reopened, ficha button back; ficha calendar (occupied and ★ visible after hydration, no calendar markup in SSR HTML, no hydration warnings, fixed box height before/after, no PostgREST request at hydration, closed house «Calendario cerrado»); end-to-end freshness through the purge. Every spec creates its own houses and does not depend on what other specs leave (no assumptions about counts or pre-existing days; phase 3 CI failed on that).
- Gates unchanged: `typecheck`, `test`, `test:db`, `build`, `size` (private < 150 KB gz with the new chunks excluded and limited; contact sheet untouched at ≤ 5 KB), `test:e2e`, `lighthouse` (listing < 2.0 s, shell < 2.5 s; our own bar: listing ≤ 1.70 s locally).
- Never two test batteries against the same local Supabase at the same time; if tickets run in parallel, each worktree has its own Supabase (`project_id` and ports in an uncommitted copy of `config.toml`) and its own `E2E_PORT`.

## Out of Scope

- Seasons, weekend prices, «Configurar tarifas» (`listing_rates` stays unused, direct writes closed); minimum stays; inquiries or «Buscan casa» bars in the calendar (`calendar-consultations.js`, `calendar-searches.js`; decision 2026-10-13); marking an inquiry as an agreed stay; iCal import/export; prices per person; a calendar in the contact sheet (it keeps its own date fields); filtering Explorar by free dates.
- Any change to `apps/web`, to the cutover (`docs/corte-fase-r.md`, ticket 13), to the hosted Supabase project, Cloudflare or GitHub.

## Further Notes

- **Manual actions for Daniel (at the end, one at a time):** apply `fase4_calendario` to `bnbtico-pruebas` (it enables `pg_cron`; check the job in Database → Cron); confirm the purge Vault secrets from phase R exist there (without them the cached page lags up to a day); deploy `develop`; run `docs/pruebas-manuales-fase-4.md` from the phone.
- **Before production** (`docs/antes-de-produccion.md`): check that `pg_cron` runs in production (`cron.job_run_details`) and alert if the nightly reopening fails; Vault purge secrets in production pointing to bnbtico.com; review the 12-month window with real owners.
- Decisions recorded in `docs/decisiones.md` on the day each ticket lands.
