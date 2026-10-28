# Navegación simple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** One bottom bar that grows from 2 tabs (Explorar · Favoritos) to 5 (+ Mis casas · Calendario · Actividad) when the user has at least one listing, a fixed top bar with logo · ₡ | $ · account button, Cuenta as a full screen, the ₡ | $ switch on the ficha, and «Actividad» replacing Inicio and Mis consultas.

**Architecture:** A pure module `src/domain/navigation.ts` decides tabs, the Mis casas view, the notice card and the owner-zone redirect; the UI only renders its output. "Owner" is derived from the owner-listings query (`["own-listings", uid]`, persisted in IndexedDB), with the existing `bnbtico-mis-casas` localStorage list as the synchronous first-paint hint, so the `bnbtico-role` switch disappears. Activity figures come from one new `security definer` RPC `owner_activity()` behind `ListingsApi.ownerActivity()` (PostgREST adapter + fake, one contract suite).

**Tech Stack:** Vite + React 19, TanStack Router + Query (persisted), TypeScript strict, Supabase Postgres (RLS, plpgsql RPCs), Vitest (unit / db / contract), Playwright (Pixel 7, one worker), size-limit.

**Spec:** `.scratch/navegacion-simple/spec.md`

Conventions for every task: `pnpm …` commands run from `apps/app`; `git` commands run from the repo root. E2E runs against `vite preview`, so every e2e step is `pnpm build && CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e <spec>`; DB and e2e need `pnpm db:start` (and `pnpm db:reset` after a new migration).

## Global Constraints

