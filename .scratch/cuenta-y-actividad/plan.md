# Suscripción por casa, Cuenta más clara y Actividad con la casa de cada consulta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** «Suscripción» opened from a house shows only that house (`/propietario/suscripcion?casa=CT-####`), «Activar suscripción» and the missing «Método de pago» are ocre, Cuenta gets the identity line and a confirmed «Cerrar sesión» at the very end, and every Actividad inquiry carries its house, with chips by house when there are two or more published houses.

**Architecture:** No database change. Pure rules go in new domain modules that land only in the chunk that uses them (`domain/subscription-scope.ts` → `suscripcion-*`, `domain/inquiry-filter.ts` → `actividad-*`), so the tight «Pantallas de las pestañas» and «Hoja de contacto» budgets do not grow; route search validators move to `client/owner-search.ts` (initial JS, unit-testable). The modal sheet of `suscripcion.tsx` becomes `client/confirm-sheet.tsx`, a shared deferred chunk with its own size-limit entry, used by Suscripción and Cuenta.

**Tech Stack:** Vite + React 19, TanStack Router + Query (persisted in IndexedDB), TypeScript strict, Supabase Postgres (unchanged), Vitest (unit), Playwright (Pixel 7, one worker), size-limit, Lighthouse.

**Spec:** `.scratch/cuenta-y-actividad/spec.md`

Conventions for every task: `pnpm …` runs from `apps/app`; `git` from the repo root. E2E runs against `vite preview`: every e2e step is `pnpm build && VITE_WA_GUESTS="+506 6000 0000" CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e <spec> --workers=1` with `pnpm db:start` running (from the repo root: `pnpm db:reset` once at the start; no new migration in this plan).

## Global Constraints

