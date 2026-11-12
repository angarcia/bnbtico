# Densidad, tarjetas con la etiqueta en la foto y un calendario más alto · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Ship decisions B (density, square full-bleed hero, Mis casas as a list of cards with the status on the photo, ocre only for money, Actividad cards) and C (tall vertical calendar with «Cerrar la casa hasta…» on top) plus the accessibility ruling of 2026-10-29 (terracota `#B44C30`, ✓ on selected chips, contrast test, calendar colours, ficha without «₡ | $» and with both currencies in the bar).

**Architecture:** Pure rules go to `src/domain` first (`cardLabel`, `casasView`, `noticeFor`, `shortDate`, `calendarMonths`, `cellPrice`), each with Vitest. Screens reuse one new presentational block, `HouseCardTop` (`src/client/house-card.tsx`), for Mis casas and Actividad; the owner calendar becomes a vertical list of lazily mounted `MonthGrid size="tall"` blocks and gets the close row that used to live in the house detail. No schema, RPC or PostgREST change: `set_listing_available` and `save_listing_days` are reused as they are.

**Tech Stack:** Vite + React 19 + TanStack Router/Query, TypeScript strict, Vitest (unit), Playwright (Pixel 7 profile, one worker), size-limit, Lighthouse; Supabase local for e2e.

**Spec:** `/Users/daguadomunoz/tmp_worskpace/casa-tica/.scratch/densidad-y-tarjetas/spec.md` (authority: `.scratch/ronda-ana-2026-10-28/decisiones.md` B and C; looks: `design/pantallas/v2/06-ficha.html`, `07-mis-casas.html`, `09-calendario.html`, `10-actividad.html`).

## Global Constraints

- All commands run from `apps/app` unless stated; `pnpm db:reset` runs from the repo root. E2E: `VITE_WA_GUESTS="+506 6000 0000" CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e <spec>` (the config already uses one worker; build first when the spec needs a fresh bundle: the Playwright web server builds).
- UI copy in Spanish de Costa Rica, **usted**, no voseo/tuteo. Exact strings used in this plan (verbatim):
  - Card labels: «Activa», «En revisión», «Borrador», «Cambios pedidos», «Rechazada», «Pendiente de pago», «Inactiva», «Cerrada», «Cerrada hasta el 3 dic» (pattern `Cerrada hasta el ${shortDate(reopenAt)}`), «Edición sin enviar», «Edición en revisión», «Cambios pedidos en la edición».
  - Card buttons: «Compartir ficha», «Enlace copiado», «Calendario», «Seguir publicando», «Descartar», «Corregir y reenviar», «Añadir método de pago», «Activar suscripción»; header «Nueva»; discard confirm «¿Descartar este borrador? No se puede deshacer.»
  - Calendar: «Cerrar la casa hasta…», «Sale de Explorar y no recibe consultas», «Cerrada hasta el 3 dic», «Cerrada: no aparece en Explorar ni recibe consultas», «Abrir la casa», «Toque los días para editarlos», «Ocupado».
  - Close sheet: title «Cerrar la casa»; body «No aparecerá en Explorar ni recibirá consultas. Sus noches y precios se conservan.»; field «Abrir de nuevo el (opcional)»; confirm «Cerrar la casa»; «Cancelar».
  - Ficha bar: «₡42 000 / noche», «Mensual: ₡650 000 / mes», «≈ $82 / noche», «≈ $1 275 / mes», «Contactar por WhatsApp», «Precios orientativos: el precio final lo acuerda con el propietario.»
- Numbers: gutter `16px` (`--gutter`), tab icons `26`, `.list-item` icons `24`, ficha feature icons `26`, card photo radius `20px`, tall calendar cells `≥ 64px`, hero `aspect-ratio: 1 / 1`, desktop hero `480px` at `min-width:900px`, `--brand-ink: #B44C30` (light; dark stays `#F0A48C`), calendar free `#DCE8DF`, busy `#F7E3D3` with text `#9A4B2A`, search selection `#D9775A` with `#1C2B2A`, band `#F7E6D8`. Text colour stays `--fg #1C2B2A`.
- Size budgets: **never raise an existing limit; new deferred chunks get their own new size-limit entry** (and their glob is excluded from «Zona privada · JS inicial»). Baseline (measured 2026-10-28 on `9a2c9c3`): initial 144.75/150 KB, tabs 23.02/24.5 KB, calendar 6.93/8 KB, ficha calendar 1.71/4 KB, actividad 2.01/4 KB, contact sheet 5.08/5.5 KB.
- No `style={}` in JSX (CSS classes only; the one existing imperative `style.height` in `useSpacerMatchingBar` stays). No `dangerouslySetInnerHTML`. CSP `script-src 'self'`: nothing inline.
- `src/domain` has no framework imports (the architecture test in `pnpm build` enforces it). PostgREST strings only in `src/data/postgrest` (none are added here).
- No migration in this plan. If one ever becomes necessary: `pnpm exec supabase migration new <name> < /dev/null`, then `pnpm db:types`; new tables/RPCs get policies + contract/db tests before screens; any `UPDATE` of `listings` in a migration needs `select set_config('app.allow_status','on',true)` first.
- Test first: every step writes the failing test, runs it, sees it fail, then implements.
- Commits: Spanish, imperative, one per task with tests green, **no co-author line**, **no push**.
- Desktop layouts are on hold: only keep the existing ≥ 900 px ficha rules working.

## Review Focus

1. **Actividad still keys its layout on `casasView`.** Once `casasView(1)` returns `"list"`, Actividad would show the two-per-row grid for a single house. Task 1 switches Actividad to `list.length > 1` in the same commit and runs `navegacion.spec.ts -g "7 ·"` (one active house: large figures); Task 6 adds the full-row assertion.
2. **`house-card.tsx` becomes its own shared chunk** (imported by `propietario` and `actividad`) and silently lands in the initial-JS bucket or escapes the tabs budget. Task 5 builds, lists `dist/client/assets/house-card-*.js`, adds the glob to the tabs entry and to the initial exclusions, and runs `pnpm size`.
3. **Ficha SSR/hydration with the square hero and the two-currency bar.** The dollar figures are now always rendered by the worker and must match the client's first render (same `useFx` value), and the square box must have its size before the image arrives. Task 7 asserts the 375×375 box and `data-hydrated` with no hydration warnings; Task 8 asserts the server HTML of the bar (`renderToString` unit test) equals the hydrated text.
4. **Vertical calendar: lazily mounted months vs selection, `?mes=` and sticky headers.** A day selected in a month, then scrolled away, must stay selected and be saved with a day of another month; `?mes=` must land with the month title visible (not under the sticky weekday row); only months near the viewport mount. Task 10's e2e covers all three (`toBeInViewport`, mounted-grid count, one save for two months).
5. **Closing a house moved screens and the sheet became lazy.** The detail loses its switch; if Calendario's row fails to load the sheet or the focus/inert handling breaks, there is no way to close a house. Task 11's e2e opens the sheet from Calendario, checks Escape closes it with focus back on «Cerrar la casa hasta…», closes with a date (house leaves Explorar), reopens with «Abrir la casa», and asserts the detail has no switch.

## File Structure