- UI copy in Spanish de Costa Rica, treating the user as **usted**; no voseo or tuteo.
- No `dangerouslySetInnerHTML`, no `innerHTML`/`eval`, no `style={…}` in JSX (enforced by `tests/unit/architecture.test.ts`).
- CSP strict: `script-src 'self'`, no inline scripts or styles, no third parties in the private zone.
- `src/domain/*` imports no framework (only `zod` and its own modules); PostgREST strings only in `src/data/postgrest/*`.
- size-limit: «Pantallas de las pestañas» stays under **24.5 KB** gz. If it does not fit: the top bar keeps only the logo and the account button, and the ₡ | $ switch goes back to Explorar's results line; the ficha keeps its switch. Do not raise the limit.
- Never more than **5** bottom tabs. New sections go in Cuenta or inside an existing tab.
- Commits in Spanish, imperative, **without** any co-author line. One commit per completed step with tests green. Do not push to the remote.
- Test first: write the failing test, see it fail, then the code.
- Playwright: mobile viewport (Pixel 7 from `playwright.config.ts`), one worker, `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
- New migration: `pnpm exec supabase migration new owner_activity < /dev/null` (from the repo root); never edit `0001_init.sql`.
- Regenerate types with `pnpm db:types` after `pnpm db:reset`, and commit `src/domain/database.types.ts`.
- Do not access pruebas.bnbtico.com or bnbtico.com from any tool; Daniel checks the deploy.
- Prototype (`design/prototype/`) is not changed; `pnpm test:prototype` (repo root) must still pass.

## Review Focus

1. **Bar flicker on first login without cache.** After the code, `CodeForm.verify` awaits `queryClient.fetchQuery(ownListingsQuery(account.id))` before navigating, so the first painted bar already has the right count; on later opens the `bnbtico-mis-casas` hint gives the count before IndexedDB and supabase-js are ready. Test (Task 7): `navegacion.spec.ts` «el propietario entra y la barra no salta» records every tab-count change with a `MutationObserver` from `addInitScript` and expects the sequence after the URL becomes `/propietario/casas` to be `[5]` only; a reload test expects `[5]` from the first paint.
2. **User deletes the last listing while on an owner tab.** The optimistic `useDeleteDraft` sets the list to `[]`; `OwnerOutlet` redirects to `/explorar` (replace) only when the count comes from data and no fetch is in flight (`ownerZoneRedirect`). Tests: unit `ownerZoneRedirect` table (Task 1); e2e flow 4 (Task 7) discards the sole draft from the single view of Mis casas and lands on Explorar with 2 tabs.
3. **Old `/propietario` and `/propietario/consultas` links (WhatsApp reminders, bookmarks, the installed PWA's last URL).** Both are `redirect({ replace: true })` routes outside the session guard. Tests: e2e flow 6 (Task 5) for `/propietario/consultas → /propietario/actividad`; Task 6 asserts `/propietario → /propietario/casas` and that `history.length` does not grow.
4. **Hydration warning on the ficha from the currency switch.** The server and the first client render emit the same fixed box; the real switch mounts after `useHydrated()`. Tests (Task 8): unit SSR snapshot of the box in `tests/unit/currency-switch-ssr.test.tsx`; the existing «la ficha real llega renderizada del servidor e hidrata sin avisos…» in `ficha.spec.ts` stays green with its updated source assertion; the box and the switch have the same bounding box.
5. **Admin with listings.** The admin bar is shown only inside `/admin/*` (the zone already requires `is_admin` + aal2); outside it an admin gets the bar their listings give. Tests: unit `tabsFor` cases (Task 1); `admin.spec.ts` update (Task 7): an admin with one seeded listing sees the admin bar on `/admin` and 5 tabs on `/explorar`.

## File Structure

Created:
- `apps/app/src/domain/navigation.ts` — `tabsFor`, `casasView`, `noticeFor`, `ownerZoneRedirect`, `activityEmpty`; no framework imports.
- `apps/app/tests/unit/navigation.test.ts` — unit tests of the module above.
- `supabase/migrations/<ts>_owner_activity.sql` — RPC `owner_activity()`.
- `apps/app/tests/db/actividad-propietario.test.ts` — grants and 30-day window of `owner_activity()`.
- `apps/app/src/client/own-listings-query.ts` — `ownListingsQuery` (moved from `owner.ts`, lazy queryFn) and `useListingsCount()`; lives in the initial JS.
- `apps/app/src/client/screens/actividad.tsx` — Actividad screen (deferred chunk `actividad-*`); receives `InquiryCard` and `SkeletonInquiry` moved from `consultas.tsx`.
- `apps/app/src/shared/currency-switch.tsx` — `CurrencySwitch` (moved from `src/client/`) plus `CurrencySwitchSlot` (fixed box until hydrated).
- `apps/app/tests/unit/currency-switch-ssr.test.tsx` — SSR output of the ficha header box.
- `apps/app/tests/e2e/navegacion.spec.ts` — the seven flows of the spec.

Modified:
- `apps/app/src/domain/api.ts` — `ListingActivity`, `OwnerListingsApi.ownerActivity()`.
- `apps/app/src/data/postgrest/owner.ts`, `apps/app/src/data/fake/owner.ts`, `apps/app/src/data/fake/db.ts` — adapter, fake, `FakeDb.taps`.
- `apps/app/tests/contract/harness.ts`, `inquiries.contract.ts`, `apps/app/tests/unit/fake-harness.ts`, `apps/app/tests/db/postgrest-harness.ts` — `recordTaps`, contract case.
- `apps/app/src/domain/database.types.ts` — regenerated.
- `apps/app/src/shared/own-listings.ts` — `ownListingsHint()`.
- `apps/app/src/client/owner.ts` — re-exports `ownListingsQuery`, adds `fetchOwnListings`, `activityQuery`; optimistic insert helper.
- `apps/app/src/client/account.ts` — `PRIVATE_KEYS` gains `"own-activity"`.
- `apps/app/src/client/chrome.tsx` — `TabsFrame` from `tabsFor`, `TopBar`, `UnderTopBar` context in `RootHeader`, `FlowHeader.onBack`.
- `apps/app/src/client/shell.tsx` — routes (`/propietario/actividad`, two redirects, `_owner` layout with `OwnerOutlet`), prefetch, no role.
- `apps/app/src/client/screens/propietario.tsx` — Mis casas single/list + notice card; Inicio and its helpers deleted.
- `apps/app/src/client/screens/cuenta.tsx` — full screen, derived owner, «Publicar mi casa» row, no Moneda row, no role switch, login landing.
- `apps/app/src/client/screens/explorar.tsx`, `favoritos.tsx`, `calendario.tsx`, `suscripcion.tsx`, `publicar.tsx` — no `setRole`/`useOwnerMode`; Explorar header and results line.
- `apps/app/src/shared/listing-page.tsx` — ₡ | $ slot in the hero header.
- `apps/app/src/styles/global.css` — `.topbar`, `.view.has-topbar`, `.currency-switch-box`, figures and activity cards, `.tabbar.two`.
- `apps/app/.size-limit.json` — `consultas-*` → `actividad-*` in three entries.
- `apps/app/src/domain/inquiry.ts`, `apps/app/tests/unit/inquiry.test.ts` — `inquiryHouses` deleted (only the chips used it).
- Existing e2e specs that assert the old bars or screens (listed in each task).
- `docs/decisiones.md`, `docs/diseno-v1.md`, `CLAUDE.md`, `docs/pruebas-manuales-revision-ux.md`.

Deleted:
- `apps/app/src/client/role.ts`, `apps/app/tests/unit/role.test.ts`, `apps/app/src/client/screens/consultas.tsx`, `apps/app/src/client/currency-switch.tsx` (moved), `apps/app/tests/e2e/consultas.spec.ts` (its cases move to `navegacion.spec.ts`/Task 5).

---

## Task 1: Pure navigation rules (`domain/navigation.ts`)

**Files:** create `apps/app/src/domain/navigation.ts`, `apps/app/tests/unit/navigation.test.ts`.

**Interfaces**
- Consumes: `Listing`/`ListingStatus` (`domain/listing.ts`), `HouseSubscription`, `payButtonDue` (`domain/subscription.ts`).
- Produces:
  ```ts
  export type TabPath = "/explorar" | "/favoritos" | "/propietario/casas" | "/propietario/calendario" | "/propietario/actividad" | "/admin" | "/admin/casas" | "/admin/usuarios" | "/cuenta";
  export type TabIcon = "search" | "heart" | "house" | "calendar" | "chat" | "inbox" | "pin" | "users" | "user";
  export interface Tab { to: TabPath; label: string; icon: TabIcon; exact: boolean; badge?: "inquiries" | "review" }
  export const MAX_TABS = 5;
  export function tabsFor(input: { session: boolean; isAdmin: boolean; listingsCount: number | undefined }): Tab[];
  export function casasView(listingsCount: number): "single" | "list" | "none";
  export type Notice = { kind: "payment" | "resume"; listingId: string };
  export function noticeFor(listings: readonly Pick<Listing, "id" | "status">[], subscriptions: { today: string; houses: readonly { listingId: string; sub: HouseSubscription }[] } | null): Notice | null;
  export function ownerZoneRedirect(listingsCount: number | undefined, fetching: boolean): boolean;
  export function activityEmpty(listings: readonly Pick<Listing, "status">[], inquiries: number): boolean;
  ```

Pinned values:
- Client tabs: `Explorar /explorar search` · `Favoritos /favoritos heart` (both `exact: false`).
- Owner tabs: client tabs + `Mis casas /propietario/casas house` · `Calendario /propietario/calendario calendar` · `Actividad /propietario/actividad chat badge:"inquiries"`.
- Admin tabs (unchanged): `Anuncios /admin inbox exact:true badge:"review"` · `Casas /admin/casas pin` · `Usuarios /admin/usuarios users` · `Cuenta /cuenta user`.
- Order of precedence: `isAdmin` → admin; `!session` → client; `listingsCount > 0` → owner; else client (`undefined` = not known yet = client).
- `noticeFor`: only houses present in `listings`; first a house whose `sub.status === "payment_due"` and `payButtonDue`, then any `payButtonDue` house, then the first listing (list order = newest first) with status `draft` or `changes`; else `null`. `subscriptions === null` skips the payment step.
- `ownerZoneRedirect(count, fetching)` = `count === 0 && !fetching`.
- `activityEmpty` = no listing with status `active` and `inquiries === 0`.

- [ ] **Step 1: Write the failing test** `tests/unit/navigation.test.ts`:
  ```ts
  const labels = (t: Tab[]) => t.map((x) => x.label);
  describe("tabsFor", () => {
    it("sin sesión: Explorar y Favoritos", () => expect(labels(tabsFor({ session: false, isAdmin: false, listingsCount: undefined }))).toEqual(["Explorar", "Favoritos"]));
    it("cliente (cero casas) y lista aún sin leer: dos pestañas", () => {
      expect(labels(tabsFor({ session: true, isAdmin: false, listingsCount: 0 }))).toEqual(["Explorar", "Favoritos"]);
      expect(labels(tabsFor({ session: true, isAdmin: false, listingsCount: undefined }))).toEqual(["Explorar", "Favoritos"]);
    });
    it("propietario con un borrador: cinco, Actividad con el contador", () => {
      const t = tabsFor({ session: true, isAdmin: false, listingsCount: 1 });
      expect(labels(t)).toEqual(["Explorar", "Favoritos", "Mis casas", "Calendario", "Actividad"]);
      expect(t.find((x) => x.badge === "inquiries")?.to).toBe("/propietario/actividad");
    });
    it("admin (con o sin casas): la barra del admin", () => {
      for (const n of [0, 3]) expect(labels(tabsFor({ session: true, isAdmin: true, listingsCount: n }))).toEqual(["Anuncios", "Casas", "Usuarios", "Cuenta"]);
    });
    it("nunca más de cinco", () => {
      for (const session of [true, false]) for (const isAdmin of [true, false]) for (const n of [undefined, 0, 1, 9])
        expect(tabsFor({ session, isAdmin, listingsCount: n }).length).toBeLessThanOrEqual(MAX_TABS);
    });
  });
  describe("casasView", () => it("0 → none, 1 → single, 2+ → list", () => expect([0, 1, 2, 7].map(casasView)).toEqual(["none", "single", "list", "list"])));
  describe("noticeFor", () => {
    // sub(): HouseSubscription fixture como `house()` de tests/unit/subscription.test.ts (TODAY = "2026-12-01").
    it("pago antes que seguir publicando; la pendiente de pago antes que la de la ventana de 90 días", ...);
    it("sin aviso de pago: el borrador o la casa con cambios más reciente", () => expect(noticeFor([{ id: "a", status: "active" }, { id: "c", status: "changes" }, { id: "d", status: "draft" }], null)).toEqual({ kind: "resume", listingId: "c" }));
    it("con método de pago o sin nada pendiente: null", ...);
    it("ignora suscripciones de casas que no están en la lista", ...);
  });
  describe("ownerZoneRedirect", () => it("solo con la lista leída, vacía y sin lectura en curso", () => {
    expect(ownerZoneRedirect(0, false)).toBe(true);
    expect(ownerZoneRedirect(0, true)).toBe(false);
    expect(ownerZoneRedirect(undefined, false)).toBe(false);
    expect(ownerZoneRedirect(1, false)).toBe(false);
  }));
  describe("activityEmpty", () => it("sin casa activa y sin consultas", () => {
    expect(activityEmpty([{ status: "review" }], 0)).toBe(true);
    expect(activityEmpty([{ status: "review" }], 2)).toBe(false);
    expect(activityEmpty([{ status: "active" }], 0)).toBe(false);
  }));
  ```
- [ ] **Step 2: Run** `pnpm test tests/unit/navigation.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `src/domain/navigation.ts` with the signatures and pinned values above (constant arrays `CLIENT_TABS`, `OWNER_TABS`, `ADMIN_TABS`, `as const satisfies readonly Tab[]`).
- [ ] **Step 4: Run** `pnpm test tests/unit/navigation.test.ts tests/unit/architecture.test.ts` → PASS.
- [ ] **Step 5: Commit**
  ```
  git add apps/app/src/domain/navigation.ts apps/app/tests/unit/navigation.test.ts
  git commit -m "Añade las reglas puras de la navegación: pestañas, vista de Mis casas y aviso"
  ```

## Task 2: RPC `owner_activity()` (migration + DB test + types)

**Files:** create `supabase/migrations/<ts>_owner_activity.sql`, `apps/app/tests/db/actividad-propietario.test.ts`; modify `apps/app/src/domain/database.types.ts` (generated).

**Interfaces**
- Consumes: tables `listings`, `events` (`name`, `listing_public_id`, `created_at`), `inquiries` (`listing_id`, `created_at`).
- Produces: `owner_activity() returns table (listing_id uuid, public_id text, views int, whatsapp_taps int, inquiries int)`, `stable security definer`, `search_path = public`; executable by `authenticated` only.

- [ ] **Step 1: Write the failing test** `tests/db/actividad-propietario.test.ts` (pattern of `tests/db/fase3-consultas.test.ts`: `serviceClient()`, `signIn("owner" | "other" | "admin")`, `anonClient()`). `beforeAll`: delete all listings with the service client; insert, in this order and one statement each, `active` (owner), `draft` (owner), `foreign` (other, active). Insert with the service client into `events` (row shape of `postgrest-harness.ts` `recordViews`): `listing_view` ×3 now and ×2 at `now − 31 d` for `active.public_id`; `whatsapp_tap` ×2 now and ×1 at `now − 31 d`; `page_view` ×1 now with the same `listing_public_id` (must not count); `listing_view` ×4 for `foreign.public_id`. Inquiries: `other` and `admin` each call `create_inquiry` on `active.public_id`; backdate `admin`'s one to `now − 31 d` (service update of `created_at`, `updated_at`).
  ```ts
  it("solo las casas de quien llama, la más reciente primero, en cualquier estado", async () => {
    const { data, error } = await owner.rpc("owner_activity");
    expect(error).toBeNull();
    expect(data).toEqual([
      { listing_id: draft.id, public_id: draft.public_id, views: 0, whatsapp_taps: 0, inquiries: 0 },
      { listing_id: active.id, public_id: active.public_id, views: 3, whatsapp_taps: 2, inquiries: 1 },
    ]);
    expect((await other.rpc("owner_activity")).data!.map((r) => r.public_id)).toEqual([foreign.public_id]);
  });
  it("sin sesión no se puede llamar", async () => expect((await anonClient().rpc("owner_activity")).error?.code).toBe("42501"));
  it("la ventana es de 30 días para visitas, toques y consultas", ...); // mueve una visita, un toque y la consulta reciente a −29 d y −31 d y comprueba que solo cuentan las de −29 d
  ```
- [ ] **Step 2: Run** `pnpm test:db tests/db/actividad-propietario.test.ts` → FAIL (`Could not find the function public.owner_activity`; the `.rpc("owner_activity")` call also fails typecheck until types are regenerated — run vitest, not tsc, here).
- [ ] **Step 3: Implement.** From the repo root: `pnpm exec supabase migration new owner_activity < /dev/null` (the timestamp must sort after `20261028010831_evento_ayuda_busqueda.sql`; if not, rename the file to a later timestamp). Body:
  ```sql
  -- bnbtico · navegación simple · actividad de 30 días de las casas del propietario · 2026-10-27
  -- Pantalla Actividad: una fila por casa propia (cualquier estado) con visitas (`listing_view`), toques en WhatsApp
  -- (`whatsapp_tap`) y consultas de los últimos 30 días. `events` sigue sin leerse desde el navegador: solo salen totales.
  -- owner_listing_stats(p_listing) sigue para el detalle de una casa.
  create or replace function owner_activity()
  returns table (listing_id uuid, public_id text, views int, whatsapp_taps int, inquiries int)
  language sql stable security definer set search_path = public as $$
    select l.id, l.public_id,
      (select count(*)::int from events e where e.name = 'listing_view' and e.listing_public_id = l.public_id and e.created_at > now() - interval '30 days'),
      (select count(*)::int from events e where e.name = 'whatsapp_tap' and e.listing_public_id = l.public_id and e.created_at > now() - interval '30 days'),
      (select count(*)::int from inquiries i where i.listing_id = l.id and i.created_at > now() - interval '30 days')
    from listings l
    where l.owner_id = auth.uid()
    order by l.created_at desc;
  $$;
  revoke all on function owner_activity() from public, anon;
  grant execute on function owner_activity() to authenticated;
  ```
  Then `pnpm db:reset` (repo root) and `pnpm db:types` (apps/app).
- [ ] **Step 4: Run** `pnpm test:db tests/db/actividad-propietario.test.ts && pnpm typecheck` → PASS.
- [ ] **Step 5: Commit**
  ```
  git add supabase/migrations/*_owner_activity.sql apps/app/tests/db/actividad-propietario.test.ts apps/app/src/domain/database.types.ts
  git commit -m "Añade la RPC owner_activity con visitas, toques en WhatsApp y consultas de 30 días por casa"
  ```

## Task 3: `ListingsApi.ownerActivity()` in the adapter, the fake and the contract

**Files:** modify `src/domain/api.ts`, `src/data/postgrest/owner.ts`, `src/data/fake/owner.ts`, `src/data/fake/db.ts`, `tests/contract/harness.ts`, `tests/contract/inquiries.contract.ts`, `tests/unit/fake-harness.ts`, `tests/db/postgrest-harness.ts`.

**Interfaces**
- Consumes: RPC `owner_activity` (Task 2).
- Produces:
  ```ts
  // domain/api.ts, next to ListingStats
  export interface ListingActivity { listingId: string; publicId: string; views: number; whatsappTaps: number; inquiries: number }
  // OwnerListingsApi
  /** Una fila por casa propia (cualquier estado), la más reciente primero: visitas, toques en WhatsApp y consultas de 30 días (RPC owner_activity). */
  ownerActivity(): Promise<ListingActivity[]>;
  // FakeDb
  taps: { publicId: string; at: string }[];
  // InquiriesHarness
  /** `n` toques en «Contactar por WhatsApp» (`whatsapp_tap`) de esa casa, hace `daysAgo` días. */
  recordTaps(publicId: string, n: number, daysAgo?: number): Promise<void>;
  ```
- PostgREST: `db.rpc("owner_activity")`, `toDomainError` on error, map snake → camel. Without session the call must fail with kind `session` like the rest: call `await me()` first.
- Fake: `me()`, own listings sorted by `createdAt` desc, counts with `since = Date.now() − 30 d` over `db.views`, `db.taps`, `db.inquiries` (same as `stats`).

- [ ] **Step 1: Write the failing test** in `tests/contract/inquiries.contract.ts`, after the `stats` case:
  ```ts
  it("actividad de 30 días: una fila por casa propia, con visitas, toques y consultas; nada ajeno", async () => {
    const newer = await h.seed({ status: "draft", draft: { title: "Borrador" } });
    const foreign = await h.seed({ status: "active", as: "other", draft: { title: "Ajena" } });
    await h.recordViews(house.publicId, 3);
    await h.recordViews(house.publicId, 2, 40);
    await h.recordTaps(house.publicId, 2);
    await h.recordTaps(house.publicId, 1, 31);
    await h.inquiries("other").create(house.publicId, draft());
    const rows = await h.owner("owner").ownerActivity();
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(expect.arrayContaining([
      { listingId: house.id, publicId: house.publicId, views: 3, whatsappTaps: 2, inquiries: 1 },
      { listingId: newer.id, publicId: newer.publicId, views: 0, whatsappTaps: 0, inquiries: 0 },
    ]));
    expect((await h.owner("other").ownerActivity()).map((r) => r.publicId)).toEqual([foreign.publicId]);
  });
  ```
  (Order is not asserted here: fake seeds can share a millisecond; the DB test pins the order.)
- [ ] **Step 2: Run** `pnpm test tests/unit/contract-inquiries-fake.test.ts` → FAIL (`ownerActivity is not a function` / `recordTaps`); `pnpm typecheck` → FAIL.
- [ ] **Step 3: Implement** the interfaces above; harness `recordTaps` mirrors `recordViews` (fake: push to `db.taps`; PostgREST: insert `events` rows with `name: "whatsapp_tap"`).
- [ ] **Step 4: Run** `pnpm typecheck && pnpm test tests/unit/contract-inquiries-fake.test.ts && pnpm test:db tests/db/contract-inquiries-postgrest.test.ts` → PASS.
- [ ] **Step 5: Commit**
  ```
  git add apps/app/src/domain/api.ts apps/app/src/data/postgrest/owner.ts apps/app/src/data/fake/owner.ts apps/app/src/data/fake/db.ts apps/app/tests/contract/harness.ts apps/app/tests/contract/inquiries.contract.ts apps/app/tests/unit/fake-harness.ts apps/app/tests/db/postgrest-harness.ts
  git commit -m "Añade ownerActivity a ListingsApi, con adaptador PostgREST, fake y prueba de contrato"
  ```

## Task 4: Owner-listings query in the initial JS, the first-paint hint and optimistic create

**Files:** create `src/client/own-listings-query.ts`; modify `src/shared/own-listings.ts`, `src/client/owner.ts`, `src/client/account.ts`, `src/client/screens/publicar.tsx`; tests `tests/unit/own-listings-hint.test.ts`.

**Interfaces**
- Produces:
  ```ts
  // shared/own-listings.ts — number of CT-#### stored by rememberOwnListings; 0 without window or key.
  export function ownListingsHint(): number;
  // client/own-listings-query.ts (initial JS; must not import ./owner statically)
  export const OWNER_STALE_MS = 30_000;
  export const ownListingsQuery: (userId: string) => /* queryOptions */ { queryKey: readonly ["own-listings", string]; queryFn: () => Promise<Listing[]>; staleTime: number };
  //   queryFn: async () => (await import("./owner")).fetchOwnListings()
  /** Cuántas casas tiene la sesión: la lista leída o, mientras no llega, la pista del teléfono (undefined si no hay ninguna). */
  export function useListingsCount(): { count: number | undefined; fromData: boolean; fetching: boolean };
  // client/owner.ts
  export { ownListingsQuery, OWNER_STALE_MS } from "./own-listings-query"; // existing importers keep working
  export async function fetchOwnListings(): Promise<Listing[]>; // body of today's queryFn: allSavesSettled, listOwn, rememberOwnListings
  export const activityQuery: (userId: string) => queryOptions<ListingActivity[]>; // key ["own-activity", userId], staleTime OWNER_STALE_MS
  export function addOwnCached(client: QueryClient, userId: string, l: Listing): void; // prepend to the cached list if it exists
  ```
- `useListingsCount`: `userId = useSession().session?.userId`; `useQuery({ ...ownListingsQuery(userId ?? ""), enabled: !!userId, select: (l) => l.length })`; `count = data ?? (hint > 0 ? hint : undefined)`; `fromData = data !== undefined`; `fetching = isFetching`. While the session is `loading` (no userId yet) the hint alone decides.
- `PRIVATE_KEYS` gains `"own-activity"`.
- `PublicarScreen` create `onSuccess`: after `prefetchQuery(ownListingQuery(...))`, read it with `client.getQueryData(["own-listing", userId, id])` and call `addOwnCached` before the invalidations, so the bar grows at once.

- [ ] **Step 1: Write the failing test** `tests/unit/own-listings-hint.test.ts` (node env: stub `globalThis.window` and `localStorage` with a `Map`-backed object, as other unit tests stub storage):
  ```ts
  it("cuenta los CT-#### guardados y 0 sin nada", () => {
    expect(ownListingsHint()).toBe(0);
    rememberOwnListings(["CT-1001", "CT-1002"]);
    expect(ownListingsHint()).toBe(2);
    rememberOwnListings([]);
    expect(ownListingsHint()).toBe(0);
    rememberOwnListings(["CT-1001"]); forgetOwnListings();
    expect(ownListingsHint()).toBe(0);
  });
  it("own-activity es privada", () => expect(PRIVATE_KEYS.has("own-activity")).toBe(true));
  ```
- [ ] **Step 2: Run** `pnpm test tests/unit/own-listings-hint.test.ts` → FAIL.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm test && pnpm build && pnpm size` → PASS; the initial-JS entry grows by well under 1 KB (it was 142.58 KB of 150).
- [ ] **Step 5: Commit**
  ```
  git add apps/app/src/client/own-listings-query.ts apps/app/src/shared/own-listings.ts apps/app/src/client/owner.ts apps/app/src/client/account.ts apps/app/src/client/screens/publicar.tsx apps/app/tests/unit/own-listings-hint.test.ts
  git commit -m "Lleva la consulta de casas propias al JS inicial con la pista del teléfono y alta optimista"
  ```