- UI copy in Spanish de Costa Rica, treating the user as **usted**; no voseo or tuteo.
- Exact strings (verbatim): «Suscripción» (scoped header), «Promoción y suscripción» (unscoped header, unchanged), «Ver todas sus casas», «Activar suscripción», «Añadir método de pago», «Parar suscripción», «Cambiar», «Método de pago», «Falta · añádalo antes de que termine su oferta», «Pronto podrá verificar también su identidad (opcional).», «Cerrar sesión», «¿Cerrar sesión?», «Tendrá que recibir un código nuevo para volver a entrar.», «Cancelar», «Términos y privacidad», «Todas», «Todavía no hay consultas de esta casa.», «Últimas consultas», group name «Filtrar por casa».
- No `style={…}` in JSX, no `dangerouslySetInnerHTML`, no `innerHTML`/`eval` (enforced by `tests/unit/architecture.test.ts`).
- CSP strict: `script-src 'self'`, no inline scripts or styles, no third parties in the private zone.
- `src/domain/*` imports no framework (only `zod` and its own modules); PostgREST strings only in `src/data/postgrest/*` (this plan touches neither adapter).
- size-limit: Suscripción **7 KB**, Actividad **4 KB**, Pantallas de las pestañas **24.5 KB**, Hoja de contacto **5.5 KB**, Zona privada JS inicial **150 KB**. **Never raise an existing limit; a new deferred chunk gets its own new size-limit entry** (and its exclusion in the initial-JS entry).
- Migrations (none expected here): `pnpm exec supabase migration new <name> < /dev/null` from the repo root, then `pnpm db:types`; new tables/RPCs get policies + contract/db tests before screens; any `UPDATE listings` in a migration needs `select set_config('app.allow_status','on',true)`.
- Veriff stays out of v1: the identity line of Cuenta is the **only** identity text anywhere in the app.
- Ocre (`btn-sun`, `card-sun`, `note-sun`, `badge-sun`, new `list-item-sun`) only for money and payment notices (B's rule and allowlist test).
- Commits in Spanish, imperative, **without** any co-author line. One commit per step with tests green. Do not push.
- Test first: write the failing test, run it and see it fail, then the code.
- Playwright: mobile viewport (Pixel 7 from `playwright.config.ts`), one worker, `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`, `VITE_WA_GUESTS="+506 6000 0000"` at build time. CI is Linux headless Chromium: any touch gesture goes through `tests/e2e/helpers/touch.ts` (none is needed here).
- Do not access pruebas.bnbtico.com or bnbtico.com from any tool. Prototype (`design/prototype/`) is not changed; `pnpm test:prototype` (repo root) must still pass.

## Review Focus

1. **`?casa=` dropped too early from a stale persisted cache.** A house approved minutes ago is not in the IndexedDB copy of `owner_billing`; dropping `casa` before the refetch lands would show all houses to an owner who came from that house. `scopeFix` only returns a replacement when the billing data is *settled* (`!isFetching`). Tests: unit `scopeFix` table (Task 2: `settled: false` → `null`); e2e (Task 4) «casa desconocida» seeds a fresh house, primes the cache without it, opens `?casa=` and expects the URL to keep `casa` and show only that house.
2. **Return from the payment page loses the scope or the hash.** `useSavingMethod` used to navigate with `search: {}`; now one effect computes the replacement with `scopeFix`. Tests: unit `setupReturnUrls` (Task 1) pins `…/propietario/suscripcion?pago=ok&casa=CT-1042#pago=CT-1042` and cancel `…?casa=CT-1042#pago=CT-1042`; e2e (Task 4) fake-gateway round trip from the scoped screen ends at `?casa=CT-…#pago=CT-…` (no `pago=ok`), only that house shown, «Método de pago guardado…» visible.
3. **«Cerrar sesión» still signs out on one tap, or the sheet leaves the page `inert`.** Tests (Task 6): e2e «Cancelar» keeps the session (account card still visible after reload), Escape and the backdrop close the sheet and focus returns to the «Cerrar sesión» button; confirming signs out and `localStorage['bnbtico-auth']` is null; after cancel the account card «Editar» link is clickable (would fail if `#root` stayed `inert`).
4. **Filter applied after taking the 20 most recent.** A quiet house would show nothing although it has inquiries. Tests: unit `filterInquiries` (Task 7) with 25 inquiries of house A newer than 3 of house B: `filterInquiries(list, B).slice(0, 20)` has length 3; e2e (Task 8) seeds 21 inquiries for «Casa Cocles» after 1 for «Cabina Punta Uva» and the Cabina chip shows exactly 1 card.
5. **Budget overflow of the tab screens (24.46 KB before this round) by the Cuenta changes or by a duplicated sheet.** Tests (Task 6 step 5): `pnpm size` green; `ls dist/client/assets | grep -c '^confirm-sheet-'` is `1`; `grep -l "Tendrá que recibir un código nuevo" dist/client/assets/*.js` names only `cuenta-*.js` (the copy) and the sheet's chrome lives once in `confirm-sheet-*.js`. If Cuenta still does not fit, the pinned fallback (lazy `ProfileForm`, Task 6 step 6) is applied, never a raised limit.

## File Structure

Created:
- `apps/app/src/domain/subscription-scope.ts` — `scopeBilling`, `scopeFix`; imported only by `suscripcion.tsx` (lands in `suscripcion-*`).
- `apps/app/src/domain/inquiry-filter.ts` — `filterInquiries`, `inquiryChips`, `CHIP_MAX`; imported only by `actividad.tsx` (lands in `actividad-*`, keeps `inquiry-*` of the contact sheet unchanged).
- `apps/app/src/client/owner-search.ts` — `calendarioSearch` (moved from `shell.tsx`), `suscripcionSearch`, `actividadSearch`, `UUID`.
- `apps/app/src/client/confirm-sheet.tsx` — `ConfirmSheet` (extracted from `suscripcion.tsx`, generalised, restores focus).
- `apps/app/tests/unit/subscription-scope.test.ts`, `apps/app/tests/unit/owner-search.test.ts`, `apps/app/tests/unit/inquiry-filter.test.ts`.
- `apps/app/tests/e2e/cuenta-y-actividad.spec.ts` — the seven Playwright flows of the spec.

Modified:
- `apps/app/src/domain/payments.ts` (`setupReturnUrls`), `apps/app/src/domain/inquiry.ts` (`inquirySummary`).
- `apps/app/src/client/shell.tsx` (imports the validators; `/propietario/actividad` gets `validateSearch`).
- `apps/app/src/client/screens/suscripcion.tsx` (scope, «Activar suscripción», `PayButton` scope, Cuenta card and row).
- `apps/app/src/client/screens/propietario.tsx` (`SubscriptionLink` adds `?casa=`).
- `apps/app/src/client/screens/cuenta.tsx` (identity line, «Cerrar sesión» at the end with the sheet).
- `apps/app/src/client/screens/actividad.tsx` (house tag, chips, filter).
- `apps/app/src/styles/global.css` (`.list-item-sun`, `.sub-scope`, `.inquiry-house*`, `.account-foot`, `.logout-link`).
- `apps/app/.size-limit.json` (new «Hoja de confirmación» entry + exclusion in the initial-JS entry).
- `apps/app/tests/unit/billing-worker.test.ts`, `tests/unit/inquiry.test.ts`, B's ocre allowlist test (name recorded in Task 0).
- `apps/app/tests/e2e/helpers/session.ts` (`signOut`), `tests/e2e/cuenta.spec.ts`, `suscripcion.spec.ts`, `fase5.spec.ts`, `estados-suscripcion.spec.ts`, `navegacion.spec.ts`, `fase3.spec.ts`, `favoritos.spec.ts` (only if it clicks «Cerrar sesión»).
- Docs: `docs/decisiones.md`, `docs/diseno-v1.md`, `CLAUDE.md`, `docs/configuracion-supabase.md`, the round's manual-test document (Task 0 decides which).

---

## Task 0: Pre-flight (records only, changes nothing)

**Files:** none modified. Write the answers into the task tracker / the executing agent's notes; later tasks reference them as **P0.n**.

- [ ] **P0.1 Earlier plans landed.** `git log --oneline -40` and confirm the commits of densidad-y-tarjetas (B+C), explorar-airbnb (A), editar-casa (D) and publicar-v2 (E). If one is missing, stop and report: this plan assumes B's ocre allowlist test and `HouseCardTop`, and D's subscription block.
- [ ] **P0.2 Sizes.** `pnpm build && pnpm size` and record the current gz size and margin of: «Pantallas de las pestañas» (24.5 KB), «Promoción y suscripción» (7 KB), «Actividad» (4 KB), «Hoja de contacto» (5.5 KB), «Zona privada · JS inicial» (150 KB). Record the exact entry names (B may have added entries, e.g. `house-card-*`). If the tab screens margin is < 0.35 KB, plan to apply Task 6 step 6 (lazy `ProfileForm`) up front.
- [ ] **P0.3 Ocre allowlist test.** `grep -rln "btn-sun" tests/unit` → record the file (expected something like `tests/unit/ocre.test.ts`), the shape of its allowlist (by file or by component name) and the scanned class pattern. Task 5 adds `list-item-sun` to the pattern and the Cuenta payment row / subscription card to the allowlist if not already covered by «suscripción».
- [ ] **P0.4 Subscription entry points after B and D.** In `src/client/screens/propietario.tsx` (and any new file of D, e.g. `casa-editable.tsx`) grep `SubscriptionLink\|suscripcion\|Activar suscripción\|Reactivar`. Record: every component that links to `/propietario/suscripcion`, whether they all go through `SubscriptionLink`, and the current label of the inactive action (B and D: «Activar suscripción»). Task 4 changes only `SubscriptionLink` (and any direct `<Link to="/propietario/suscripcion">` found here that comes from a house).
- [ ] **P0.5 Actividad after B.** Read `src/client/screens/actividad.tsx`: record the name of the house-card component (`HouseCardTop` from `client/house-card.tsx`), whether `SingleActivity` still exists, and the class / testid used by the cards (navegacion.spec «7b» may now use a new locator). Task 8 does not touch the figures cards.
- [ ] **P0.6 Tests touching «Reactivar», «Cerrar sesión» and the summary line.** `grep -rn "Reactivar\|Cerrar sesión\|Casa Cocles · \|TITLE} · \|Ninguno todavía · tarjeta" tests/e2e` and record each line (expected before B/D: `suscripcion.spec.ts` 111/160/167/188, `fase5.spec.ts` 273/281, `estados-suscripcion.spec.ts` 150–151, `cuenta.spec.ts` 92/113/162/221, `navegacion.spec.ts` 108/191, `fase3.spec.ts` 175, `suscripcion.spec.ts` 287). B/D may already have renamed «Reactivar» in Mis casas.
- [ ] **P0.7 Manual-test document of the round.** `ls docs/pruebas-manuales-*` and `git log --oneline -- docs/pruebas-manuales-*`: if an earlier plan of this round created a document (e.g. `docs/pruebas-manuales-ronda-ana.md`), Task 9 appends a section there; otherwise Task 9 appends section «E. Ronda de Ana · Suscripción, Cuenta y Actividad» to `docs/pruebas-manuales-mejoras-2026-10-27.md` with rows numbered after the last `M` row. Record the next free row number.
- [ ] **P0.8 Latest decision date.** `head -5 docs/decisiones.md`: earlier plans add 2026-10-29 entries; Task 9 puts this entry at the very top, dated 2026-10-29.
- [ ] **P0.9 Baseline.** `pnpm typecheck && pnpm test` green before starting; record any pre-existing red test (not to be fixed here unless this plan breaks it).

---

## Task 1: Return URLs of the payment page keep the house scope

**Files:** `apps/app/src/domain/payments.ts`, `apps/app/tests/unit/billing-worker.test.ts`, new cases in `apps/app/tests/unit/subscription-scope.test.ts` (created here).

**Interfaces:**
```ts
// domain/payments.ts (signature unchanged, behaviour extended)
export function setupReturnUrls(base: string, publicId: string | null): { successUrl: string; cancelUrl: string };
// with publicId: success `${path}?pago=ok&casa=${publicId}#pago=${publicId}`, cancel `${path}?casa=${publicId}#pago=${publicId}`
// without:       success `${path}?pago=ok`,                              cancel `${path}`
```
The worker (`src/server/billing.ts`) already validates `publicId` (`^CT-\d{4,}$`) before calling it; no server change.

- [ ] **Step 1: Failing test.** In `tests/unit/subscription-scope.test.ts`:
  ```ts
  describe("setupReturnUrls", () => {
    it("con casa: ?pago=ok&casa= y el hash; cancelar sin pago=ok", () => {
      expect(setupReturnUrls("https://bnbtico.com/", "CT-1042")).toEqual({
        successUrl: "https://bnbtico.com/propietario/suscripcion?pago=ok&casa=CT-1042#pago=CT-1042",
        cancelUrl: "https://bnbtico.com/propietario/suscripcion?casa=CT-1042#pago=CT-1042",
      });
    });
    it("sin casa: como hasta ahora", () => {
      expect(setupReturnUrls("https://bnbtico.com", null)).toEqual({ successUrl: "https://bnbtico.com/propietario/suscripcion?pago=ok", cancelUrl: "https://bnbtico.com/propietario/suscripcion" });
    });
  });
  ```
  Update `tests/unit/billing-worker.test.ts` lines that pin `?pago=ok#pago=…` (l.87, l.188, l.377) to `?pago=ok&casa=${id}#pago=${id}`; l.201 (no house) stays.
- [ ] **Step 2: Run** `pnpm test tests/unit/subscription-scope.test.ts tests/unit/billing-worker.test.ts` → FAIL (casa missing).
- [ ] **Step 3: Implement** in `setupReturnUrls`: `const q = publicId ? \`casa=${publicId}\` : ""`; success `?pago=ok${q ? "&" + q : ""}${hash}`, cancel `${q ? "?" + q : ""}${hash}`. Update its doc comment.
- [ ] **Step 4: Run** the same command → PASS; `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `apps/app/src/domain/payments.ts apps/app/tests/unit/subscription-scope.test.ts apps/app/tests/unit/billing-worker.test.ts` — «Vuelve de la pasarela a la suscripción de la misma casa (?casa=)».

## Task 2: Scope rules and search validators

**Files:** create `apps/app/src/domain/subscription-scope.ts`, `apps/app/src/client/owner-search.ts`, `apps/app/tests/unit/owner-search.test.ts`; extend `tests/unit/subscription-scope.test.ts`; modify `apps/app/src/client/shell.tsx`.

**Interfaces:**
```ts
// domain/subscription-scope.ts — no framework imports
export function scopeBilling<T extends { house: { publicId: string } }>(houses: readonly T[], casa: string | undefined):
  { scoped: T | null; all: readonly T[]; unknown: boolean };   // unknown = casa given and not among houses
export interface SuscripcionSearch { pago?: "ok"; casa?: string }
/** The search the URL must be replaced with, or null if it is already right. Drops `pago=ok` always; drops `casa` only
 *  when it is unknown AND the billing data is settled (not fetching). */
export function scopeFix(search: SuscripcionSearch, s: { unknown: boolean; settled: boolean }): { casa?: string } | null;

// client/owner-search.ts — pure, imported by shell.tsx (initial JS)
export const UUID: RegExp;                                   // moved from shell.tsx
export const PUBLIC_ID = /^CT-\d{4,}$/;
export function calendarioSearch(p: Record<string, unknown>): { casa?: string; mes?: string };   // moved verbatim
export function suscripcionSearch(p: Record<string, unknown>): SuscripcionSearch;               // pago=ok and/or casa
export function actividadSearch(p: Record<string, unknown>): { casa?: string };                 // casa = listing uuid
```

- [ ] **Step 1: Failing tests.**
  - `subscription-scope.test.ts` → `scopeBilling`: with `houses = [{house:{publicId:"CT-1001"}},{house:{publicId:"CT-1002"}}]`: `scopeBilling(houses,"CT-1002")` → `{ scoped: houses[1], all: houses, unknown: false }`; `scopeBilling(houses, undefined)` → `{ scoped: null, unknown: false }`; `scopeBilling(houses,"CT-9999")` (another owner's id — `owner_billing` only returns own houses) → `{ scoped: null, unknown: true }`; `scopeBilling([], "CT-1001").unknown` → `true`.
  - `scopeFix`: `({}, {unknown:false, settled:true})` → `null`; `({pago:"ok"}, …)` → `{}`; `({pago:"ok", casa:"CT-1001"}, {unknown:false, settled:true})` → `{ casa: "CT-1001" }`; `({casa:"CT-9999"}, {unknown:true, settled:true})` → `{}`; `({casa:"CT-9999"}, {unknown:true, settled:false})` → `null`; `({pago:"ok", casa:"CT-9999"}, {unknown:true, settled:false})` → `{ casa: "CT-9999" }`.
  - `owner-search.test.ts`: `suscripcionSearch({ pago: "ok", casa: "CT-1042" })` → `{ pago: "ok", casa: "CT-1042" }`; `({ casa: "CT-104" })`, `({ casa: "ct-1042" })`, `({ casa: "CT-1042 " })`, `({ casa: 1042 })`, `({ pago: "si" })` → `{}`; `({ casa: "CT-10420" })` → `{ casa: "CT-10420" }`. `actividadSearch({ casa: "6f1c2b9e-1d2a-4c3b-9a8e-0f1e2d3c4b5a" })` keeps it; `({ casa: "CT-1042" })`, `({ casa: "x" })`, `({})` → `{}`. `calendarioSearch` keeps today's cases (copy the two lines of behaviour: uuid casa, `mes` `YYYY-MM` with month 01–12; `"2026-13"` dropped).
- [ ] **Step 2: Run** `pnpm test tests/unit/subscription-scope.test.ts tests/unit/owner-search.test.ts` → FAIL (modules missing).
- [ ] **Step 3: Implement** both modules; in `shell.tsx` delete the local `UUID`, `calendarioSearch`, `suscripcionSearch`, import them from `./owner-search`, and give `/propietario/actividad` `validateSearch: actividadSearch`.
- [ ] **Step 4: Run** the two test files + `pnpm test tests/unit/architecture.test.ts` + `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** the five files — «Añade las reglas del alcance por casa y los parámetros casa= de Suscripción y Actividad».

## Task 3: Shared confirmation sheet

**Files:** create `apps/app/src/client/confirm-sheet.tsx`; modify `apps/app/src/client/screens/suscripcion.tsx`, `apps/app/tests/e2e/suscripcion.spec.ts`.

**Interfaces:**
```tsx
export function ConfirmSheet(props: {
  title: string;            // h2
  body: ReactNode;          // p (aria-describedby)
  confirmLabel: string;
  confirmClassName: string; // e.g. "btn btn-primary btn-lg" (Parar) or "btn btn-ghost btn-lg" (Cerrar sesión)
  cancelClassName: string;  // e.g. "btn btn-ghost btn-lg" (Parar) or "btn-link muted center" (Cerrar sesión)
  onConfirm(): void;
  onClose(): void;
}): ReactPortal;
```
Same behaviour as today's `ConfirmSheet` (portal to `document.body`, `#root` `inert`, `html.sheet-open`, focus trap over the two buttons, Escape and backdrop call `onClose`), plus: on mount it stores `document.activeElement` and on unmount, after clearing `inert`, focuses it again (`preventScroll: true`). Ids via `useId()` (no fixed `stop-title`).

This is a behaviour-preserving refactor: the existing e2e «parar con confirmación y reactivar…» is the test. With only Suscripción importing it, Rollup keeps the module inside `suscripcion-*`; the shared chunk `confirm-sheet-*` appears when Cuenta imports it (Task 6), and its size-limit entry is added there.

- [ ] **Step 1: Test first (red by construction).** Add to `suscripcion.spec.ts` «parar con confirmación…», after «Cancelar»: `await expect(a.getByRole("button", { name: "Parar suscripción" })).toBeFocused();` (focus returns to the opener — today's sheet does not restore it). Run `… pnpm test:e2e suscripcion.spec.ts -g "parar con confirmación"` → FAIL on `toBeFocused`.
- [ ] **Step 2: Implement** `confirm-sheet.tsx`; `suscripcion.tsx` imports it and its `HouseCard` passes `title="Parar suscripción"`, `body={\`¿Parar la suscripción de ${house.title || "esta casa"}? La casa deja de verse y no se cobra. Puede reactivarla cuando quiera.\`}`, `confirmLabel="Parar suscripción"`, `confirmClassName="btn btn-primary btn-lg"`, `cancelClassName="btn btn-ghost btn-lg"`. Delete the local copy.
- [ ] **Step 3: Run** the same e2e → PASS (dialog text unchanged); `pnpm build && pnpm size` → «Promoción y suscripción» ≤ 7 KB.
- [ ] **Step 4: Commit** `apps/app/src/client/confirm-sheet.tsx apps/app/src/client/screens/suscripcion.tsx apps/app/tests/e2e/suscripcion.spec.ts` — «Saca la hoja de confirmación a su propio módulo y devuelve el foco al cerrarla».

## Task 4: Suscripción scoped to one house, «Activar suscripción» in ocre

**Files:** modify `apps/app/src/client/screens/suscripcion.tsx`, `apps/app/src/client/screens/propietario.tsx` (and D's file from P0.4), `apps/app/src/styles/global.css`; create `apps/app/tests/e2e/cuenta-y-actividad.spec.ts`; update `tests/e2e/suscripcion.spec.ts`, `fase5.spec.ts`, `estados-suscripcion.spec.ts` (lines from P0.6).

**Interfaces / pinned behaviour:**
- `SubscriptionLink({ publicId, className, children })` (propietario.tsx): with `publicId` → `<Link to="/propietario/suscripcion" search={{ casa: publicId }} hash={\`pago=${publicId}\`}>`; without → as today. Every house entry point from P0.4 uses it: Mis casas «Añadir método de pago» / «Activar suscripción», D's top block, D's «Suscripción» row.
- `SuscripcionScreen`: `const search = route.useSearch()`; `const scope = indexed ? scopeBilling(indexed.all, search.casa) : null`; `settled = !!indexed && !billing.isFetching`; one effect: `const fix = scopeFix(search, { unknown: !!scope?.unknown, settled }); if (fix) navigate({ to: "/propietario/suscripcion", search: fix, hash, replace: true })` — `useSavingMethod` no longer navigates (it only reads `search.pago` for its initial state and polls).
- Scoped (`scope.scoped`): `FlowHeader title="Suscripción"` (also while `search.casa` is set and billing is pending, to avoid a title flip), then `<p className="small muted sub-scope" data-testid="sub-scope">{title || "Casa sin título"}</p>`; one `HouseCard` (no `<section>` «Sus casas» heading; the card inside a `section.card`); the «Método de pago» card with `due = payButtonDue(scoped.sub, today)` and its `PayButton publicId={scoped.house.publicId}` (also «Cambiar»); «Cómo funciona»; **no** `TiersCard`; if `indexed.all.length >= 2`, `<Link to="/propietario/suscripcion" className="link small center">Ver todas sus casas</Link>` at the bottom.
- Unscoped: today's screen; `target` from `#pago=` as today. With both `casa` and the hash, `casa` scopes and the hash highlights.
- `HouseCard` inactive: `<button className="btn btn-sun btn-block">Activar suscripción</button>`, same `onAction(); change.mutate("resume")`.
- CSS: `.sub-scope{margin:-8px 0 4px}` (under the flow header). `.center` already exists? If not, `.link.center{align-self:center}`.

- [ ] **Step 1: Failing e2e** in `cuenta-y-actividad.spec.ts` (same harness as `suscripcion.spec.ts`: `postgrestHarness`, `h.reset()` in `beforeEach`, `injectSession(page, "owner")`, `fresh(page, path)` helper copied):
  - **Flujo 1** «desde la fila Suscripción de una casa, solo esa casa y Método de pago; «Ver todas sus casas» muestra las dos»: seed `Casa Cocles` and `Cabina Punta Uva` active; open the house detail `/propietario/casas/${cocles.id}`, tap the subscription row/link (locator from P0.4: `getByRole("link", { name: /Suscripción/ })`); expect URL `/propietario/suscripcion?casa=${cocles.publicId}#pago=${cocles.publicId}`; `getByRole("heading", { level: 1, name: "Suscripción" })`; `getByTestId("sub-scope")` has text «Casa Cocles»; `page.locator("[data-house]")` count 1 with `data-house=cocles.publicId`; `getByTestId("method-card")` visible; `getByTestId("tiers-card")` count 0; `getByTestId("how-it-works")` visible; tap «Ver todas sus casas» → URL `/propietario/suscripcion` (no search), heading «Promoción y suscripción», `[data-house]` count 2.
  - **Flujo 2** «una casa parada: «Activar suscripción» en ocre y la reactiva»: seed active, `h.billing("owner").stop(id)`; `fresh(page, \`/propietario/suscripcion?casa=${publicId}\`)`; button «Activar suscripción» `toHaveClass(/btn-sun/)`; `getByRole("button", { name: "Reactivar" })` count 0; click → «Activa» badge visible and `expect.poll(statusOf)` → `"active"`.
  - **Flujo 3** «el enlace de un aviso #pago=CT-… sigue resaltando la casa»: seed two active, `h.setDaysLeft(a.id, 7)`; `goto(\`/propietario/suscripcion#pago=${a.publicId}\`)` → heading «Promoción y suscripción», the card of A `toHaveClass(/is-target/)` and focused, `[data-house]` count 2.
  - «casa desconocida u otra: todas las casas y la URL sin casa»: `goto("/propietario/suscripcion?casa=CT-9999")` → `expect(page).toHaveURL(/\/propietario\/suscripcion$/)`, `[data-house]` count 2.
  - «caché vieja sin la casa nueva: espera a la base antes de quitar casa» (Review Focus 1): seed A, open `/propietario/suscripcion` (cache has A), `page.waitForTimeout(1500)` (IndexedDB flush), seed B active, `goto(\`/propietario/suscripcion?casa=${b.publicId}\`)` → URL keeps `casa=${b.publicId}`, `[data-house]` count 1 with B.
  - «ida y vuelta por la pasarela falsa desde la casa» (Review Focus 2): seed active, `expire(id)`; `goto(?casa=)`; click the house's «Añadir método de pago» → `_pago-falso` → «Guardar tarjeta de prueba» → URL `/propietario/suscripcion?casa=${publicId}#pago=${publicId}`; status «Método de pago guardado. No se cobra nada hasta que termine la oferta.»; `[data-house]` count 1; `method-card` contains «Visa ···· 4242».
- [ ] **Step 2: Run** `… pnpm test:e2e cuenta-y-actividad.spec.ts -g "Flujo 1|Flujo 2|Flujo 3|desconocida|caché vieja|pasarela"` → FAIL.
- [ ] **Step 3: Implement** as pinned above.
- [ ] **Step 4: Update older e2e** (P0.6): `suscripcion.spec.ts` «Reactivar» → «Activar suscripción» with `toHaveClass(/btn-sun/)` (was `/btn-primary/` at l.111); «ida y vuelta por la pasarela falsa» now expects `${SCREEN}?casa=${casa.publicId}#pago=${casa.publicId}$` (the house's button scopes the return — resolved ambiguity 1) and still both house and method; «vuelta con ?pago=ok» unchanged (no casa); `fase5.spec.ts` l.273/281 «Reactivar» → «Activar suscripción»; `estados-suscripcion.spec.ts` l.150–151: href now `/propietario/suscripcion?casa=${parada.publicId}#pago=${parada.publicId}` and class per B (ocre `btn-sun`).
- [ ] **Step 5: Run** `… pnpm test:e2e cuenta-y-actividad.spec.ts suscripcion.spec.ts estados-suscripcion.spec.ts fase5.spec.ts pago-falso.spec.ts` → PASS; `pnpm size` → «Promoción y suscripción» ≤ 7 KB.
- [ ] **Step 6: Commit** the modified sources, CSS and specs — «Suscripción de una sola casa con ?casa= y «Activar suscripción» en ocre».

## Task 5: Ocre «Método de pago» row and subscription lines of Cuenta

**Files:** modify `apps/app/src/client/screens/suscripcion.tsx` (`CuentaPaymentRow`, `CuentaSubscriptionCard`), `apps/app/src/styles/global.css`, B's allowlist test (P0.3); extend `tests/e2e/cuenta-y-actividad.spec.ts`; update `tests/e2e/suscripcion.spec.ts` «Cuenta del propietario».

**Pinned behaviour:**
- `CuentaPaymentRow`: no method → `className="list-item list-item-sun"`, `data-testid="payment-row"`, small line «Falta · añádalo antes de que termine su oferta»; with method → `list-item`, small line `Visa ···· 4242 · vence 12/30` (as today). Link stays `/propietario/suscripcion` (unscoped).
- CSS: `.list-item-sun{background:var(--sun-soft);color:var(--sun-ink)} .list-item-sun .body small,.list-item-sun .chev,.list-item-sun .primary{color:var(--sun-ink)}`.
- `CuentaSubscriptionCard`: rows with a subscription become `<Link to="/propietario/suscripcion" search={{ casa: publicId }} className="row between gap-8 baseline sub-row-link" data-testid="sub-row">`; review rows (no subscription, not in `owner_billing`) stay a `div` without link. For `payment_due` and `inactive`: title in `sun-ink strong` and the right side `<span className="badge badge-sun">{STATUS_LABELS[status].label}</span>` («Pendiente de pago» / «Inactiva»); `data-ocre="1"` on the row for the test. Others unchanged.
- Allowlist test: add `list-item-sun` (and `badge-sun` only if B's test scans it) to the scanned pattern; the two Cuenta components live in `suscripcion.tsx`, already allowlisted (P0.3); if the allowlist is by component name, add `CuentaPaymentRow` and `CuentaSubscriptionCard`.

- [ ] **Step 1: Failing tests.**
  - Unit (allowlist test): add a fixture assertion that a `list-item-sun` outside the allowlist would be reported (same style as B's cases), then run → FAIL (pattern does not include it).
  - e2e **Flujo 4** «Cuenta sin método de pago: la fila en ocre; con método, no»: seed active A, `expire(A)` (payment_due), seed active B, seed review C; open Cuenta via `ownerCuenta(page)`; `getByTestId("payment-row")` `toHaveClass(/list-item-sun/)` and contains «Falta · añádalo antes de que termine su oferta»; the A row `[data-ocre="1"]` with text «Pendiente de pago»; B row without `data-ocre`; B row link `href` = `/propietario/suscripcion?casa=${b.publicId}`; C row has no link (`getByTestId("sub-row").filter({hasText: "Cabina Punta Uva"}).locator("a")` count 0 and it is a `div`); tap the B row → URL `?casa=${b.publicId}` and `[data-house]` count 1. Then `addCard()`, `fresh(page, "/cuenta")` → payment row not `/list-item-sun/`, contains «Visa ···· 4242».
- [ ] **Step 2: Run** `pnpm test <allowlist file>` and `… pnpm test:e2e cuenta-y-actividad.spec.ts -g "Flujo 4"` → FAIL.
- [ ] **Step 3: Implement.** Update `suscripcion.spec.ts` «Cuenta del propietario…» (l.287: «Ninguno todavía · tarjeta» → «Falta · añádalo antes de que termine su oferta»; rows still match `toHaveText([...])`).
- [ ] **Step 4: Run** unit + `cuenta-y-actividad.spec.ts -g "Flujo 4"` + `suscripcion.spec.ts` → PASS; `pnpm size` → Suscripción ≤ 7 KB.
- [ ] **Step 5: Commit** — «Cuenta: «Método de pago» en ocre si falta y cada línea de la suscripción lleva a su casa».

## Task 6: Cuenta — identity line and «Cerrar sesión» at the end with confirmation

**Files:** modify `apps/app/src/client/screens/cuenta.tsx`, `apps/app/src/styles/global.css`, `apps/app/.size-limit.json`, `apps/app/tests/e2e/helpers/session.ts`; extend `tests/e2e/cuenta-y-actividad.spec.ts`; update `tests/e2e/cuenta.spec.ts`, `navegacion.spec.ts` (and any other P0.6 caller).

**Pinned behaviour (`MyAccount`):**
- In the account card, under the «WhatsApp verificado» line: `<span className="xs muted" data-testid="identity-soon">Pronto podrá verificar también su identidad (opcional).</span>` — plain text, every signed-in user (owner or not).
- The `foot-row` is replaced by, as the **last** child of the screen: `<div className="stack account-foot"><span className="xs muted">Términos y privacidad</span><button ref={logoutRef} type="button" className="btn-link muted logout-link" onClick={() => setAsking(true)} disabled={leaving}>Cerrar sesión</button></div>`.
- `asking` → `<ConfirmSheet title="¿Cerrar sesión?" body="Tendrá que recibir un código nuevo para volver a entrar." confirmLabel="Cerrar sesión" confirmClassName="btn btn-ghost btn-lg" cancelClassName="btn-link muted logout-cancel" onClose={() => setAsking(false)} onConfirm={() => { setAsking(false); void logout(); }} />`; `logout` unchanged.
- CSS: `.account-foot{align-items:center;gap:0;padding-top:8px}` `.logout-link{font-size:12px;text-align:center}` `.logout-cancel{align-self:center}`; remove `.foot-row` if unused (`grep -rn foot-row src`).
- e2e helper: `export async function signOut(page: Page) { await page.getByRole("button", { name: "Cerrar sesión" }).click(); await page.getByRole("dialog").getByRole("button", { name: "Cerrar sesión" }).click(); }`.
- No session setting changes: `supabase/config.toml` keeps no `[auth.sessions]` timebox / inactivity timeout (documented in Task 9).

- [ ] **Step 1: Failing e2e.**
  - **Flujo 5** «Cuenta: la línea de identidad bajo WhatsApp verificado»: `injectSession(page, "other")` (no houses) → `/cuenta`; `getByTestId("identity-soon")` has exact text «Pronto podrá verificar también su identidad (opcional).»; it is not a link or button (`page.getByRole("link", { name: /identidad/ })` and `getByRole("button", { name: /identidad/ })` count 0); its bounding box `y` is greater than the «WhatsApp verificado» line's. Repeat for `"owner"` with one seeded house. `page.getByText(/identidad/)` count 1 on Cuenta.
  - **Flujo 6** «Cerrar sesión: lo último de la pantalla, con confirmación»: `injectSession(page, "owner")`, `/cuenta`; the lowest visible element is the button: `await page.evaluate(() => { const els = [...document.querySelectorAll("main *")].filter((e) => e.getClientRects().length && !e.children.length); return els.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0]?.textContent; })` → «Cerrar sesión»; its box `y` > «Términos y privacidad»'s. Tap → dialog with heading «¿Cerrar sesión?» and text «Tendrá que recibir un código nuevo para volver a entrar.». «Cancelar» → dialog count 0, the «Cerrar sesión» button `toBeFocused()`, `getByRole("link", { name: "Editar", exact: true })` click works (not inert) and then `page.goto("/cuenta")`; reopen, `keyboard.press("Escape")` → closed and focused; reopen, click `.sheet-backdrop` → closed; `page.reload()` → account card visible (session kept). Reopen and confirm → «Entre con su WhatsApp» heading visible and `localStorage.getItem("bnbtico-auth")` is null.
- [ ] **Step 2: Run** `… pnpm test:e2e cuenta-y-actividad.spec.ts -g "Flujo 5|Flujo 6"` → FAIL.
- [ ] **Step 3: Implement** as pinned; switch `cuenta.spec.ts` (l.92, 113, 162, 221) and `navegacion.spec.ts` (l.191–192: after `signOut`, the button count 0) to `signOut(page)`.
- [ ] **Step 4: Run** `… pnpm test:e2e cuenta-y-actividad.spec.ts cuenta.spec.ts navegacion.spec.ts favoritos.spec.ts suscripcion.spec.ts` → PASS.
- [ ] **Step 5: Size (new entry first, then measure).** In `.size-limit.json` add `{ "name": "Hoja de confirmación · trozo diferido (la comparten «Promoción y suscripción» y Cuenta: parar una suscripción, cerrar sesión)", "path": ["dist/client/assets/confirm-sheet-*.js"], "limit": "1 KB", "gzip": true }` and `"!dist/client/assets/confirm-sheet-*.js"` in the initial-JS entry's path list (set the limit to the measured size rounded up to the next 0.5 KB if 1 KB is too tight on first measurement — it is a new entry). `pnpm build && pnpm size` → «Pantallas de las pestañas» ≤ 24.5 KB, «Hoja de confirmación» within its limit, Suscripción ≤ 7 KB, initial ≤ 150 KB. `ls dist/client/assets | grep -c '^confirm-sheet-'` → `1`; `grep -l "sheet-backdrop" dist/client/assets/*.js` lists `confirm-sheet-*` and the chunks that already had their own sheet before (`propietario-*` for `CloseSheet`, `contact-sheet-*`), but **not** `cuenta-*` or `suscripcion-*`.
- [ ] **Step 6: If and only if step 5 fails on the tab screens:** make `ProfileForm` lazy — move it to `client/screens/profile-form.tsx`, `const ProfileForm = lazy(() => import("./profile-form").then((m) => ({ default: m.ProfileForm })))` rendered inside `<Suspense fallback={<span className="sk sk-line" />}>` only when `editing`; add a size-limit entry «Mi perfil · trozo diferido (el formulario de Editar en Cuenta)» `["dist/client/assets/profile-form-*.js"]` limit `2 KB` and its `!` exclusion in the initial entry. Rerun step 4 (`cuenta.spec.ts` covers editing) and step 5. If it still does not fit, stop and report to Daniel; do not raise any limit.
- [ ] **Step 7: Commit** — «Cuenta: línea de identidad y «Cerrar sesión» al final con confirmación».

## Task 7: Inquiry rules — summary without the house, filter and chips

**Files:** modify `apps/app/src/domain/inquiry.ts`, `apps/app/tests/unit/inquiry.test.ts`; create `apps/app/src/domain/inquiry-filter.ts`, `apps/app/tests/unit/inquiry-filter.test.ts`.

**Interfaces:**
```ts
// domain/inquiry.ts
export function inquirySummary(i: Pick<OwnerInquiry, "arrival" | "departure" | "people">): string; // «20–27 dic · 4 personas», «sin fechas»
// domain/inquiry-filter.ts — imports only ./inquiry types and ./listing types
export const CHIP_MAX = 18;
export function filterInquiries<T extends Pick<OwnerInquiry, "listingId">>(list: readonly T[], listingId: string | null): T[];
export interface InquiryChip { id: string; label: string; name: string } // label ≤ 18 chars incl. «…»; name = full title
export function inquiryChips(listings: readonly Pick<Listing, "id" | "title" | "firstPublishedAt">[]): InquiryChip[] | null; // null under two published
```
Label rule: `name = title.trim() || "Casa sin título"`; if `name.length <= 18` → `label = name`; else `name.slice(0, 17).replace(/[\s,.;:·-]+$/, "") + "…"`. Order = order of `listings` (own-listings order). «Todas» is not part of the result (the UI adds it).

- [ ] **Step 1: Failing tests.**
  - `inquiry.test.ts`: rename the describe to «inquirySummary: fechas · personas» and pin `"20–27 dic · 4 personas"`, `"sin fechas · 2 personas"`, `"sin fechas · 1 persona"`, `"sin fechas"`.
  - `inquiry-filter.test.ts`: `filterInquiries(list, null)` returns `list` (same order); 25 inquiries of `"a"` (newer) followed by 3 of `"b"`: `filterInquiries(list, "b").slice(0, 20)` has length 3 and all `listingId === "b"`; unknown id → `[]`. `inquiryChips` with one published + one draft (`firstPublishedAt: null`) → `null`; with `[{id:"a", title:"Casa Cocles", firstPublishedAt:"2026-10-01T00:00:00Z"}, {id:"b", title:"Casa Manzanillo, a pie de playa", firstPublishedAt:"…"}, {id:"c", title:"Borrador", firstPublishedAt:null}]` → `[{ id: "a", label: "Casa Cocles", name: "Casa Cocles" }, { id: "b", label: "Casa Manzanillo…", name: "Casa Manzanillo, a pie de playa" }]`; a title of exactly 18 chars (`"Cabina Punta Uva 2"`) keeps its label; empty title → `"Casa sin título"`.
- [ ] **Step 2: Run** `pnpm test tests/unit/inquiry.test.ts tests/unit/inquiry-filter.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `inquirySummary` drops `listingTitle` (doc comment «Línea de la tarjeta: «20–27 dic · 4 personas»; la casa va en su etiqueta»).
- [ ] **Step 4: Run** the same + `pnpm test tests/unit/architecture.test.ts` + `pnpm typecheck` → PASS (typecheck catches any caller passing a `listingTitle`-only type).
- [ ] **Step 5: Commit** — «Consultas: la línea sin la casa y reglas para filtrar por casa».

## Task 8: Actividad — house tag on every inquiry and chips by house

**Files:** modify `apps/app/src/client/screens/actividad.tsx`, `apps/app/src/styles/global.css`; extend `tests/e2e/cuenta-y-actividad.spec.ts`; update `tests/e2e/navegacion.spec.ts` (l.108), `tests/e2e/fase3.spec.ts` (l.175).

**Pinned behaviour:**
- `const route = getRouteApi("/_tabs/_private/_owner/propietario/actividad")` (verify the generated id with `pnpm typecheck`); `const search = route.useSearch()`.
- `const chips = list ? inquiryChips(list) : null`; `selected = chips?.some((c) => c.id === search.casa) ? search.casa! : null`; when `list` is loaded and `search.casa` is set but `selected` is null → `navigate({ to: "/propietario/actividad", search: {}, replace: true })` (unknown id or one house → «Todas»).
- `latest = filterInquiries(inquiries.data ?? [], selected).slice(0, LATEST)` (filter **before** slice).
- Section «Últimas consultas» renders when `inquiries.data.length > 0` (overall): `<h2 className="activity-h2">Últimas consultas</h2>`, then — **under the heading, as in mockup 10-actividad** — when `chips`: `<div className="chiprow" role="group" aria-label="Filtrar por casa">` with `<Link to="/propietario/actividad" search={{}} replace className="chip chip-sm" activeOptions={{ exact: true, includeSearch: true }}>Todas</Link>` and one `<Link … search={{ casa: c.id }} aria-label={c.name}>{c.label}</Link>` per chip (TanStack sets `aria-current="page"` on the active one; `.chip[aria-current="page"]` already styles it). Then the cards, or `<p className="small muted">Todavía no hay consultas de esta casa.</p>` when `latest` is empty with a selection; then the foot note.
- The figures cards above are never filtered.
- `InquiryCard({ inquiry, userId, house })`, `house = byId.get(i.listingId)` from `list`: first child of the article `<span className="inquiry-house" data-testid="inquiry-house">{cover ? <img src={variantUrl(cover, 480)} alt="" width={24} height={24} className="inquiry-house-photo" loading="lazy" decoding="async" /> : <span className="inquiry-house-photo" aria-hidden="true" />}<span className="inquiry-house-name small strong">{house?.title || i.listingTitle || "Casa sin título"}</span></span>`; summary line `inquirySummary(i)`. Shown with one house too.
- CSS (mockup: pill 32 px high, 24 px round photo, arena background): `.inquiry-house{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;height:32px;max-width:100%;padding:0 12px 0 4px;border-radius:999px;background:var(--surface-2)}` `.inquiry-house-photo{width:24px;height:24px;border-radius:999px;object-fit:cover;flex-shrink:0;background:var(--line-soft)}` `.inquiry-house-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`.

- [ ] **Step 1: Failing e2e** **Flujo 7** «Actividad con dos casas: cada consulta con su casa; el chip filtra y queda en la URL»: seed `Casa Cocles` and `Cabina Punta Uva` active (photos 5), seed a draft `Borrador` (must not get a chip); `h.inquiries("other").create(cabina.publicId, { people: 2, message: "Hola Cabina 0", arrival: null, departure: null })`, then 21 for Cocles (`message: \`Hola Cocles ${n}\``) so Cabina's is the oldest; `injectSession(page, "owner")`, `/propietario/actividad`:
  - every `getByRole("article").filter({ hasText: /Hola (Cocles|Cabina)/ })` (20 visible) has a `getByTestId("inquiry-house")` with an `img` and the right name; the Cocles card summary contains «sin fechas · 2 personas» and **not** «Casa Cocles ·».
  - `getByRole("group", { name: "Filtrar por casa" }).getByRole("link")` → names `["Todas", "Casa Cocles", "Cabina Punta Uva"]`; «Todas» has `aria-current="page"`; the group's box `y` > the «Últimas consultas» heading's.
  - tap «Cabina Punta Uva» → `toHaveURL(new RegExp(\`/propietario/actividad\\?casa=${cabina.id}$\`))`, exactly 1 inquiry article («Hola Cabina 0»; Review Focus 4); the figures cards still 2 (P0.5 locator); `reload()` → still 1 and the Cabina chip `aria-current="page"`.
  - `goto("/propietario/actividad?casa=00000000-0000-4000-8000-000000000000")` → URL `/propietario/actividad$`, «Todas» current.
  - with a house without inquiries (seed a third active `Casa Vacía`, `fresh` the screen, tap its chip) → «Todavía no hay consultas de esta casa.».
  - one-house variant: `h.reset()`, one active house + one inquiry → tag visible, `getByRole("group", { name: "Filtrar por casa" })` count 0.
- [ ] **Step 2: Run** `… pnpm test:e2e cuenta-y-actividad.spec.ts -g "Flujo 7"` → FAIL.
- [ ] **Step 3: Implement** as pinned. Update `navegacion.spec.ts` l.108 → `toContainText("sin fechas · 2 personas")` plus `inquiry.getByTestId("inquiry-house")` `toHaveText("Casa Cocles")`; keep its `Filtrar por casa` count-0 assertion (one house); `fase3.spec.ts` l.175 → `card.getByTestId("inquiry-house")` `toHaveText(TITLE)` and `card` not containing `${TITLE} · `.
- [ ] **Step 4: Run** `… pnpm test:e2e cuenta-y-actividad.spec.ts navegacion.spec.ts fase3.spec.ts` → PASS; `pnpm build && pnpm size` → «Actividad» ≤ 4 KB and «Hoja de contacto» unchanged (≤ 5.5 KB; `inquiry-filter` must not appear in `inquiry-*`: `grep -l "Casa sin título" dist/client/assets/inquiry-*.js` → none). If Actividad exceeds 4 KB: move the chip row into the same file but drop nothing from the spec; first check that `inquiry-filter` did not pull `listing.ts` values (types only, `import type`); if still over, stop and report (no raised limit).
- [ ] **Step 5: Commit** — «Actividad: la casa encima de cada consulta y chips por casa con ?casa=».

## Task 9: Documentation (same day)

**Files:** `docs/decisiones.md`, `docs/diseno-v1.md`, `CLAUDE.md`, `docs/configuracion-supabase.md`, the manual-test document from P0.7.

- [ ] **Step 1: `docs/decisiones.md`** — new entry at the very top: `## 2026-10-29 · Suscripción por casa, Cuenta y Actividad (ronda de Ana, F y G)`, «Decisión de Daniel. Especificación: `.scratch/cuenta-y-actividad/spec.md`.», bullets: «Suscripción» desde una casa = `/propietario/suscripcion?casa=CT-####` (solo esa casa, «Método de pago», «Cómo funciona», sin la oferta; «Ver todas sus casas» con dos o más; `#pago=` sigue resaltando; la pasarela vuelve con `casa=` cuando se pagó desde una casa); «Activar suscripción» en ocre sustituye a «Reactivar» (revierte en esto la del 2026-10-27 «Fase 5, ticket 05»); «Método de pago» de Cuenta en ocre si falta y las líneas pendientes/inactivas en ocre, cada una lleva a su casa; «Cerrar sesión» al final de Cuenta, discreto, con confirmación «Tendrá que recibir un código nuevo para volver a entrar.» y hoja compartida (`confirm-sheet`, entrada propia de size-limit con su tamaño medido); la sesión no caduca mientras se use (sin `timebox` ni `inactivity_timeout`); la línea «Pronto podrá verificar también su identidad (opcional).» es el único texto de identidad de la v1; Actividad: etiqueta de la casa en cada consulta y chips por casa con dos o más casas publicadas, en la URL `?casa=<uuid>`, filtrando antes de tomar las 20 últimas (revierte la retirada de los chips del 2026-10-27 «Navegación simple»); passkeys, después del lanzamiento.
- [ ] **Step 2: `docs/diseno-v1.md`** — item 8 «Mi cuenta»: add the identity line under «WhatsApp verificado · número» and «términos y, al final, "Cerrar sesión" discreto con confirmación»; item 9 «Actividad»: «Debajo, "Últimas consultas" con chips "Todas · <casa>…" (dos o más casas publicadas)»; item 14: card «etiqueta de la casa (miniatura redonda y nombre) · iniciales, nombre, "Nueva", fecha relativa, fechas · personas, …»; item 16 «Cuenta (propietario)»: «Método de pago» ocre si falta, líneas que llevan a la suscripción de su casa, «Cerrar sesión» al final; add to item 16 (or the subscription item) the scoped «Suscripción» screen.
- [ ] **Step 3: `CLAUDE.md`** — Veriff bullet: «En v1 no se muestra nada de identidad, salvo la línea informativa de Cuenta («Pronto podrá verificar también su identidad (opcional).»).».
- [ ] **Step 4: `docs/configuracion-supabase.md`** — in section 4 «Login por teléfono en Supabase» (or a new «Sesión» subsection): «`[auth.sessions] timebox` e `inactivity_timeout` se dejan sin poner en local, `bnbtico-pruebas` y producción: la sesión no caduca mientras se use (decisión 2026-10-29). Revisarlo en el panel de Auth → Sessions al crear un proyecto.»
- [ ] **Step 5: Manual tests** (P0.7 document, next free numbers): rows for — Suscripción desde la fila de una casa (solo esa casa, «Ver todas sus casas»); enlace de aviso `#pago=` resalta; casa parada «Activar suscripción» ocre y vuelve a Activa; pasarela de prueba desde una casa vuelve a la misma casa; Cuenta sin método (fila ocre) y con método; línea de identidad; «Cerrar sesión» al final: Cancelar, fondo y confirmar; Actividad con dos casas: etiqueta en cada consulta, chip filtra, recargar mantiene el filtro, casa sin consultas.
- [ ] **Step 6: Commit** the five docs — «Documenta la suscripción por casa, la nueva Cuenta y la casa en las consultas de Actividad».

## Task 10: Final verification

- [ ] `pnpm typecheck` → PASS.
- [ ] `pnpm test` → PASS (unit, incl. architecture and B's ocre allowlist).
- [ ] `pnpm test:db` → PASS (no DB change; contract suites unchanged).
- [ ] `pnpm build` → PASS; `pnpm size` → every entry within its limit, none raised (`git diff <P0 commit> -- apps/app/.size-limit.json` shows only the new entries and their `!` exclusions).
- [ ] Full e2e: `pnpm build && VITE_WA_GUESTS="+506 6000 0000" CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e --workers=1` → PASS.
- [ ] `pnpm lighthouse` → PASS (ficha in cold < 2.0 s, installed shell < 2.5 s).
- [ ] From the repo root: `pnpm test:prototype` → PASS.
- [ ] `grep -rn "identidad" apps/app/src` → only the Cuenta line (and code comments); `grep -rn "Reactivar\b" apps/app/src` → none in UI strings (the «Puede reactivarla» sentence of the stop sheet may stay).
- [ ] `git status` clean; `git log --oneline` shows one commit per task, Spanish imperative, no co-author line. Do not push.

---

## Self-review notes

- **Spec coverage:** §1 scope (Tasks 1, 2, 4), entry points (Task 4 via `SubscriptionLink`, Task 5 Cuenta lines), return URLs and `useSavingMethod` (Tasks 1, 4); §2 ocre (Tasks 4, 5); §3 identity line, «Cerrar sesión», shared sheet, session note (Tasks 3, 6, 9); §4 tag, summary, chips, URL, filter-before-slice, empty filter, one house (Tasks 7, 8); Testing list: Vitest items in Tasks 1, 2, 7; Playwright flows 1–7 in `cuenta-y-actividad.spec.ts` (Tasks 4, 5, 6, 8); older specs updated in Tasks 4, 5, 6, 8; gates in Tasks 3, 6, 8, 10; documentation in Task 9.
- **Type consistency:** `SuscripcionSearch` is defined once in `domain/subscription-scope.ts` and reused by `client/owner-search.ts`; `scopeBilling` is generic over `{ house: { publicId } }` so the client's `HouseBilling` fits without the domain importing `client/billing.ts`; `inquirySummary`'s parameter type narrows (callers pass `OwnerInquiry`, still assignable); `InquiryChip.name` is an addition to the spec's `{ id, label }` for the accessible name.
- **Ambiguities resolved:** (1) a house's `PayButton` on the *unscoped* screen also returns scoped to that house (the spec's `setupReturnUrls` rule applies whenever a house is given; the owner acted on that house); the method card's «Cambiar»/«Añadir» on the unscoped screen returns unscoped. (2) `scopeBilling` and the chip rules live in new domain files instead of `subscription.ts`/`inquiry.ts`, so the tab-screens and contact-sheet budgets do not grow. (3) Chips go *under* the «Últimas consultas» heading (mockup 10-actividad wins on looks over the spec's «above»); the tag is the mockup's 32 px pill with a 24 px round photo. (4) An unknown `?casa=` is also removed from the Actividad URL (replace), as in Suscripción and Calendario. (5) Cuenta's «Método de pago» row stays unscoped; subscription lines of houses in review have no link (they are not in `owner_billing`). (6) The mockup's «Mensual · desde el 1 dic» summary is out of scope (inquiries carry no modality). (7) The scoped header keeps «Suscripción» while billing loads with `casa` set, to avoid a title flip.