- `src/domain/navigation.ts` — `casasView` (≥ 1 → `"list"`), `noticeFor` (payment only), new `EditState`, `CardLabel`, `cardLabel`.
- `src/domain/dates.ts` — new `shortDate`.
- `src/domain/calendar.ts` — new `calendarMonths`, `cellPrice`.
- `src/domain/listing.ts` — `STATUS_LABELS.changes.badge` → `badge-review`.
- `src/client/house-card.tsx` (new) — `HouseCardTop`.
- `src/client/screens/propietario.tsx` — `CasasScreen` always a list; `OwnerCard` rebuilt on `HouseCardTop`; `ResumeCard`, `Thumb`, `Price`, `StatusBadge`, single view, `NoticeCard` resume branch deleted; `Detail` loses «Anuncio visible» and `CloseSheet`; new `PaymentDueNote`, `ActivateButton`.
- `src/client/screens/actividad.tsx` — `ActivityCard`/`SingleActivity` rebuilt on `HouseCardTop`.
- `src/client/screens/calendario.tsx` — vertical months (`CalendarMonths`), `CloseRow`, lazy `CloseSheet`.
- `src/client/close-sheet.tsx` — new copy; loaded lazily from Calendario.
- `src/shared/month-grid.tsx` — `size` prop, exported `WeekdayRow`, «Ocupado».
- `src/shared/hero-gallery.tsx`, `src/shared/listing-page.tsx` — square hero, no currency switch, two-currency bar, feature icons 26, badge-mute.
- `src/shared/icons.tsx` — new `lock` icon.
- `src/client/chrome.tsx` — tab icon 26.
- `src/client/update-banner.tsx`, `src/client/screens/admin.tsx` — ocre → arena/salvia/green.
- `src/styles/global.css` — `--gutter`, `--brand-ink`, calendar colours, `.state-*` pills, `.house-card`, hero, calendar tall/vertical, chips ✓, «₡ | $» bold.
- `.size-limit.json` — tabs entry gains `house-card-*` (if emitted); new «Hoja "Cerrar la casa"» entry; initial exclusions.
- `design/tokens/tokens.json` (0.2.1), `CLAUDE.md` (token version), `docs/decisiones.md`, `docs/diseno-v1.md`, `docs/pruebas-manuales-revision-ux.md`.
- Tests: `tests/unit/navigation.test.ts`, `tests/unit/dates.test.ts` (new), `tests/unit/calendar.test.ts`, `tests/unit/listing.test.ts`, `tests/unit/ocre.test.ts` (new), `tests/unit/contrast.test.ts` (new), `tests/unit/month-grid.test.tsx`, `tests/unit/currency-switch-ssr.test.tsx`; e2e `propietario`, `navegacion`, `estados-suscripcion`, `calendario`, `no-disponible`, `fase4`, `app-instalada`, `ficha`, `ficha-calendario`, `explorar`, `tipo-de-cambio`, `fase5` (only if it asserts card buttons that change).

---

### Task 0: Pre-flight

This plan runs **first** in the round: nothing earlier changed the code. Record, do not change.

**Files:** none modified (answers go into the task ledger / handoff of the executing session).

- [ ] **Step 1: Confirm the starting point.** `git log --oneline -1` (expect `9a2c9c3` or a docs-only commit after it), `git status --short` (only the untracked `.agents/`, `.claude/skills/`, `.scratch/ronda-ana-2026-10-28/terracota/`, `skills-lock.json` and this plan). Record the HEAD hash.
- [ ] **Step 2: Baseline gates.** `pnpm typecheck && pnpm test && pnpm build && pnpm size`. Record every size line; expected ≈ initial 144.75, tabs 23.02, calendar 6.93, ficha calendar 1.71, actividad 2.01 KB. If any differs by > 0.2 KB, record the new number and use it as the baseline of Task 5/10/11 decisions.
- [ ] **Step 3: Record names later tasks rely on.** Confirm (grep) and record: `casasView`/`noticeFor` users (`src/client/screens/propietario.tsx`, `src/client/screens/actividad.tsx`); `CloseSheet` importers (only `propietario.tsx`); `STATUS_LABELS` users (`describe.ts`, `suscripcion.tsx`, `admin.tsx`); ocre classes in `src/client`/`src/shared` (`propietario.tsx` PayButton/PayNotice/ResumeCard/OwnerCard/Detail/CasasScreen, `suscripcion.tsx`, `admin.tsx` l.100/123/368/468, `update-banner.tsx`, `listing-page.tsx` l.252); `--brand-ink:#BF4D2E` in `global.css`; `<Icon size={22} />` in `chrome.tsx`; Playwright profile `devices["Pixel 7"]` (412×839).
- [ ] **Step 4: Record for the next plans (A, D, E, F+G) in the ledger:** names introduced here — `--gutter`, `--brand-ink`, `--cal-free`, `--cal-busy`, `--cal-busy-ink`, `--when-pick`, `--when-pick-ink`, `--when-band`, `.state-ok|review|draft|pay|off|bad`, `HouseCardTop`, `cardLabel`, `EditState`, `shortDate`, `calendarMonths`, `cellPrice`, `MonthGrid size`, `WeekdayRow`, `ActivateButton`, `PaymentDueNote`, `tests/unit/ocre.test.ts` allowlist, `tests/unit/contrast.test.ts` pairs, new size entry «Hoja "Cerrar la casa"». Final sizes are recorded again in Task 12.

No commit.

---

### Task 1: Domain rules for Mis casas (list always, payment-only notice, card label, short date)

**Files:**
- Modify: `src/domain/navigation.ts`, `src/domain/dates.ts`, `src/client/screens/actividad.tsx` (one line), `src/client/screens/propietario.tsx` (compile only: the `resume` branch of `NoticeCard` and `above === "resume"` go away; the single view keeps rendering until Task 5 by reading `list.length === 1` locally — see Step 5)
- Test: `tests/unit/navigation.test.ts`, `tests/unit/dates.test.ts` (new)

**Interfaces:**
```ts
// domain/dates.ts
/** «3 dic», «15 sep» (sin año); null si no es una fecha AAAA-MM-DD. */
export function shortDate(date: string): string | null;

// domain/navigation.ts
export function casasView(listingsCount: number): "list" | "none";
export type Notice = { kind: "payment"; listingId: string };
export function noticeFor(listings, subscriptions): Notice | null; // same params as today
/** Edición en curso de una casa publicada (la rellena el plan D; aquí siempre null). */
export type EditState = "unsent" | "review" | "changes" | null;
export type CardLabelClass = "state-ok" | "state-review" | "state-draft" | "state-pay" | "state-off" | "state-bad";
export interface CardLabel { text: string; cls: CardLabelClass }
/** Una sola etiqueta sobre la foto. Prioridad: pago (Pendiente de pago, Inactiva) > edición > Cerrada > estado. */
export function cardLabel(l: Pick<Listing, "status" | "available" | "reopenAt">, edit?: EditState): CardLabel;
```
Mapping (pinned): `payment_due` → «Pendiente de pago»/`state-pay`; `inactive` → «Inactiva»/`state-off`; edit `unsent` → «Edición sin enviar»/`state-draft`, `review` → «Edición en revisión»/`state-review`, `changes` → «Cambios pedidos en la edición»/`state-review`; `active` with `available=false` → `Cerrada hasta el ${shortDate(reopenAt)}` (or «Cerrada» without date)/`state-off`; `active` → «Activa»/`state-ok`; `review` → «En revisión»/`state-review`; `draft` → «Borrador»/`state-draft`; `changes` → «Cambios pedidos»/`state-review`; `rejected` → «Rechazada»/`state-bad`. Short months: `ene feb mar abr may jun jul ago sep oct nov dic`.

- [ ] **Step 1: Failing tests.**
  - `tests/unit/dates.test.ts`: `shortDate("2026-12-03")` → `"3 dic"`; `shortDate("2027-09-15")` → `"15 sep"`; `shortDate("2026-13-01")` and `shortDate("x")` → `null`.
  - `tests/unit/navigation.test.ts`: replace the `casasView` case with `expect([0, 1, 2, 7].map(casasView)).toEqual(["none", "list", "list", "list"])`. Replace «sin aviso de pago: el borrador…» with: `noticeFor([{ id: "a", status: "active" }, { id: "c", status: "changes" }, { id: "d", status: "draft" }], null)` → `null`, and «un borrador solo no da aviso»: `noticeFor([{ id: "d", status: "draft" }], null)` → `null`. Keep the payment cases unchanged (they still return `{ kind: "payment", listingId: "p" }` / `"a"`).
  - New `describe("cardLabel")`: one `it` per row of the mapping above with exact `{ text, cls }` (use `reopenAt: "2026-12-03"` → `"Cerrada hasta el 3 dic"`, `reopenAt: null` → `"Cerrada"`); priority cases: `cardLabel({ status: "payment_due", available: false, reopenAt: "2026-12-03" }, "review")` → «Pendiente de pago»; `cardLabel({ status: "active", available: false, reopenAt: null }, "review")` → «Edición en revisión»; `cardLabel({ status: "inactive", available: true, reopenAt: null }, "unsent")` → «Inactiva».