## Task 5: Actividad screen and `/propietario/consultas` redirect

**Files:** create `src/client/screens/actividad.tsx`, `tests/e2e/navegacion.spec.ts` (flows 6 and 7); modify `src/client/shell.tsx`, `src/client/chrome.tsx` (interim: the OWNER entry «Consultas /propietario/consultas» becomes «Actividad /propietario/actividad» with the same badge; the full bar comes in Task 7), `src/styles/global.css`, `.size-limit.json`, `src/domain/inquiry.ts`, `tests/unit/inquiry.test.ts`; delete `src/client/screens/consultas.tsx`, `tests/e2e/consultas.spec.ts`; update `tests/e2e/fase3.spec.ts`.

**Interfaces**
- Consumes: `activityQuery`, `ownListingsQuery` (Task 4), `inquiriesQuery`, `openInquiry`, `countNew` (`client/inquiries.ts`), `casasView`, `activityEmpty` (Task 1), `describe(l).statusLabel`, `variantUrl`.
- Produces: `export function ActividadScreen(): JSX.Element`; routes `/propietario/actividad` (lazy chunk `actividad-*`, under `privateRoutes`) and `/propietario/consultas` → `redirect({ to: "/propietario/actividad", replace: true })` (child of `rootRoute`, like `/`).

Fixed copy and structure:
- `RootHeader title="Actividad"` with `aside={<span className="small muted">Últimos 30 días</span>}`.
- Figure labels: `visitas` · `toques en WhatsApp` · `consultas` (singular `visita` / `toque en WhatsApp` / `consulta` for 1), numbers in `.num`, `data-testid="activity-figures"`.
- `casasView(n) === "list"`: one `article.card.activity-card` per listing in list order: `Thumb` small (480 variant), title (`titleOf`), `CT-####` in `.num`, then either the three figures (status `active`) or the state label only.
- `"single"`: no card; three large figures if `active`; otherwise the state label and the empty message.
- «Últimas consultas» (`h2`): the first 20 of `inquiriesQuery` with the moved `InquiryCard` (initials, name, «Nueva», `inquirySummary`, message, «Abrir WhatsApp» → `openInquiry`); no filter chips.
- Empty (`activityEmpty(list, inquiries.length)`): only `<p>Cuando su casa esté activa verá aquí cuántas personas la visitan y le escriben</p>`.
- Skeletons while queries load; `.note[role=alert]` with `toDomainError(...).message` on error without data.
- `inquiryHouses` and its unit test are deleted (only the chips used it).
- `.size-limit.json`: replace `consultas-*` by `actividad-*` in the initial-JS exclusions, in «Pantallas de las pestañas» and in the «Mis consultas» entry, renamed «Actividad · trozo diferido (la pantalla del propietario; la consulta y el contador de la pestaña van en el JS inicial)», limit stays 4 KB.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/navegacion.spec.ts` (setup like `propietario.spec.ts`: `postgrestHarness()`, `h.reset()`, `injectSession(page, "owner")`, storage route stub; `test.describe.configure({ mode: "serial" })`):
  ```ts
  test("6 · /propietario/consultas lleva a Actividad sin quedar en el historial", async ({ page }) => {
    await page.goto("/explorar");
    const before = await page.evaluate(() => history.length);
    await page.goto("/propietario/consultas");
    await expect(page).toHaveURL(/\/propietario\/actividad$/);
    await expect(page.getByRole("heading", { level: 1, name: "Actividad" })).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
  });
  test("7 · con una casa activa: las tres cifras en grande y las últimas consultas", async ({ page }) => {
    const casa = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await h.recordViews(casa.publicId, 4);
    await h.recordTaps(casa.publicId, 2);
    await h.inquiries("other").create(casa.publicId, { arrival: null, departure: null, people: 2, message: "Hola, ¿está libre?" });
    await page.goto("/propietario/actividad");
    await expect(page.getByText("Últimos 30 días")).toBeVisible();
    await expect(page.getByTestId("activity-figures")).toHaveText(/4\s*visitas.*2\s*toques en WhatsApp.*1\s*consulta/s);
    await expect(page.locator(".activity-card")).toHaveCount(0);
    const inquiry = page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" });
    await expect(inquiry.getByText("Nueva")).toBeVisible();
    await expect(page.getByRole("group", { name: "Filtrar por casa" })).toHaveCount(0);
    // «Abrir WhatsApp» marca la consulta como abierta y el contador de la pestaña baja (caso movido de consultas.spec.ts).
  });
  test("7b · con dos casas: una tarjeta por casa; la que no está activa muestra solo su estado", ...);
  test("7c · sin casa activa ni consultas: un único mensaje", ...); // expects the empty copy and no «Últimas consultas»
  ```
  Port the still-valid cases of `consultas.spec.ts` (WhatsApp URL with the client's number, offline from cache, badge going down, badge gone after sign-out) into this file; drop the chip-filter and «Compartir ficha» empty-state cases.
- [ ] **Step 2: Run** `pnpm build && CHROMIUM_PATH=… pnpm test:e2e tests/e2e/navegacion.spec.ts` → FAIL (route not found / heading missing).
- [ ] **Step 3: Implement** the screen, routes, CSS (`.activity-figures` three columns, `.activity-figures.lg` larger Outfit numbers, `.activity-card` row), size-limit edits; delete `consultas.tsx`; in `fase3.spec.ts` replace the `inquiries-title` / «Mis consultas» steps with `goto("/propietario/actividad")`, the Actividad heading and `nav.getByRole("link", { name: /Actividad/ })`.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm test && pnpm build && pnpm size && CHROMIUM_PATH=… pnpm test:e2e tests/e2e/navegacion.spec.ts tests/e2e/fase3.spec.ts` → PASS.
- [ ] **Step 5: Commit**
  ```
  git add -A apps/app/src/client/screens/actividad.tsx apps/app/src/client/screens/consultas.tsx apps/app/src/client/shell.tsx apps/app/src/client/chrome.tsx apps/app/src/styles/global.css apps/app/.size-limit.json apps/app/src/domain/inquiry.ts apps/app/tests/unit/inquiry.test.ts apps/app/tests/e2e/navegacion.spec.ts apps/app/tests/e2e/consultas.spec.ts apps/app/tests/e2e/fase3.spec.ts
  git commit -m "Sustituye Mis consultas por Actividad: cifras de 30 días por casa y últimas consultas"
  ```