- [ ] **Step 2: Run** `pnpm test tests/unit/navigation.test.ts tests/unit/dates.test.ts` — expect FAIL (`shortDate`/`cardLabel` not exported, `casasView(1)` is `"single"`, `noticeFor` returns `resume`).
- [ ] **Step 3: Implement** the signatures above. `noticeFor` keeps only the subscriptions branch (delete the `resume` lookup and update its doc comment). `navigation.ts` imports `shortDate` from `./dates` (domain to domain).
- [ ] **Step 4: Keep callers compiling and behaving.** `actividad.tsx`: replace `casasView(list.length) === "list"` with `list.length > 1` and drop the `casasView` import. `propietario.tsx`: in `CasasScreen` compute `const single = list?.length === 1 ? list[0] : undefined` (temporary until Task 5, same behaviour as today); delete the `resume` branch of `NoticeCard` (it now only renders the payment notice), delete `ResumeCard`, and in `Detail` replace `above !== "resume"` conditions with `true` (the «Le pedimos cambios» card and «Seguir con el borrador» row always show in the detail). `primaryId` no longer depends on `notice.kind === "resume"`.
- [ ] **Step 5: Run** `pnpm typecheck && pnpm test` — PASS. Then `pnpm test:e2e navegacion.spec.ts -g "7 ·"` — PASS (single active house still shows the large figures).
- [ ] **Step 6: Commit** `src/domain/navigation.ts src/domain/dates.ts src/client/screens/actividad.tsx src/client/screens/propietario.tsx tests/unit/navigation.test.ts tests/unit/dates.test.ts` — «Añade cardLabel y shortDate; Mis casas siempre en lista y el aviso de arriba solo para el pago».

  Note: e2e specs that assert `resume-card` (`propietario`, `navegacion`, `estados-suscripcion`) are red from here until Task 5 rewrites them; Task 5 must leave them green. Do not run the full e2e suite between Tasks 1 and 5.

---

### Task 2: Calendar domain helpers (months list, price inside the tall cell, selection across months)

**Files:** Modify `src/domain/calendar.ts`; Test `tests/unit/calendar.test.ts`.

**Interfaces:**
```ts
/** Los meses del calendario del propietario, del actual al último de la ventana (hoy + 365), uno debajo de otro. */
export function calendarMonths(today: string): string[];
/** El precio dentro de la casilla alta: «₡95k», «₡1,3M», «₡500»; en dólares, el de compactPrice («$186»). */
export function cellPrice(crc: number, currency: Currency, fx: number): string;
```
Decision (spec vs mockup 09): the mockup draws «₡42 000»; the spec pins «₡95k» via `compactPrice`. The compact form is kept because six-digit prices («₡180 000») do not fit a 46 px column at 375 px; the ₡ sign from the mockup is added.

- [ ] **Step 1: Failing tests** in `tests/unit/calendar.test.ts`:
  - `calendarMonths("2026-10-28")` has length 13, first `"2026-10"`, last `"2027-10"`; `calendarMonths("2028-01-01")` has length 12, last `"2028-12"` (leap year: +365 = 2028-12-31); every entry equals `addMonths(first, i)`.
  - `cellPrice(95_000, "CRC", 510)` → `"₡95k"`; `cellPrice(1_250_000, "CRC", 510)` → `"₡1,3M"`; `cellPrice(500, "CRC", 510)` → `"₡500"`; `cellPrice(95_000, "USD", 510)` equals `compactPrice(95_000, "USD", 510)`.
  - «selección en dos meses»: with `ctx = { days: [], base: 95_000, today: "2026-11-20" }`, `selectDay(selectDay(emptySelection, "2026-12-02", ctx), "2026-11-30", ctx).days` → `["2026-11-30", "2026-12-02"]`; after `setAvailability(s, false)`, `changeFromSelection(s)` → `{ days: ["2026-11-30", "2026-12-02"], available: false }`; `selectionLabel(s.days)` → `"2 noches · 30 nov y 2 dic"`.