## Task 6: Mis casas — single house as tab root, list for two or more, one notice card; Inicio deleted

**Files:** modify `src/client/screens/propietario.tsx`, `src/client/shell.tsx`, `src/client/chrome.tsx`, `src/styles/global.css`; tests `tests/e2e/navegacion.spec.ts` (flow 3 and the `/propietario` redirect), `tests/e2e/propietario.spec.ts`, `tests/e2e/estados-suscripcion.spec.ts`, `tests/e2e/suscripcion.spec.ts`, `tests/e2e/publicar.spec.ts`, `tests/e2e/fase5.spec.ts`.

**Interfaces**
- Consumes: `casasView`, `noticeFor`, `Notice` (Task 1); `useBilling`, `ownListingsQuery`.
- Produces:
  - `CasasScreen()` renders by `casasView(list.length)`: `"single"` → `ScreenTitle`-style `RootHeader title={titleOf(l)} action={«Ver ficha» when can(l,"share")}` + `<NoticeCard notice />` + `<Detail listing={l} userId shown={notice} />` + `<Link to="/propietario/publicar" className="btn btn-ghost btn-block">Añadir otra casa</Link>`; `"list"` → today's list (tiles, `OwnerCard`s, «Nueva») with `<NoticeCard />` on top; `"none"` → nothing (the owner guard of Task 7 redirects).
  - `function NoticeCard({ notice, list, billing }: { notice: Notice | null; list: Listing[]; billing: Billing | null }): JSX.Element | null` — `payment` → today's `PayNotice` with the house title; `resume` → today's `ResumeCard` without the `more` line.
  - `Detail({ listing, userId, shown }: { listing: Listing; userId: string; shown?: Notice | null })` — omits its `PayNotice` when `shown?.kind === "payment"` and its «Le pedimos cambios» card when `shown?.kind === "resume"` for the same listing, so nothing repeats. At `/propietario/casas/$id` `shown` is undefined and Detail is as today.
  - Route `/propietario` becomes `redirect({ to: "/propietario/casas", replace: true })` (child of `rootRoute`); the interim OWNER bar in `chrome.tsx` drops its «Inicio» entry (four tabs until Task 7).
- Deleted: `InicioScreen`, `InquiriesCard`, `FeaturedCard`, `FeaturedAction`, `ShareBlock`, `OfferCard`, `tierOf`, the `more` prop of `ResumeCard`. `StatsLine` stays (Detail uses it). Unused imports (`LAUNCH_TIERS`, `launchOffer`, `promoRunning`, `relativeDate`, `offerTakenQuery` if only `EnviadaScreen` keeps it) are removed accordingly.

- [ ] **Step 1: Write the failing tests** in `navegacion.spec.ts`:
  ```ts
  test("/propietario lleva a Mis casas sin quedar en el historial", ...); // same history.length check as flow 6
  test("3 · una casa: su detalle como raíz de la pestaña; con una segunda, la lista", async ({ page }) => {
    await h.reset();
    const sola = await h.seed({ status: "draft", draft: { title: "Casa Puerto Viejo" } });
    await page.goto("/propietario/casas");
    await expect(page.getByRole("heading", { level: 1, name: "Casa Puerto Viejo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver" })).toHaveCount(0);
    await expect(page.getByTestId("resume-card").getByRole("link", { name: "Seguir publicando" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Añadir otra casa" })).toHaveAttribute("href", "/propietario/publicar");
    await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.locator("[data-testid=resume-card], [data-testid=pay-notice]")).toHaveCount(1);
  });
  test("la casa abierta desde la lista se queda aunque se descarte la otra", ...); // open /propietario/casas/<active.id>, discard the draft via h, refetch: still the detail, back arrow present
  ```
  In `propietario.spec.ts` rewrite «Inicio y Mis casas…» as «Mis casas: estado, nota del admin y, sin red, desde la caché» (drop Inicio, greeting, offer and «5 en total»; the resume card is now on Mis casas, without «y 2 borradores más»); change «visitas y consultas de 30 días en Inicio…» to the detail only. In `estados-suscripcion.spec.ts` the two `/propietario` Inicio cases become Mis casas cases: the pay notice and its priority (the `offer-left` assertions are deleted — no launch-offer card, decided in the spec). `suscripcion.spec.ts:30` and `publicar.spec.ts:55` use `/propietario/casas`.