- [ ] **Step 2: Run** `pnpm test tests/unit/calendar.test.ts` — FAIL (missing exports; the selection case already passes, which is expected: it pins today's behaviour for Task 10).
- [ ] **Step 3: Implement** both functions with `calendarWindow` and `addMonths`; `cellPrice` wraps `compactPrice`.
- [ ] **Step 4: Run** `pnpm test` — PASS.
- [ ] **Step 5: Commit** `src/domain/calendar.ts tests/unit/calendar.test.ts` — «Añade calendarMonths y cellPrice para el calendario en vertical».

---

### Task 3: Tokens and density foundations (gutter, terracota ink, calendar colours, icons, selection without colour alone, contrast test)

**Files:**
- Modify: `src/styles/global.css`, `src/client/chrome.tsx`, `src/shared/listing-page.tsx` (feature icon size only), `design/tokens/tokens.json`, `CLAUDE.md`, `docs/decisiones.md`, `docs/diseno-v1.md`
- Test: `tests/unit/contrast.test.ts` (new), one new case in `tests/e2e/navegacion.spec.ts`

**Interfaces (CSS, light `:root`):** `--gutter:16px; --brand-ink:#B44C30; --cal-free:#DCE8DF; --cal-busy:#F7E3D3; --cal-busy-ink:#9A4B2A; --when-pick:#D9775A; --when-pick-ink:#1C2B2A; --when-band:#F7E6D8;` Dark block: `--cal-busy:#4A2521; --cal-busy-ink:#F0A48C; --cal-free:#1F3A2C` (dark keeps its own values; `--brand-ink` dark stays `#F0A48C`).

- [ ] **Step 1: Failing contrast test** `tests/unit/contrast.test.ts`: read `src/styles/global.css` with `node:fs`, parse the first `:root{…}` block that defines `--bg` into a map of variables, compute WCAG relative luminance contrast (helper in the test file), and assert ≥ 4.5 for: `--fg`/`--bg`, `--primary-on`/`--primary`, `#FFFBF2`/`--brand-ink`, `--brand-ink`/`--bg`, `--fg`/`--sun`, `--muted`/`--bg`, `--sun-ink`/`--sun-soft`, `--state-ink`/`--state-soft`, `--cal-busy-ink`/`--cal-busy`, `--when-pick-ink`/`--when-pick`, `--muted`/`--review-soft`, `--fg`/`--surface-2`, `--muted`/`--surface-2`. Also assert `vars["--brand-ink"] === "#B44C30"` and `vars["--gutter"] === "16px"`. (Measured: brand-ink on cream 5.06, busy 4.95, when-pick 4.72, muted on review-soft 4.51.)
- [ ] **Step 2: Failing e2e** in `navegacion.spec.ts` «densidad: márgenes de 16 px e iconos de 26 px en la barra»: as owner on `/explorar`, `getComputedStyle(main.view).paddingLeft` → `"16px"`, `.topbar` `paddingLeft` → `"16px"`, every `.tabbar .nav svg` has `width` attribute `"26"`, the active tab's computed `color` → `"rgb(180, 76, 48)"`; and «Solo alquiler mensual» pressed shows `::before` content `"✓ "` (read with `getComputedStyle(el, "::before").content` → `'"✓ "'`).
- [ ] **Step 3: Run** `pnpm test tests/unit/contrast.test.ts` and `pnpm test:e2e navegacion.spec.ts -g "densidad"` — FAIL.
- [ ] **Step 4: Implement.**
  - CSS: add the variables; `.view` padding `… var(--gutter) …`; `.chiprow` and `.photo-strip` `margin:0 calc(-1 * var(--gutter));padding:0 var(--gutter)`; `.topbar`, `.sticky-actions`, `.cta-bar`, `.cal-panel` side padding → `var(--gutter)` (the portada `.soon*` is not touched); `.count-badge` background `var(--brand-ink)`; `.list-item .muted-icon svg{width:24px;height:24px}`; `.chip[aria-pressed="true"]::before{content:"✓ "}` (only `aria-pressed` toggles: navigation chips with `aria-current`, e.g. the admin tabs, get no ✓); `.currency-switch button{font-weight:600}` and `[aria-pressed="true"]{font-weight:800}`; `.pin-icon span` keeps `var(--brand-ink)` (now `#B44C30`).
  - `chrome.tsx`: `<Icon size={26} />`.
  - `listing-page.tsx`: feature tiles `<Icon size={26} />` and `<I.calendar size={26} />`.
  - `tokens.json`: `version` `0.2.1`; changelog line «0.2.1: margen 16 px, iconos de pestaña 26, terracota de texto #B44C30, colores del calendario y de «¿Cuándo?», ocre solo para dinero»; `brandInk.light` `#B44C30` with role «Texto pequeño terracota, contadores, «Nueva», marcadores del mapa y pestaña activa (blanco encima 5,1:1)»; `sun.role` → «Dinero y avisos de pago: pagar, "Activar suscripción", "Añadir método de pago", y la fila o tarjeta de suscripción o método de pago cuando falta algo. Nunca acciones normales»; `tabBar.icon` `26`; `calendar.busy` `{ "bg": "#F7E3D3", "fg": "#9A4B2A" }`, `calendar.free` `"#DCE8DF"`, new `calendar.search` `{ "selected": "#D9775A", "selectedText": "#1C2B2A", "band": "#F7E6D8" }`; add `spacing.gutter` `16`.
  - `global.css` header comment: `tokens.json 0.2.1`. `CLAUDE.md`: «tokens en `design/tokens/tokens.json` 0.2.1».
  - `docs/decisiones.md`: new top entry `## 2026-10-29 · Densidad, tarjetas con la etiqueta en la foto y calendario en vertical (ronda de Ana, B y C)` with the first bullets: margen 16 px y `--gutter`; iconos de pestaña 26 px, de filas 24, de características 26; terracota de texto `#B44C30` (contraste 5,1:1) y `#D65C3C` solo para logo, corazones y lo grande; ✓ en los chips elegidos y «₡ | $» en negrita; prueba de contraste en CI. (Later tasks append their bullets to this same entry.)
  - `docs/diseno-v1.md` l.13: «icono 26 px + etiqueta…; activa en terracota `#B44C30`»; l.9 colours: add «terracota de texto `#B44C30`» and the margin «16 px».
- [ ] **Step 5: Run** `pnpm test && pnpm test:e2e navegacion.spec.ts -g "densidad|barra superior"` — PASS (the existing «la barra superior: 56 px…» and «cabe entera… sin scroll horizontal» must stay green with the smaller padding).
- [ ] **Step 6: Commit** `src/styles/global.css src/client/chrome.tsx src/shared/listing-page.tsx design/tokens/tokens.json CLAUDE.md docs/decisiones.md docs/diseno-v1.md tests/unit/contrast.test.ts tests/e2e/navegacion.spec.ts` — «Ajusta la densidad: margen de 16 px, iconos más grandes, terracota de texto #B44C30 y prueba de contraste».

---

### Task 4: Ocre only for money (allowlist test and class changes)

**Files:**
- Modify: `src/domain/listing.ts`, `src/client/screens/propietario.tsx`, `src/client/screens/admin.tsx`, `src/client/update-banner.tsx`, `src/shared/listing-page.tsx`, `docs/decisiones.md`, `docs/diseno-v1.md`
- Test: `tests/unit/ocre.test.ts` (new), `tests/unit/listing.test.ts`; e2e assertions touched in `propietario.spec.ts` (only the «Le pedimos cambios» detail case), `admin*.spec.ts` if they assert `tile-sun`/`note-sun` (grep first).

**Interfaces:**
```ts
// tests/unit/ocre.test.ts
const OCRE = /\b(btn|card|note|tile|badge)-sun\b/g;
// file (relative to src/) + "#" + nearest enclosing `function Name` declared before the match; "#*" = whole file.
const ALLOW = new Set([
  "client/screens/propietario.tsx#PayButton",
  "client/screens/propietario.tsx#PayNotice",
  "client/screens/propietario.tsx#PaymentDueNote",
  "client/screens/propietario.tsx#ActivateButton",
  "client/screens/propietario.tsx#CasasScreen", // casilla «por pagar»
  "client/screens/suscripcion.tsx#*",           // Promoción y suscripción, tarjeta y fila de Cuenta
  "shared/contact-sheet.tsx#*",                  // «no pague por adelantado»
]);
```
```tsx
// propietario.tsx — new money component used by Detail when there is no billing row
function PaymentDueNote({ listing }: { listing: Listing }): JSX.Element; // <div className="note note-sun">{describe(l,{base:""}).situation}</div>
```

- [ ] **Step 1: Failing tests.** `ocre.test.ts` walks `src/client` and `src/shared` (`.ts`/`.tsx`), collects every match as `file#fn`, and expects the list of matches not in `ALLOW` (allowing `#*`) to equal `[]`; the failure message lists offenders. `listing.test.ts`: add `expect(STATUS_LABELS.changes).toEqual({ label: "Cambios pedidos", badge: "badge-review" })` (keep `payment_due` → `badge-sun`).
- [ ] **Step 2: Run** `pnpm test tests/unit/ocre.test.ts tests/unit/listing.test.ts` — FAIL, listing at least `OwnerCard`, `Detail`, `UpdateBanner`, `ListingPage`, `QueueScreen`-equivalents in `admin.tsx`.
- [ ] **Step 3: Implement.**
  - `domain/listing.ts`: `changes.badge` → `"badge-review"`.
  - `propietario.tsx`: `OwnerCard` review note `note-sun` → `note-arena`; `Detail`: the `payment_due` without billing note → `<PaymentDueNote listing={l} />`; «Le pedimos cambios» / «Anuncio rechazado» card `card-sun` → `card-arena`, its «Corregir y reenviar» `btn-sun` → `btn-primary`.
  - `admin.tsx`: tile «con cambios» `tile-sun` → `tile-review`; sync-failed note `note-sun` → `note-arena`; «Zona propuesta por el dueño» `badge-sun` → `badge-mute`; «Faltan fotos…» `note-sun` → `note-arena` (text unchanged; plan E changes the rule).
  - `update-banner.tsx`: `btn-sun` → `btn-primary`.
  - `listing-page.tsx`: «No disponible por ahora» `badge-sun` → `badge-mute`.
  - Docs: append to the 2026-10-29 decision entry «Ocre (`--sun`) solo para dinero y avisos de pago», with the list of what stays and what changes (spec §4); `docs/diseno-v1.md` l.9: replace «ocre solo dinero y avisos de pago» with the explicit list.
- [ ] **Step 4: Run** `pnpm test` — PASS; `pnpm test:e2e propietario.spec.ts -g "con cambios pedidos"` and the admin specs that grep found — PASS after updating any `toHaveClass(/btn-sun|tile-sun|note-sun/)` that pointed at a non-money element.
- [ ] **Step 5: Commit** — «Reserva el ocre para el dinero y añade la prueba que lo vigila».

---

### Task 5: Mis casas — one card per row with the status on the photo (`HouseCardTop`)

**Files:**
- Create: `src/client/house-card.tsx`
- Modify: `src/client/screens/propietario.tsx`, `src/styles/global.css`, `.size-limit.json` (only if a `house-card-*` chunk is emitted), `docs/decisiones.md`, `docs/diseno-v1.md` (l.32)
- Test: `tests/e2e/propietario.spec.ts`, `tests/e2e/navegacion.spec.ts` (tests «3 ·», «la casa abierta desde la lista…», «2 ·»), `tests/e2e/estados-suscripcion.spec.ts`

**Interfaces:**
```tsx
// client/house-card.tsx
export interface HouseCardTopProps {
  listing: Listing;
  edit?: EditState;          // plan D
  eager?: boolean;           // first card: loading="eager"; others "lazy"
  sizes?: string;            // default "100vw"; Actividad two-per-row passes "50vw"
  link?: boolean;            // true in Mis casas: the title is a stretched <Link to="/propietario/casas/$id">
}
export function HouseCardTop(p: HouseCardTopProps): JSX.Element;
// renders: <div class="photo house-photo">{img | <span class="house-photo-empty"><I.house size={32}/></span>}
//            <span class={`state ${label.cls}`} data-testid="card-label">{label.text}</span></div>
//          <h2 class="house-card-title">{title}</h2>{l.zone ? <span class="small muted" data-testid="card-zone">{l.zone}</span> : null}
// img: src variantUrl(cover, 800), srcSet `${variantUrl(cover,480)} 480w, ${variantUrl(cover,800)} 800w` (omitted for isLegacyPhotoPath), width 800 height 800, alt "", decoding "async".

// propietario.tsx
function ActivateButton({ publicId }: { publicId: string }): JSX.Element; // SubscriptionLink className="btn btn-sun btn-block" «Activar suscripción»
function OwnerCard({ listing, userId, eager }: { listing: Listing; userId: string; eager: boolean }): JSX.Element;
```
CSS (pinned): `.house-card{position:relative;display:flex;flex-direction:column;gap:10px;padding:12px}`; `.house-photo{aspect-ratio:1/1;border-radius:20px;width:100%}`; `.house-photo-empty{color:var(--state-ink)}` on the arena box (`background:var(--surface-2)`); `.house-card-title{font-size:18px;font-weight:700}`; `.state{position:absolute;left:12px;top:12px;display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;font-size:13px;font-weight:700;line-height:1;box-shadow:0 2px 10px rgba(28,43,42,.22)}` + `::before` 8 px dot `currentColor`; `.state-ok` state-soft/state-ink, `.state-draft` surface-2/fg, `.state-review` review-soft/muted, `.state-pay` sun-soft/sun-ink, `.state-off` surface-2/muted, `.state-bad` busy/busy-ink. Buttons inside the card keep `position:relative;z-index:1` over the stretched link (as `.owner-card .btn` today).

Card buttons (pinned, at most one filled per card):
- `active` (`can(l,"share")`): `ShareButtonInline` filled (`btn-primary`) «Compartir ficha» + `Link` «Calendario» `btn-ghost` to `/propietario/calendario?casa=<id>`. No pay button on an active card (the top `PayNotice` covers the 90-day window).
- `draft`: `Link` «Seguir publicando» `btn-ghost` to `resumeStep(l)` + `button` «Descartar» `btn-link muted` only if `can(l,"discard")`, same confirm.
- `changes`: `<p className="note note-arena small">Nota de bnbtico: {reviewNote}</p>` then «Corregir y reenviar» filled `btn-primary btn-block` → step 1.
- `rejected`: the note only. `review`: nothing.
- `payment_due`: `<PayButton publicId>` (ocre). `inactive`: `<ActivateButton publicId>` (ocre).
- No price, no `card-line`, no stats on the card.

- [ ] **Step 1: Failing e2e** (rewrite, keep the seeds of `propietario.spec.ts`):
  - `propietario.spec.ts` «Mis casas: la etiqueta sobre la foto, sin precio, y un solo botón relleno por tarjeta»: five `article`s; `card(page,"Casa Cocles").getByTestId("card-label")` → «Activa»; «Cabina con cambios» → «Cambios pedidos» and its note «Nota de bnbtico: Faltan fotos del baño.» with class `note-arena`; «Casa en revisión» → «En revisión» and no buttons; «Borrador nuevo» → «Borrador», link «Seguir publicando» with class `btn-ghost` and `href` `/propietario/publicar/<draft.id>/<resumeStep>` plus button «Descartar»; `page.getByTestId("resume-card")` count 0; for every article `locator(".btn-primary, .btn-sun")` count ≤ 1; «Compartir ficha» of Casa Cocles has class `btn-primary` and `data-share-url` ending `/casa/<publicId>`; `card(page,"Casa Cocles")` does not contain `₡`; the first card's `img` has `loading="eager"`, the second `lazy`; the photo box is square (`boundingBox` width = height ± 1). Keep the existing offline/cache part and the «Nueva» `btn-ghost` check.
  - `propietario.spec.ts` «tocar la foto…»: tapping the photo of «Casa en revisión» opens `/propietario/casas/<review.id>`; the «Seguir» click becomes «Seguir publicando».
  - `navegacion.spec.ts` «3 ·» rewritten: «3 · una casa: la lista con una sola tarjeta; tocarla abre su detalle»: owner with one active house → `heading level 1` «Mis casas», one `article` with «Activa», «Compartir ficha» filled and «Calendario» outline, link «Nueva» to `/propietario/publicar`, link «Añadir otra casa» count 0; tapping the card title → `/propietario/casas/<id>` with header «Ver ficha». Same for the «una casa borrador» variant (line ~272): the card has «Seguir publicando», no `resume-card`, no `pay-notice`.
  - `estados-suscripcion.spec.ts`: the `resume-card` expectations become «el borrador sale una sola vez, en su tarjeta» (`card(page,"Borrador del Caribe").getByRole("link",{name:"Seguir publicando"})` visible, `[data-testid=pay-notice]` count 1 when a payment is due and nothing else above the tiles); every `card-line` assertion moves to the detail (`page.goto('/propietario/casas/<id>')` then `getByTestId("subscription-row")` with the same text) — keep one representative per state (lejos, cerca, pendiente, parada, en revisión), do not lose a state; «Reactivar» on the card becomes `getByRole("link",{name:"Activar suscripción"})` with class `btn-sun` and the same `payLink(...)` href; the «una sola casa» test checks the pay notice above the single card and not inside the detail.
- [ ] **Step 2: Run** `pnpm test:e2e propietario.spec.ts navegacion.spec.ts estados-suscripcion.spec.ts` — FAIL.
- [ ] **Step 3: Implement** `HouseCardTop`; rebuild `OwnerCard` on it (`article.card.house-card`); `CasasScreen` always renders the list for ≥ 1 house (title «Mis casas», «Nueva» in the header, `NoticeCard` payment only, tiles unchanged, `eager` for index 0); delete the temporary `single` branch, «Añadir otra casa», `Thumb`, `Price`, `StatusBadge` (the detail photo uses `cardLabel` in the same `.state` pill), the `primaryId` logic and the `primary` prop of `ShareButtonInline` (always `btn-primary` on the card; the detail's `ShareListItem` is unchanged). Delete dead CSS (`.owner-card*`, `.thumb*` if unused elsewhere — grep `thumb` first: `actividad.tsx` still uses it until Task 6, so leave `.thumb*` for Task 6).
- [ ] **Step 4: Size.** `pnpm build && ls dist/client/assets | grep -E "house-card|navigation"`. If `house-card-*.js` exists, add `"dist/client/assets/house-card-*.js"` to the tabs entry `path` and `"!dist/client/assets/house-card-*.js"` to the initial entry (limits unchanged). `pnpm size` — tabs ≤ 24.5 KB, initial ≤ 150 KB. If tabs is red, move `HouseCardTop` + `cardLabel` behind a lazy boundary is **not** acceptable (it is above the fold); instead remove more dead code from `propietario.tsx` first, and only as a last resort give `house-card-*` its own new entry (≤ 1.5 KB) removed from the tabs path.
- [ ] **Step 5: Run** the three specs again — PASS; `pnpm test && pnpm typecheck` — PASS.
- [ ] **Step 6: Docs.** Append to the decision entry: «Mis casas siempre en lista, una casa por fila; foto cuadrada con la etiqueta de estado; sin precio ni texto extra; un borrador es un solo elemento ("Seguir publicando" en contorno y "Descartar"); "Compartir ficha" relleno; las líneas de la suscripción se ven en el detalle». Supersedes note for «Una casa se ve directa en Mis casas» (2026-10-27). `docs/diseno-v1.md` l.32 rewritten accordingly.
- [ ] **Step 7: Commit** — «Mis casas en lista con la foto cuadrada y el estado encima; un borrador sale una sola vez».

---

### Task 6: Actividad — the same card, two per row or full row

**Files:** Modify `src/client/screens/actividad.tsx`, `src/styles/global.css`, `docs/diseno-v1.md` (l.31); Test `tests/e2e/navegacion.spec.ts` («7 ·», «7b ·», «7c ·»).

**Interfaces:**
```tsx
function ActivityCard({ listing, activity, figures, wide }: { listing: Listing; activity: ListingActivity | undefined; figures: FiguresState; wide: boolean }): JSX.Element;
// <article class={`card house-card activity-card${wide ? " is-wide" : ""}`}><HouseCardTop listing sizes={wide ? "100vw" : "50vw"} eager={index===0}/>
//   {status === "active" ? <FiguresSlot … large={wide}/> : wide ? <p>{EMPTY}</p> : null}</article>
```
Layout: `list.length > 1` → `<div className="grid-2 activity-grid">` of cards (`wide={false}`); one house → one card `wide`. `SingleActivity` and `statusOf` are deleted. Figure strings stay «visita(s)», «toque(s) en WhatsApp», «consulta(s)» (decision: the mockup's shorter «WhatsApp» is not adopted; tests and copy stay). In the two-column card, `.activity-figures` stack vertically (CSS `.activity-grid .activity-figures{flex-direction:column;gap:2px}`).

- [ ] **Step 1: Failing e2e.** «7 ·» adds: one `article` whose `getByTestId("card-label")` is «Activa», its photo box width ≥ 0.9 × viewport width, and `activity-figures` has class `lg`. «7b ·» (two houses): two `article`s side by side (`boundingBox().y` equal, `x` differs), the non-active one shows its label (e.g. «En revisión») on the photo and no `activity-figures`. «7c ·» unchanged.
- [ ] **Step 2: Run** `pnpm test:e2e navegacion.spec.ts -g "7"` — FAIL.
- [ ] **Step 3: Implement**; delete `.thumb`/`.thumb-sm` CSS if no other user remains (grep).
- [ ] **Step 4: Run** the spec, `pnpm build && pnpm size` (actividad ≤ 4 KB, tabs ≤ 24.5 KB) — PASS.
- [ ] **Step 5: Docs** `docs/diseno-v1.md` l.31 (Actividad: tarjetas con foto cuadrada y estado, de dos en dos; una sola casa a toda la fila con las cifras en grande); append one bullet to the decision entry.
- [ ] **Step 6: Commit** — «Actividad usa la tarjeta de Mis casas: de dos en dos o a toda la fila con una casa».

---

### Task 7: Ficha — square, full-bleed hero

**Files:** Modify `src/styles/global.css`, `src/shared/hero-gallery.tsx` (class only if needed), `src/shared/listing-page.tsx` (overlay row class), `docs/diseno-v1.md` (l.22); Test `tests/e2e/ficha.spec.ts`; gate `pnpm lighthouse`.

**Interfaces (CSS):**
```css
.listing-view{padding-top:0}
.hero{aspect-ratio:1/1;height:auto;border-radius:0;margin:0 calc(-1 * var(--gutter));background:var(--selection)}
.hero .top{top:calc(12px + env(safe-area-inset-top))}
@media (min-width:900px){ .listing-view{padding-top:calc(8px + env(safe-area-inset-top))}
  .listing-view > .hero{height:480px;aspect-ratio:auto;border-radius:var(--r-sheet);margin:0} }
```
Decision: «starting right under the safe area» vs «touches the top edge» — the photo goes edge to edge (behind the notch, like the mockup), and only the buttons are offset by the safe area. Cover attributes unchanged (`fetchpriority="high"`, `loading="eager"`, `decoding="sync"`, `sizes="100vw"`).

- [ ] **Step 1: Failing e2e** `ficha.spec.ts` «a 375 px la foto es cuadrada, a todo el ancho y pegada arriba, e hidrata sin avisos»: `page.setViewportSize({ width: 375, height: 812 })`, open a seeded `/casa/CT-####` with 5 photos, `.hero` box → `x` 0, `y` 0, `width` 375, `height` 375 (± 1); `.hero .top` box `y` ≥ 12; `.hero-counter` text «1 / 5»; `html[data-hydrated=true]`; the existing console-warning collector reports no hydration warning. The desktop test (l.251) stays as is.
- [ ] **Step 2: Run** `pnpm test:e2e ficha.spec.ts` — FAIL on the size.
- [ ] **Step 3: Implement** the CSS.
- [ ] **Step 4: Run** `pnpm test:e2e ficha.spec.ts` — PASS. Then `pnpm lighthouse` — ficha cold LCP < 2000 ms and shell < 2500 ms. **If the ficha fails:** in `HeroGallery`, render the cover as `<picture><source media="(min-width: 900px)" srcSet={full srcSet}/><img srcSet={480w, 800w only} sizes="100vw" …/></picture>` (helper in `domain/image.ts`: `export function phoneSrcSet(srcSet: string): string` that drops the `1600w` candidate, with a unit test in `tests/unit/image.test.ts`), re-run Lighthouse; never relax the budget.
- [ ] **Step 5: Docs** `docs/diseno-v1.md` l.22: «hero cuadrado (1:1) a todo el ancho, sin esquinas; botones crema encima a 12 px del área segura; contador «1 / 5»»; decision bullet.
- [ ] **Step 6: Commit** — «Ficha con la foto principal cuadrada a todo el ancho».

---

### Task 8: Ficha bar — both currencies, no «₡ | $» on the ficha

**Files:** Modify `src/shared/listing-page.tsx`, `src/styles/global.css`, `src/shared/currency-switch.tsx` (doc comment only: the switch lives in the top bar); Test `tests/unit/currency-switch-ssr.test.tsx` (rename the describe to «barra de la ficha en el servidor»), `tests/e2e/ficha.spec.ts` (l.48–118, 175–250), `tests/e2e/explorar.spec.ts` (l.205–215, 307), `tests/e2e/navegacion.spec.ts` («5 ·»), `tests/e2e/tipo-de-cambio.spec.ts` (l.65–81).

**Interfaces:**
```tsx
/** La barra fija de la ficha: colones a la izquierda (noche y, debajo, mensual), dólares a la derecha (≈ noche, ≈ mes),
 *  el botón y la nota. No depende de la moneda elegida: lo mismo en el servidor y al hidratar. */
function PriceColumns({ main, monthly, fx }: { main: Price | null; monthly: MonthlyPrice | null; fx: FxRate }): JSX.Element;
// left:  <span data-testid="main-price">₡42 000 <small>/ noche</small></span>  + <MonthlyLine monthly format={formatCRC}/>
// right: <span data-testid="price-usd" title="Orientativo: ≈ ₡510 por US$1, tipo de referencia del …">≈ $82 <small>/ noche</small></span>
//        + (monthly with amount) <span data-testid="monthly-usd">≈ $1 275 <small>/ mes</small></span>
// after the button: <p className="xs muted price-disclaimer" data-testid="price-note">Precios orientativos: el precio final lo acuerda con el propietario.</p>
```
Removed: `CurrencySwitchSlot` in the hero overlay (the row keeps share + heart boxes), `PriceReference`, the `.both` ghost trick in the bar, «· orientativo». The ficha calendar keeps following the stored currency for its ★ figures (unchanged). The disabled «No disponible por ahora» state keeps its note under the button and also shows the disclaimer.

- [ ] **Step 1: Failing tests.**
  - Unit (`renderToString` of `ListingPage` with `nightlyPriceCrc: 85000`, monthly 650 000, `FX_INITIAL`): HTML contains `data-testid="main-price">₡85 000` (with the NBSP the formatter emits — assert via `formatCRC(85000)`), `data-testid="price-usd">≈ ${formatUSD(85000, FX_INITIAL.crcPerUsd)}`, `data-testid="monthly-usd"`, «Precios orientativos: el precio final lo acuerda con el propietario.», and does **not** contain `currency-switch`.
  - E2E `ficha.spec.ts`: the SSR markup assertion (l.64) becomes `<div class="row gap-8"><span class="icon-btn" aria-hidden="true"></span><span class="icon-btn" aria-hidden="true"></span></div>`; «la ficha muestra las dos monedas, sin selector» replaces l.103: with currency stored as `USD`, `main-price` still «₡95 000 / noche», `price-usd` «≈ $186 / noche», `.listing-view .currency-switch` count 0; «ni hidratar ni cambiar de moneda cambian el alto de la barra» keeps its height check (switching `bnbtico_currency` via `StorageEvent` must not change the bar's height or text); the 320 px and iPhone SE tests assert the bar does not overflow (`scrollWidth <= clientWidth`) and the zone/capacity line is still visible above it.
  - `explorar.spec.ts` l.209–211 and `navegacion.spec.ts` «5 ·»: Explorar cards still follow «₡ | $»; on the ficha `main-price` stays in colones and `price-usd` shows dollars regardless. `tipo-de-cambio.spec.ts`: `price-usd` text «≈ $238 / noche» and its `title` with the rate.
- [ ] **Step 2: Run** `pnpm test tests/unit/currency-switch-ssr.test.tsx` and the four e2e specs — FAIL.
- [ ] **Step 3: Implement**; CSS `.cta-prices{display:grid;grid-template-columns:1fr auto;column-gap:12px;align-items:baseline}` with the right column `text-align:right`, `.price-disclaimer{text-align:center}`.
- [ ] **Step 4: Run** the tests again — PASS; `pnpm build && pnpm size` (initial ≤ 150 KB; contact sheet unchanged) and `pnpm lighthouse` (ficha < 2000 ms).
- [ ] **Step 5: Docs** decision bullet «Ficha sin «₡ | $»: la barra muestra colones y dólares (revierte el selector de la ficha de la navegación simple, 2026-10-27)»; `docs/diseno-v1.md` §3 ficha bar text.
- [ ] **Step 6: Commit** — «La barra de la ficha muestra colones y dólares y la ficha ya no lleva selector de moneda».

---

### Task 9: `MonthGrid` tall size, weekday row and the calendar colours

**Files:** Modify `src/shared/month-grid.tsx`, `src/styles/global.css`; Test `tests/unit/month-grid.test.tsx`; e2e text updates in `calendario.spec.ts` (l.140, 149, 250, 298, 304), `fase4.spec.ts` (l.138, 233), `ficha-calendario.spec.ts` (l.104, 156, 188): `"ocupado"` → `"Ocupado"`.

**Interfaces:**
```tsx
export interface MonthGridProps { /* …as today… */ size?: "compact" | "tall" } // default "compact"
// tall: class "month-grid is-tall", no weekday header (the screen renders <WeekdayRow/> once), price via cellPrice().
// compact: unchanged structure and figures (compactPrice, prices="special" on the ficha).
export function WeekdayRow({ className }: { className?: string }): JSX.Element; // the «L K M J V S D» row, aria-hidden
```
Busy cells in both sizes show «Ocupado» (capital O) in `.day-sub`; the aria-label keeps «…, ocupado». CSS: `.month-grid .day` background `var(--cal-free)`; `.is-busy{background:repeating-linear-gradient(135deg,var(--cal-busy) 0 7px,color-mix(in srgb,var(--cal-busy-ink) 12%,var(--cal-busy)) 7px 9px);color:var(--cal-busy-ink)}`; `.month-legend .swatch.is-busy` same; tall: `.month-grid.is-tall{flex:1;gap:3px}`, `.is-tall .month-week{flex:1;gap:3px}`, `.is-tall .day{height:auto;min-height:64px;align-items:flex-start;justify-content:space-between;padding:7px 4px 7px 7px;border-radius:14px}`, `.is-tall .day b{font-size:14px}`, `.is-tall .day-sub{font-size:10.5px;font-weight:600;align-self:center}`. The ficha keeps `.listing-calendar .day:not(.is-busy)` white.

- [ ] **Step 1: Failing unit tests** in `month-grid.test.tsx`: `renderToString(<MonthGrid size="tall" month="2026-12" today="2026-12-01" days={[{day:"2026-12-12",available:false,specialPriceCrc:null}]} base={95000} prices="all" onSelect={() => {}} label="Diciembre 2026" />)` contains `class="month-grid is-tall"`, does not contain `month-head`, cell 9 contains `₡95k`, cell 12 contains `>Ocupado<`; the compact render still contains `month-head` and `95k` without `₡`; `renderToString(<WeekdayRow />)` contains the seven letters `L K M J V S D` in order. Update the two existing `toContain("ocupado")` expectations to `">Ocupado<"`.
- [ ] **Step 2: Run** `pnpm test tests/unit/month-grid.test.tsx` — FAIL.
- [ ] **Step 3: Implement**; update the listed e2e strings.
- [ ] **Step 4: Run** `pnpm test`, `pnpm test:e2e ficha-calendario.spec.ts` — PASS; `pnpm build && pnpm size` — ficha calendar ≤ 4 KB, calendar ≤ 8 KB.
- [ ] **Step 5: Docs** `docs/diseno-v1.md` l.35 colours (libre `#DCE8DF`, ocupado `#F7E3D3` con texto `#9A4B2A`, rayas y «Ocupado»).
- [ ] **Step 6: Commit** — «Rejilla del mes alta con el precio dentro y los colores nuevos del calendario».

---

### Task 10: Calendario — months one under another, lazily mounted

**Files:** Modify `src/client/screens/calendario.tsx`, `src/styles/global.css`, `docs/diseno-v1.md` (l.35); Test `tests/e2e/calendario.spec.ts`, `tests/e2e/fase4.spec.ts` (l.85, 131: drop the «Mes siguiente» clicks; scroll the month into view instead).

**Interfaces:**
```tsx
function Calendar({ listing, userId, month }: { listing: Listing; userId: string; month: string | undefined }): JSX.Element; // no onMonth
function CalendarMonths(props: {
  months: string[];            // calendarMonths(today)
  target: string;              // valid ?mes= or openingMonth(today)
  render: (month: string) => JSX.Element; // the tall MonthGrid for that month
}): JSX.Element;
// Each month: <section class="cal-month-block" data-month="2026-12" aria-label="Diciembre 2026">
//   <h2 class="cal-month-title">Diciembre 2026</h2>{mounted.has(m) ? render(m) : <div class="cal-month-placeholder" aria-hidden="true"/>}</section>
// mounted: Set<string> initialised to {target, addMonths(target, 1)} ∩ months; one IntersectionObserver, rootMargin "100% 0px",
// adds a month when its block intersects; months are never unmounted. useLayoutEffect on mount scrolls the target block into view
// (block "start") only when target ≠ months[0].
```
CSS: `.cal-weekdays{position:sticky;top:calc(56px + env(safe-area-inset-top));z-index:3;background:var(--bg);padding:4px 0}`; `.cal-month-title{position:sticky;top:calc(56px + 26px + env(safe-area-inset-top));z-index:2;background:var(--bg);font-size:18px;font-weight:700;padding:6px 0}`; `.cal-month-block{display:flex;flex-direction:column;min-height:calc(100dvh - 56px - 26px - var(--nav-h) - env(safe-area-inset-top) - env(safe-area-inset-bottom));scroll-margin-top:calc(56px + 26px + env(safe-area-inset-top))}`; `.cal-month-placeholder{flex:1}`. Removed: the arrows row (`.cal-month` in the owner screen, `.cal-arrow` stays for the ficha), `onMonth`/URL rewriting on scroll. Kept: `HousePicker`, `.cal-house`, «Toque los días para editarlos» (small muted line under the close row slot), `MonthLegend` once above `WeekdayRow`, the sticky `Panel`, optimistic save. `?mes=` outside the window → `openingMonth(today)`.

- [ ] **Step 1: Failing e2e** in `calendario.spec.ts`:
  - Rewrite «ventana de un año…» as «meses en vertical: sin flechas, del mes actual al último de la ventana; un mes fuera de la ventana abre en el de apertura»: `open(page, casa.id, "2020-01")`; `getByRole("button",{name:/Mes (anterior|siguiente)/})` count 0; `.cal-month-block` count = `calendarMonths(today()).length`; first block `data-month` = current month, last = `addMonths(now, 12)` (or per `calendarMonths`); the opening month title `toBeInViewport()`; `.cal-month-block .month-grid` count ≤ 4 right after load; yesterday (if in the current month) disabled after scrolling the first block into view; a day beyond `today + 365` in the last month disabled after `scrollIntoViewIfNeeded()` on the last title.
  - New «un día en cada mes se elige y se guarda de una vez; ?mes= lleva a ese mes»: `open(page, casa.id, next())`; `page.getByRole("heading",{name: monthTitle(next())})` `toBeInViewport()` and not covered by `.cal-weekdays` (title box `y` ≥ weekdays box `y + height − 1`); tap `day(page, on(9))`; scroll `monthTitle(addMonths(next(),1))` into view; tap the 9th of that month; panel heading contains «2 noches»; «Ocupado» → «Guardar cambios»; `expect.poll(() => h.calendar("owner").days(casa.id))` contains both days with `available: false`; URL still `mes=<next()>` (scroll does not rewrite it).
  - New «días altos: casillas de 64 px o más y el mes llena la pantalla»: a day button box height ≥ 64; for the target block, `y + height` ≥ `.tabbar` box `y − 1`.
  - Update «puntos de entrada…» and the other tests that click «Mes anterior/Mes siguiente» to scroll the wanted month instead (helper `showMonth(page, month)` = `page.locator(`[data-month="${month}"]`).scrollIntoViewIfNeeded()`). Keep the «< 50 ms» save test green.
- [ ] **Step 2: Run** `pnpm test:e2e calendario.spec.ts` — FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `pnpm test:e2e calendario.spec.ts fase4.spec.ts ficha-calendario.spec.ts` — PASS; `pnpm build && pnpm size` — calendar ≤ 8 KB.
- [ ] **Step 5: Docs** `docs/diseno-v1.md` l.35: «meses uno debajo de otro (del actual al último de la ventana), título del mes fijo arriba, casillas altas (≥ 64 px) con «₡95k», un mes llena la pantalla; sin flechas; `?mes=` lleva a ese mes»; decision bullet.
- [ ] **Step 6: Commit** — «Calendario del propietario con los meses en vertical y días altos».

---

### Task 11: «Cerrar la casa hasta…» in Calendario; the switch leaves the detail

**Files:**
- Modify: `src/client/screens/calendario.tsx`, `src/client/close-sheet.tsx`, `src/client/screens/propietario.tsx`, `src/shared/icons.tsx`, `src/styles/global.css`, `.size-limit.json`, `src/domain/can.ts` (doc comment: «`available`: «Cerrar la casa hasta…» del Calendario»), `docs/decisiones.md`, `docs/diseno-v1.md` (l.37), `docs/pruebas-manuales-revision-ux.md`
- Test: `tests/e2e/no-disponible.spec.ts`, `tests/e2e/calendario.spec.ts` («casa cerrada…»), `tests/e2e/fase4.spec.ts` (l.190–235), `tests/e2e/app-instalada.spec.ts` (l.79–96), `tests/e2e/propietario.spec.ts` («disponible para consultas…»), `tests/e2e/estados-suscripcion.spec.ts` (l.201–202)

**Interfaces:**
```tsx
// calendario.tsx
const loadCloseSheet = () => import("../close-sheet");
const CloseSheet = lazy(() => loadCloseSheet().then((m) => ({ default: m.CloseSheet })));
/** Arriba del calendario de una casa activa (can(l,"available")). */
function CloseRow({ listing, userId }: { listing: Listing; userId: string }): JSX.Element;
// open:   <button type="button" class="card close-row" aria-haspopup="dialog">
//           <span class="close-row-icon"><I.lock size={20}/></span>
//           <span class="body"><b>Cerrar la casa hasta…</b><span class="small muted">Sale de Explorar y no recibe consultas</span></span><I.chevron/></button>
//         tap → open the sheet; whenIdle(() => void loadCloseSheet()) on mount; Suspense fallback = <div className="sheet-backdrop"/>.
// closed: <section class="card close-row is-closed"><span>{reopenAt ? `Cerrada hasta el ${shortDate(reopenAt)}` : "Cerrada: no aparece en Explorar ni recibe consultas"}</span>
//           <button class="btn btn-ghost btn-sm">Abrir la casa</button></section>
// confirm → useSetAvailable(userId, l).mutate({ available: false, reopenAt }); «Abrir la casa» → mutate({ available: true }).
// Focus returns to the row button after the sheet unmounts (same returnFocus pattern as the old Detail switch).

// icons.tsx
lock: (p: P) => <svg {...S(p)}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,

// close-sheet.tsx — same props and behaviour; copy: h2 «Cerrar la casa»; hint «No aparecerá en Explorar ni recibirá consultas. Sus noches y precios se conservan.»;
// label «Abrir de nuevo el (opcional)»; submit «Cerrar la casa»; «Cancelar». File comment: opened from Calendario, own lazy chunk.
```
Replaced in Calendario: the note «Esta casa está cerrada a consultas…» + «Abrir a consultas» (the grid stays dimmed while closed). Removed from `Detail`: the «Anuncio visible» list item, `CloseSheet`, `useSetAvailable`, `closing`/`toggle`/`returnFocus` state and the `longDate` import if unused. `.size-limit.json`: new entry `{ "name": "Hoja «Cerrar la casa» · trozo diferido (se pide al tocar «Cerrar la casa hasta…» o en reposo en el Calendario)", "path": ["dist/client/assets/close-sheet-*.js"], "limit": "1.5 KB", "gzip": true }` and `"!dist/client/assets/close-sheet-*.js"` in the initial entry.

- [ ] **Step 1: Failing e2e.**
  - `no-disponible.spec.ts`: helpers become `closeRow = page.getByRole("button",{name:/Cerrar la casa hasta…/})`, `sheet = page.getByRole("dialog",{name:"Cerrar la casa"})`; each test opens `/propietario/calendario?casa=<id>` instead of the detail. «cerrar con fecha…»: Escape closes the sheet and `closeRow` is focused (`toBeFocused()`); open again, fill «Abrir de nuevo el (opcional)» with `addDays(today(), 10)`, «Cerrar la casa» → row text `Cerrada hasta el ${shortDate(date)}`, `.month-grid.is-dimmed` visible, `h.anon.getPublic(publicId).available` polls `false`, the house is absent from `/explorar` results, the ficha shows «No disponible por ahora» with class `badge-mute`; the nightly reopen part unchanged. «cerrar sin fecha»: «Cerrada: no aparece en Explorar ni recibe consultas». «abrir a mano…»: «Abrir la casa» is one tap (optimistic), and the base-refusal rollback keeps its message. Last test (l.163): the detail of any house has `getByRole("switch")` count 0 and no text «Anuncio visible».
  - `calendario.spec.ts` «casa cerrada…»: expects `Cerrada hasta el ${shortDate(reopen)}` and «Abrir la casa» instead of the old note/button.
  - `fase4.spec.ts`, `app-instalada.spec.ts`, `propietario.spec.ts` («disponible para consultas…» → «cerrar la casa responde al instante desde el Calendario y vuelve atrás si la base se niega»), `estados-suscripcion.spec.ts` (l.201: «Cerrar la casa hasta…» visible in Calendario for an active house regardless of the subscription): same replacements. Offline write in `app-instalada` uses the Calendario row.
- [ ] **Step 2: Run** those specs — FAIL.
- [ ] **Step 3: Implement**; CSS `.close-row{display:flex;align-items:center;gap:12px;padding:10px 14px;text-align:left;width:100%}`, `.close-row-icon{width:40px;height:40px;border-radius:12px;background:var(--surface-2);color:var(--primary);display:inline-flex;align-items:center;justify-content:center}`, `.close-row .body{flex:1;display:flex;flex-direction:column}`, `.close-row.is-closed{justify-content:space-between}`.
- [ ] **Step 4: Run** the specs — PASS. `pnpm build && ls dist/client/assets | grep close-sheet` (must exist) and `pnpm size` — new entry ≤ 1.5 KB, calendar ≤ 8 KB, tabs ≤ 24.5 KB (should drop: `CloseSheet` left the propietario chunk).
- [ ] **Step 5: Docs.**
  - Decision bullet: «"Cerrar la casa hasta…" arriba del Calendario de cada casa activa (antes "Anuncio visible" en el detalle): misma función (`set_listing_available`), reapertura opcional; la hoja se llama "Cerrar la casa"».
  - `docs/diseno-v1.md` l.37: remove the switch from the detail; add the row to §13 Calendario.
  - `docs/pruebas-manuales-revision-ux.md`: new section «Ronda de Ana · densidad, tarjetas y calendario (2026-10-29)» with U59 margen de 16 px en todas las pestañas (iPhone y Android), U60 iconos de la barra de 26 px y pestaña activa `#B44C30`, U61 ficha: foto cuadrada bajo la muesca con los botones visibles y «1 / 5», U62 barra de la ficha con colones y dólares, U63 Mis casas con una sola casa: una tarjeta con «Activa» sobre la foto; tocarla abre el detalle, U64 borrador una sola vez con «Seguir publicando» y «Descartar», U65 Calendario: bajar entre meses con el dedo, elegir un día en dos meses y guardar, U66 «Cerrar la casa hasta…» con fecha → fuera de Explorar → «Abrir la casa».
- [ ] **Step 6: Commit** — «"Cerrar la casa hasta…" pasa al Calendario y el detalle deja el interruptor».

---

### Task 12: Final verification

**Files:** none (fix-ups only if a gate fails, each with its own commit).

- [ ] **Step 1:** `pnpm db:reset` (repo root), then from `apps/app`: `pnpm typecheck` — PASS.
- [ ] **Step 2:** `pnpm test` — PASS (includes `ocre.test.ts`, `contrast.test.ts`, architecture test).
- [ ] **Step 3:** `pnpm test:db` — PASS (no schema change expected; confirms the contract suites).
- [ ] **Step 4:** `pnpm build && pnpm size` — every entry green; record final numbers (initial, tabs, calendar, ficha calendar, actividad, «Hoja "Cerrar la casa"») in the ledger for plan A's pre-flight.
- [ ] **Step 5:** Full e2e: `VITE_WA_GUESTS="+506 6000 0000" CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e` — PASS (one worker). Grep the run for hydration warnings: none.
- [ ] **Step 6:** `pnpm lighthouse` — ficha cold LCP < 2000 ms, installed shell < 2500 ms.
- [ ] **Step 7:** From the repo root `pnpm test:prototype` — PASS (the prototype is untouched; this guards it).
- [ ] **Step 8:** Spec coverage check against `spec.md`: §1 (Task 3), §2 (Task 7), §3 (Tasks 1, 5), §4 (Task 4), §5 (Task 6), §6 (Tasks 2, 9, 10, 11), Data/tokens (Task 3), Accessibility (Tasks 3, 8, 9), Documentation (Tasks 3–11). `git status` clean except the pre-existing untracked files. No push.

---

## Decisions taken while planning (spec ambiguities)

- Calendar price in the tall cell: «₡95k» (spec, `compactPrice` + ₡) instead of the mockup's «₡42 000», so six-digit prices fit at 375 px.
- `cardLabel` drops the `billing?` parameter of the spec's sketch: «Pendiente de pago» and «Inactiva» come from `listing.status`; the edit state is a plain `EditState` that plan D fills.
- An active house inside the 90-day window shows no pay button on its card (the top `PayNotice` covers it), keeping one filled button per card; `payment_due` shows «Añadir método de pago», `inactive` shows «Activar suscripción» (both ocre).
- The subscription lines that leave the card (`card-line`) stay visible in the house detail (`subscription-row`); their e2e assertions move there.
- The hero photo goes edge to edge behind the notch; only the overlay buttons respect the safe area.
- The close row takes the mockup's look (card row with a lock, subtitle «Sale de Explorar y no recibe consultas», chevron) while keeping the spec's function and copy; «Abrir la casa» is an outline button.
- The owner calendar keeps «Toque los días para editarlos» and the legend once at the top; a single sticky weekday row (mockup) replaces the per-month header.
- Actividad figures keep their current words («toques en WhatsApp»).
- `CloseSheet` becomes a lazy chunk with its own size entry from the start (calendar chunk is at 6.93/8 KB).