- [ ] **Step 2: Run** `pnpm build && CHROMIUM_PATH=… pnpm test:e2e tests/e2e/navegacion.spec.ts` → FAIL.
- [ ] **Step 3: Implement** as above.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm test && pnpm build && pnpm size && CHROMIUM_PATH=… pnpm test:e2e tests/e2e/navegacion.spec.ts tests/e2e/propietario.spec.ts tests/e2e/estados-suscripcion.spec.ts tests/e2e/suscripcion.spec.ts tests/e2e/publicar.spec.ts tests/e2e/fase5.spec.ts` → PASS. The «Pantallas de las pestañas» entry must be **below** its pre-change 24.47 KB (Inicio + OfferCard out).
- [ ] **Step 5: Commit**
  ```
  git add apps/app/src/client/screens/propietario.tsx apps/app/src/client/shell.tsx apps/app/src/client/chrome.tsx apps/app/src/styles/global.css apps/app/tests/e2e/navegacion.spec.ts apps/app/tests/e2e/propietario.spec.ts apps/app/tests/e2e/estados-suscripcion.spec.ts apps/app/tests/e2e/suscripcion.spec.ts apps/app/tests/e2e/publicar.spec.ts apps/app/tests/e2e/fase5.spec.ts
  git commit -m "Mis casas: una casa se ve directa, dos o más en lista, con un solo aviso arriba; quita Inicio"
  ```

## Task 7: One growing bar, no role switch, Cuenta as a full screen, landing after login

**Files:** modify `src/client/chrome.tsx`, `src/client/shell.tsx`, `src/client/screens/cuenta.tsx`, `calendario.tsx`, `suscripcion.tsx`, `propietario.tsx`, `publicar.tsx`, `src/styles/global.css`; delete `src/client/role.ts`, `tests/unit/role.test.ts`; tests `navegacion.spec.ts` (flows 1, 2, 4 and the no-flicker checks), `cuenta.spec.ts`, `shell.spec.ts`, `explorar.spec.ts`, `admin.spec.ts`.

**Interfaces**
- Consumes: `tabsFor`, `ownerZoneRedirect` (Task 1), `useListingsCount`, `ownListingsQuery` (Task 4), `countNew`, `inquiriesQuery`.
- Produces:
  - `TabsFrame({ children })`: `adminZone = pathname.startsWith("/admin")`; `tabs = tabsFor({ session: status !== "signed-out", isAdmin: adminZone, listingsCount: count })`; maps `icon` to `I[icon]`; badge `"review"` → `useReviewCount`, `"inquiries"` → `useNewInquiries(enabled = tabs has the inquiries badge)` (fetches on every tab screen for owners). `aria-label` «Actividad, N nuevas» as today's Consultas. Class `tabbar two` when 2 tabs (`.tabbar.three` rule renamed).
  - `OwnerOutlet` (layout route `id: "_owner"` under `privateRoutes`, parent of `/propietario/casas`, `/propietario/calendario`, `/propietario/actividad`): `const { count, fromData, fetching } = useListingsCount(); if (fromData && ownerZoneRedirect(count, fetching)) return <Navigate to="/explorar" replace />; return <Outlet />`.
  - `FlowHeader` gains `onBack?: () => void` (the `Link` keeps `back` as href; with `onBack` the click is `preventDefault` + `onBack()`).
  - `CuentaScreen`: both states in `FlowFrame` (no bottom bar). Signed in: `FlowHeader title="Cuenta" back="/explorar" onBack={() => canGoBack ? router.history.back() : navigate({ to: count ? "/propietario/casas" : "/explorar" })}` (`useCanGoBack()` from `@tanstack/react-router`).
  - `MyAccount`: `owner = (count ?? 0) > 0` from `useListingsCount()`; subscription card, payment row and owner help line keyed on `owner`; «Mi perfil» row when `!owner`; admin row unchanged (`a?.isAdmin`). Removed: `useRole`, `setRole`, `switchRole`, «Buscar una casa» row, the «¿Tiene una casa en el Caribe?» card, the Favoritos row (it is a tab for everyone now). Added when `count === 0` (data known): `<Link to="/propietario/publicar" className="list-item">` with `I.house`, body «Publicar mi casa<small>Sin comisiones: los clientes le escriben por WhatsApp</small>», chevron.
  - `AyudaScreen`: `SUPPORT[(useListingsCount().count ?? 0) > 0 ? "owner" : "guest"]`.
  - `CodeForm.verify` (landing): after `setQueryData(accountQuery…)`, `const list = await queryClient.fetchQuery(ownListingsQuery(account.id)).catch(() => [])`; then if `mode === "register" && !account.email && !contact` → `/cuenta/lista` as today; else `goTo(next ?? (list.length ? "/propietario/casas" : "/explorar"))`. `ListaScreen` keeps its own target.
  - `shell.tsx`: `prefetchTabs` uses `ownListingsHint() > 0 || location.pathname.startsWith("/propietario")` and prefetches the `actividad` chunk instead of `consultas`; `onSignedOut` and `AdminOutlet` no longer touch a role.
  - Every `setRole(...)`/`useOwnerMode()` call is removed (`calendario.tsx:69`, `suscripcion.tsx:310`, `propietario.tsx`, `publicar.tsx:24,138`, `cuenta.tsx:349,527,532`); `useOwnerMode` is deleted.

- [ ] **Step 1: Write the failing tests** in `navegacion.spec.ts`:
  ```ts
  const nav = (p: Page) => p.getByRole("navigation", { name: "Navegación principal" });
  // addInitScript: a MutationObserver pushes nav.querySelectorAll("a").length to window.__tabCounts whenever it changes.
  test("1 · sin sesión: dos pestañas e «Ingresar» arriba", async ({ page }) => {
    await page.goto("/explorar");
    await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos"]);
    await expect(page.getByRole("banner").getByRole("link", { name: "Ingresar" })).toBeVisible();
  });
  test("2 · sin casas: dos pestañas; «Publicar mi casa» crea un borrador, cinco pestañas y Mis casas muestra el borrador", async ({ page }) => {
    await h.reset(); // ninguna casa de «other»
    // ingresar por la interfaz con 8888 1234 (TEST_PHONES.other) y enterCode(page)
    await expect(page).toHaveURL(/\/explorar$/);
    await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos"]);
    await page.getByRole("banner").getByRole("link", { name: /Cuenta|^[A-Z]{1,2}$/ }).click();
    await page.getByRole("link", { name: /Publicar mi casa/ }).click();
    await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
    await page.goto("/propietario/casas");
    await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos", "Mis casas", "Calendario", "Actividad"]);
    await expect(page.getByTestId("resume-card").getByRole("link", { name: "Seguir publicando" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Publicar mi casa/ })).toHaveCount(0); // en Cuenta, ya con una casa (comprobar tras volver a /cuenta)
  });
  test("el propietario entra y la barra no salta; al volver a abrir, cinco desde el primer pintado", async ({ page }) => {
    // owner con una casa sembrada; ingresar por la interfaz → URL /propietario/casas; window.__tabCounts filtrado desde ese momento = [5]
    // reload → __tabCounts = [5]
  });
  test("4 · al descartar las dos casas vuelve a dos pestañas y a Explorar", async ({ page }) => {
    // dos borradores; en la lista, «Descartar» el primero (confirm aceptado) → vista de una casa; «Descartar borrador» en el detalle raíz
    await expect(page).toHaveURL(/\/explorar$/);
    await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos"]);
  });
  test("Cuenta se abre a pantalla completa, sin barra inferior, y la flecha vuelve adonde estaba", ...);
  ```
  Existing specs: `shell.spec.ts:26-29` and `explorar.spec.ts:287-290` stop clicking «Mi cuenta» in the bar and use the account button in the top bar (Cuenta has no tab, so the `aria-current` assertion goes); `cuenta.spec.ts:184` «modo propietario y vuelta a cliente…» becomes «el canal de ayuda sigue a las casas: sin casas, el de clientes; con una, el de propietarios»; other `cuenta.spec.ts` steps that read the Cuenta tab use the top-bar button; `admin.spec.ts:166-175` becomes: from `/admin` the «Cuenta» tab opens the full-screen Cuenta, its back arrow returns to `/admin` with the admin bar, and `/explorar` shows the bar of the admin's listings (seed one listing for the admin's number: 5 tabs).
- [ ] **Step 2: Run** `pnpm build && CHROMIUM_PATH=… pnpm test:e2e tests/e2e/navegacion.spec.ts` → FAIL.
- [ ] **Step 3: Implement** as above; delete `role.ts` and `role.test.ts`; `grep -rn "role\"\|setRole\|useRole\|bnbtico-role" apps/app/src` must return nothing.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm test && pnpm build && pnpm size && CHROMIUM_PATH=… pnpm test:e2e tests/e2e/navegacion.spec.ts tests/e2e/cuenta.spec.ts tests/e2e/shell.spec.ts tests/e2e/explorar.spec.ts tests/e2e/admin.spec.ts tests/e2e/calendario.spec.ts tests/e2e/contacto-cuenta.spec.ts` → PASS.
- [ ] **Step 5: Commit**
  ```
  git add -A apps/app/src/client apps/app/src/styles/global.css apps/app/tests/unit/role.test.ts apps/app/tests/e2e/navegacion.spec.ts apps/app/tests/e2e/cuenta.spec.ts apps/app/tests/e2e/shell.spec.ts apps/app/tests/e2e/explorar.spec.ts apps/app/tests/e2e/admin.spec.ts
  git commit -m "Una sola barra que crece con las casas: quita el cambio de modo y abre Cuenta a pantalla completa"
  ```

## Task 8: Top bar with logo · ₡ | $ · account, and the switch on the ficha

**Files:** create `src/shared/currency-switch.tsx` (moved), `tests/unit/currency-switch-ssr.test.tsx`; delete `src/client/currency-switch.tsx`; modify `src/client/chrome.tsx`, `src/client/screens/explorar.tsx`, `src/client/screens/cuenta.tsx`, `src/shared/listing-page.tsx`, `src/styles/global.css`; tests `navegacion.spec.ts` (flow 5), `ficha.spec.ts`, `tipo-de-cambio.spec.ts`, `explorar.spec.ts`.

**Interfaces**
- Produces:
  ```ts
  // shared/currency-switch.tsx
  export function CurrencySwitch({ className }: { className?: string }): JSX.Element; // same markup as today (role=group, «Moneda de los precios», buttons «Colones» ₡ / «Dólares» $)
  /** En el servidor y al hidratar, una caja del mismo tamaño; después, el selector. */
  export function CurrencySwitchSlot({ className }: { className?: string }): JSX.Element; // !useHydrated() → <span className={`currency-switch currency-switch-box ${className ?? ""}`} aria-hidden="true" />
  // client/chrome.tsx
  export function TopBar(): JSX.Element;
  ```
- `TopBar`: `<header className="topbar">` (role banner), fixed, `height: calc(56px + env(safe-area-inset-top))`, `padding-top: env(safe-area-inset-top)`, centred to `max-width: 560px` like `.tabbar`. Left: `<Link to="/explorar" aria-label="bnbtico, inicio"><img src="/logo-horizontal.png" alt="bnbtico" width={150} height={38} /></Link>` (the terracota horizontal logo already served from `public/`; `design/logo/README.md`: terracota on crema, 38 px high). Right: `<CurrencySwitch />` then the account control in a fixed 44×44 min box: signed out → `<Link to="/cuenta" className="btn btn-ghost btn-header">Ingresar</Link>`; signed in → `<Link to="/cuenta" className="avatar avatar-sm topbar-account" aria-label="Cuenta">{initials(name)}</Link>` (empty circle while `accountQuery` loads); `loading` → the same box, invisible (`is-hidden`, `aria-hidden`, `tabIndex -1`) as Explorar's header does today. `initials` comes from `domain/person.ts` (already split from `inquiry.ts` so it does not pull the inquiries domain into the initial JS); `cuenta.tsx` drops its local copy and imports the same one (its rule «first + second word» becomes «first + last word», same as the inquiry cards).
- `TabsFrame` renders `<TopBar />` and `main.view.has-topbar` except in the admin zone; `UnderTopBar` context (`createContext(false)`) set by `TabsFrame`; `RootHeader` under it drops the logo link and renders the `.top` row only when `action` exists.
- CSS: `.view.has-topbar{padding-top:calc(56px + 12px + env(safe-area-inset-top))}`; `.topbar .currency-switch button, .listing-view .currency-switch button{min-height:44px}`; `.currency-switch-box{display:inline-block;width:<rendered width>px;height:50px}` (measure the rendered switch once and pin both sizes; e2e asserts equality).
- Explorar: `Header` becomes `<RootHeader title={<>¿Para dónde <span className="primary">va</span>?</>} />`; the `<CurrencySwitch />` in the results line is removed (the row keeps `results-count`).
- Cuenta: the «Moneda» row and the `fx-credit` paragraph are removed (with `useFx`, `FX_ATTRIBUTION`, `fxDayLabel`, `fxRateLabel` imports); the attribution stays in Explorar's `UsdNote`, where dollars are shown.
- Ficha (`ListingPage`): in the hero's right group, `<CurrencySwitchSlot className="overlay" />` before share and favorite (hidden in `preview`). Server always renders colones (`useCurrency` server snapshot `"CRC"`, unchanged).
- **Size gate fallback** (spec, Daniel 2026-10-27): if `pnpm size` fails on «Pantallas de las pestañas» or on the initial JS after this task, remove `<CurrencySwitch />` from `TopBar` and put it back at the end of Explorar's results line (`row between small muted`); the ficha keeps its slot. Do not raise any limit. Record the outcome in the decision entry (Task 9).

- [ ] **Step 1: Write the failing tests.** `tests/unit/currency-switch-ssr.test.tsx` (pattern of `contact-button.test.tsx`, `renderToString` inside `QueryClientProvider`):
  ```ts
  it("la ficha del servidor lleva la caja de la moneda, no los botones", () => {
    const html = renderToString(<Providers><ListingPage listing={listing()} base="https://bnbtico.com" /></Providers>);
    expect(html).toContain('<span class="currency-switch currency-switch-box overlay" aria-hidden="true"></span>');
    expect(html).not.toContain('aria-label="Dólares"');
  });
  ```
  `navegacion.spec.ts`:
  ```ts
  test("5 · ₡ → $ arriba cambia los precios de Explorar y de la ficha y se mantiene al recargar", async ({ page }) => {
    const casa = await h.seed({ status: "active", draft: { title: "Casa Playa Negra", nightlyPriceCrc: 95000 } });
    await page.goto("/explorar");
    await page.getByRole("banner").getByRole("button", { name: "Dólares" }).click();
    await expect(page.getByRole("link", { name: /Casa Playa Negra/ })).toContainText("$");
    await page.getByRole("link", { name: /Casa Playa Negra/ }).click();
    await expect(page.getByTestId("main-price")).toHaveText(/^\$/);
    await expect(page.getByRole("button", { name: "Dólares" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
    await expect(page.getByTestId("main-price")).toHaveText(/^\$/);
    await page.getByRole("button", { name: "Colones" }).click();
    await expect(page.getByTestId("main-price")).toHaveText(/^₡/);
  });
  test("la barra superior: 56 px más el área segura, y los botones de al menos 44 px", ...);
  ```
  `ficha.spec.ts`: in «la ficha real llega renderizada del servidor…» the source assertion becomes `'<div class="row gap-8"><span class="currency-switch currency-switch-box overlay" aria-hidden="true"></span><span class="icon-btn" aria-hidden="true"></span><span class="icon-btn" aria-hidden="true"></span></div>'`, and after hydration the `group` «Moneda de los precios» bounding box equals the box measured before hydration (use the held-photo setup of the «ni hidratar ni cambiar de moneda…» test, whose name drops «, y no hay botón de moneda» — its `/Ver en/` assertions stay). `tipo-de-cambio.spec.ts`: delete «Mi cuenta: el tipo y su día junto a «Moneda»…» and the `#currency-label` lines of «con la fuente principal…». `explorar.spec.ts`: switch clicks move from the results line to `getByRole("banner")`.
- [ ] **Step 2: Run** `pnpm test tests/unit/currency-switch-ssr.test.tsx` → FAIL; `pnpm build && CHROMIUM_PATH=… pnpm test:e2e tests/e2e/navegacion.spec.ts -g "5 ·"` → FAIL.
- [ ] **Step 3: Implement** as above.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm test && pnpm build && pnpm size && CHROMIUM_PATH=… pnpm test:e2e tests/e2e/navegacion.spec.ts tests/e2e/ficha.spec.ts tests/e2e/tipo-de-cambio.spec.ts tests/e2e/explorar.spec.ts tests/e2e/favoritos.spec.ts tests/e2e/estados-suscripcion.spec.ts` → PASS (the last one holds «parada, pendiente de pago y en edición, sin avisos de hidratación»).
- [ ] **Step 5: Commit**
  ```
  git add -A apps/app/src/shared/currency-switch.tsx apps/app/src/client/currency-switch.tsx apps/app/src/client/chrome.tsx apps/app/src/client/screens/explorar.tsx apps/app/src/client/screens/cuenta.tsx apps/app/src/shared/listing-page.tsx apps/app/src/styles/global.css apps/app/tests/unit/currency-switch-ssr.test.tsx apps/app/tests/e2e/navegacion.spec.ts apps/app/tests/e2e/ficha.spec.ts apps/app/tests/e2e/tipo-de-cambio.spec.ts apps/app/tests/e2e/explorar.spec.ts
  git commit -m "Añade la barra superior con logo, ₡ | \$ y la cuenta, y el selector de moneda en la ficha"
  ```

## Task 9: Documentation of the same day

**Files:** `docs/decisiones.md`, `docs/diseno-v1.md`, `CLAUDE.md`, `docs/pruebas-manuales-revision-ux.md`.

- [ ] **Step 1: `docs/decisiones.md`** — new entry at the very top, `## 2026-10-27 · Navegación simple: una barra que crece, Cuenta arriba y «Actividad»`, «Decisión de Daniel.», bullets: single bottom bar (2 tabs without listings, 5 with at least one in any state; never more than 5); owner derived from having listings (owner-listings query + `bnbtico-mis-casas` as first-paint hint), `bnbtico-role` and «cambiar de vista» removed; admin bar only inside `/admin`; Cuenta in the top corner as a full screen; ₡ | $ in the top bar and on the ficha (fixed box until hydration, preference in `bnbtico_currency`), out of Explorar's results line and of Cuenta (or the fallback outcome if the size gate applied, with the measured sizes); Actividad (`owner_activity()`) replaces Inicio and Mis consultas, `/propietario` and `/propietario/consultas` redirect; one listing = its detail as the tab root; no launch-offer card. «Sustituye» line: N2 of `.scratch/revision-ux/2026-10-26-revision-ux.md` and the bar of `docs/diseno-v1.md`. Spec: `.scratch/navegacion-simple/spec.md`.
- [ ] **Step 2: `docs/diseno-v1.md`** — l.12 «Cabecera»: top bar on the five tab screens (logo · ₡ | $ · iniciales o «Ingresar», 56 px + área segura); l.13 «Barra inferior»: the two bars and the admin one, never more than five; item 1 Explorar: no «₡ · $» in the results line; item 8 Mi cuenta and item 16 Cuenta (propietario): full screen from the top bar, «Publicar mi casa» row with zero listings, no Moneda row; item 9 Inicio and item 14 Mis consultas: replaced by «Actividad» (describe it); item 10 Mis casas: one listing shows its detail directly, one notice card at most; note that `design/pantallas/09-prop-inicio.html` and `20-prop-cuenta.html` are superseded for the nav (2026-10-27).
- [ ] **Step 3: `CLAUDE.md`** — «Propietario → cliente: desde Mis consultas, directo a WhatsApp» → «Propietario → cliente: desde Actividad, directo a WhatsApp».
- [ ] **Step 4: `docs/pruebas-manuales-revision-ux.md`** — new section `### Navegación simple (2026-10-27)` with a U-numbered table (next free numbers after the last row) covering, on the phone: the seven flows of the spec (no session; client without listings → «Publicar mi casa» → five tabs and the draft detail; second listing → list; deleting both → Explorar with two tabs; ₡ → $ in Explorar and on the ficha, kept after reload; an old reminder link `/propietario/consultas`; Actividad with one active listing), plus «al volver a abrir la app instalada, la barra no salta». Mark U31–U36 of «Propietaria con casa activa» as superseded where they mention Inicio or Consultas.
- [ ] **Step 5: Commit**
  ```
  git add docs/decisiones.md docs/diseno-v1.md CLAUDE.md docs/pruebas-manuales-revision-ux.md
  git commit -m "Documenta la navegación simple: decisión, diseño v1, reglas y plan de pruebas manual"
  ```

## Task 10: Final verification

- [ ] **Step 1:** `pnpm db:reset` (repo root), then from `apps/app`: `pnpm typecheck` → no errors.
- [ ] **Step 2:** `pnpm test` → all unit and fake-contract tests pass.
- [ ] **Step 3:** `pnpm test:db` → all DB and PostgREST-contract tests pass.
- [ ] **Step 4:** `pnpm build && pnpm size` → every entry under its limit; record «Zona privada · JS inicial», «Pantallas de las pestañas» and «Actividad» sizes for the decision entry (amend Task 9's entry only if the numbers are missing, in a new commit «Anota los tamaños de la navegación simple»).
- [ ] **Step 5:** `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e` → the whole suite passes on one worker.
- [ ] **Step 6:** `pnpm lighthouse` → the gates pass (ficha cold < 2.0 s, installed shell < 2.5 s).
- [ ] **Step 7:** from the repo root, `pnpm test:prototype` → all `tests/prototype/*.cjs` pass (the prototype is untouched).
- [ ] **Step 8:** `grep -rn "Mis consultas\|InicioScreen\|ConsultasScreen\|bnbtico-role\|setRole" apps/app/src` → nothing; `git status` → clean; do not push.
