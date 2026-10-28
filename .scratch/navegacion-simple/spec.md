# Spec · Navegación simple: una barra que crece, Cuenta arriba y «Actividad»

Status: needs-triage
Date: 2026-10-27
Decided by: Daniel, in the brainstorming of 2026-10-27 («Mejoras fase R y 3», project 1 of 4).
Language note: technical artifact in English; all UI copy in Spanish de Costa Rica, treating the user as **usted**.
Supersedes: the bottom bar of `docs/diseno-v1.md` (l.13, l.31, l.38), the nav of `design/pantallas/09-prop-inicio.html` and `20-prop-cuenta.html`, and decision N2 of `.scratch/revision-ux/2026-10-26-revision-ux.md` («las pestañas del propietario nunca se ocultan»).

## Problem Statement

The app must be learnable at a glance. Today it has two separate bottom bars and a role switch:

- Client: Explorar · Favoritos · Mi cuenta.
- Owner: Inicio · Mis casas · Calendario · Consultas · Cuenta, reached by switching role (`client/role.ts`, `bnbtico-role` in localStorage).

Problems:

- An owner who also looks for houses has to switch role to reach Explorar.
- «Inicio» repeats what Mis casas already shows.
- «Mis consultas» reads as an inbox, but every conversation happens in WhatsApp.
- The ₡/$ switch lives only in Explorar's header and in a Cuenta row, so it is not at hand while browsing or on the ficha.
- An owner with a single house sees a list with one item and must tap once more to reach it.

## Solution

### Bars

| Who | Bottom bar | Top bar |
|---|---|---|
| No session, or a client (zero listings) | Explorar · Favoritos | logo · ₡ \| $ · «Ingresar» or account button |
| Owner = at least one listing in **any** state (draft included) | Explorar · Favoritos · Mis casas · Calendario · Actividad | same |
| Admin | unchanged (Anuncios · Casas · Usuarios · Cuenta) | unchanged |

- **Never more than 5 bottom tabs** (Daniel, 2026-10-27). New sections go in Cuenta or inside an existing tab, never as a sixth tab. If space is short, only the top bar gives way (see Gates).
- **Owner is derived, not chosen.** A user is an owner while the owner-listings query (already persisted in IndexedDB) returns at least one listing. Deleting the last listing turns them back into a client and the owner tabs disappear.
- Optimistic create/delete updates that list, so the bar changes instantly.
- With no cache yet (first load after login), show the client bar until the list arrives. Later loads read the cached list, so the bar does not jump.
- The role switch is removed: `role.ts` owner/guest logic, the `bnbtico-role` key and the «cambiar de vista» control (`cuenta.tsx` `switchRole`). Admin detection (`is_admin` + aal2) stays as it is.
- Explorar and Favoritos are the same screens for everyone.
- The new-inquiries counter moves from «Consultas» to the **Actividad** tab.
- **Landing after login:** an owner goes to Mis casas, anyone else to Explorar.
- If the user stops being an owner while on Mis casas, Calendario or Actividad, redirect to Explorar.

### Routes

- New: `/propietario/actividad` (tab).
- `/propietario` redirects to `/propietario/casas`, and `/propietario/consultas` redirects to `/propietario/actividad`. Both use `replace`, so links already sent in WhatsApp reminders keep working.
- `InicioScreen`, `ConsultasScreen` and their helpers (`ResumeCard`, `InquiriesCard`, `FeaturedCard`, `StatsLine`, `OfferCard`, consultas chips) are deleted. What survives is moved, not duplicated.

### Top bar (`TopBar`, in `client/chrome.tsx` next to `TabsFrame`)

- 56 px tall, fixed, padded with `env(safe-area-inset-top)`.
- Left: horizontal logo from `design/logo/` (`bnbtico-horizontal-terracota.png` or the variant that matches the bar colour; check `design/logo/README.md`).
- Right: `CurrencySwitch` (existing component, moved here), then the account button. The account button shows the initials in a circle with a session, or «Ingresar» without one. Both have a touch target of at least 44 px.
- Shown on the five tab screens. Explorar's own header (zone/search) sits below it.
- Removed: the switch in Explorar's header (`explorar.tsx` l.105) and the «Moneda» row in Cuenta (`cuenta.tsx` l.619-627).
- The account button opens **the existing Cuenta screen** (`/cuenta`) as a full screen with a back arrow, not as a tab. Without a session, «Ingresar» goes to the WhatsApp code flow.
- Cuenta gains a **«Publicar mi casa»** row, shown only to users with zero listings, linking to `/propietario/publicar`.

### Ficha (`/casa/CT-####`)

- Its header (back · share · favorite) gains the same ₡ | $ switch.
- The switch mounts after hydration inside a fixed-size box. The server always renders colones, as now (`shared/currency.ts`).
- The existing hydration test must stay green.
- The preference stays in localStorage `bnbtico_currency`. It is not stored in the profile.

### Mis casas

- **One listing:** the tab shows the house detail directly (today's `CasaPropietarioScreen` content), as the tab root with no back arrow, and a secondary «Añadir otra casa» button at the end.
  - A draft counts as a listing, so a sole draft shows its detail with «Seguir publicando».
- **Two or more listings:** the list, as today.
- The switch between single and list is derived from the same owner-listings query. Going from one listing to two, or from two to one, re-renders automatically.
- A house detail opened from the list at `/propietario/casas/$id` stays put if the other listing is deleted.
- **Notice card at the top, only when needed, at most one.** Priority:
  1. Payment notice («Añadir método de pago», same rules and `#pago=` link as today's `PayNotice`).
  2. «Seguir publicando» for a draft or a listing with changes requested (today's `ResumeCard`).
- No launch-offer card. Each house already shows its state («Gratis hasta…»), and «Promoción y suscripción» in Cuenta keeps the detail.

### Actividad (`/propietario/actividad`)

From top to bottom:

1. Title «Actividad», subtitle «Últimos 30 días».
2. Figures:
   - **Two or more listings:** one card per listing with a small photo, name, `CT-####` and three tabular figures: **visitas · toques en WhatsApp · consultas**. A non-active listing shows only its state («En revisión», «Pendiente de pago», …) and no figures.
   - **One listing:** no card. The three figures are shown large. If the listing is not active, show its state and the empty message instead.
3. **«Últimas consultas»:** the 20 most recent inquiries, with today's cards: initials, name, «Nueva» badge, house · dates · people, message, «Abrir WhatsApp». The per-house filter chips are dropped. Opening WhatsApp marks the inquiry as opened, as today.
4. **Empty** (no active listing and no inquiries): one message only, «Cuando su casa esté activa verá aquí cuántas personas la visitan y le escriben».

## Data

- **New RPC `owner_activity()`**, `security definer`, granted to `authenticated` only.
  - Returns one row per listing owned by `auth.uid()`: `listing_id, public_id, views, whatsapp_taps, inquiries`.
  - All three counts cover the last 30 days. Views count `events.name = 'listing_view'`, WhatsApp taps count `events.name = 'whatsapp_tap'`, both joined on `listing_public_id`. Inquiries count rows in `inquiries`.
  - One call per screen, per the «una función de consulta por pantalla» rule.
  - It is a new migration (`pnpm exec supabase migration new owner_activity < /dev/null`). Types are regenerated with `supabase gen types`.
- `ListingsApi` (`domain/api.ts`) gains `ownerActivity()`, implemented in both the PostgREST adapter (`data/postgrest/owner.ts`) and the in-memory fake.
- `owner_listing_stats(p_listing)` stays for the house detail.
- Inquiries keep coming from `inquiriesQuery` (`client/inquiries.ts`). The screen shows the first 20, and `countNew` keeps feeding the tab badge.
- No change to `events` collection: the ficha already sends `listing_view` and `whatsapp_tap`.

## Pure domain function

`domain/navigation.ts`, with no framework imports:

- `tabsFor({ session, isAdmin, listingsCount }) → Tab[]`
- `casasView(listingsCount) → "single" | "list" | "none"`
- `noticeFor(listings, subscriptions) → "payment" | "resume" | null`

The UI only renders what these functions return.

## Testing (test first)

- **Vitest** (`domain/navigation.ts`):
  - Tabs for no session, a client, an owner with a draft and an admin.
  - Single vs list.
  - Notice priority: payment over resume.
- **DB test** (`test:db`):
  - `owner_activity()` returns only the caller's listings.
  - An anonymous caller is rejected.
  - The counts respect the 30-day window.
- **Contract suite:** `ownerActivity()` against PostgREST and the fake.
- **Playwright** (mobile viewport, one worker):
  1. No session: 2 tabs and «Ingresar» in the top bar.
  2. Log in with a test number without listings: 2 tabs. «Publicar mi casa» from Cuenta creates a draft, after which there are 5 tabs and Mis casas shows the draft detail directly.
  3. A second listing turns Mis casas into a list.
  4. Deleting both returns to 2 tabs, and the user lands on Explorar.
  5. ₡ → $ in the top bar changes prices in Explorar and in the ficha, and persists after reload.
  6. `/propietario/consultas` redirects to `/propietario/actividad`.
  7. Actividad with one active listing shows the three figures and the inquiries list.
- **Gates:**
  - `size-limit`: the tab-screens bundle stays under 24.5 KB. Deleting Inicio and Consultas pays for TopBar and Actividad.
  - **If it does not fit** (decided by Daniel 2026-10-27): the top bar keeps only the logo and the account button, and the ₡ | $ switch goes back to Explorar's results line. The ficha keeps its switch. Do not raise the limit for this.
  - Hydration test on the ficha.
  - Lighthouse.
- Prototype tests (`tests/prototype/*.cjs`) must still pass. The prototype is not changed.

## Documentation (same day as the change)

- `docs/decisiones.md`: new entry at the top recording the single growing bar, owner derived from having listings, Cuenta in the top corner, ₡/$ in the top bar and on the ficha, Actividad replacing Inicio and Consultas, and single-house view without a list. It supersedes N2 and the diseño v1 bar.
- `docs/diseno-v1.md`: update the bar, Inicio, Consultas and Cuenta sections, with a note that `09-prop-inicio`/`20-prop-cuenta` are superseded for the nav.
- `CLAUDE.md`: «Propietario → cliente: desde Mis consultas» becomes «desde Actividad».
- `docs/pruebas-manuales-revision-ux.md`: add the manual walk-through (the 7 Playwright flows, on the phone).

## Out of scope

- Admin bar and screens.
- Desktop pass (on hold per decision 2026-10-27).
- Projects 2–4 of the same brainstorming, which get their own specs:
  - cascading location with a zone list,
  - drag-to-reorder photos,
  - «Acepta alquiler mensual» as a feature with an optional price.
- Rating clients (future). The inquiries list in Actividad is kept partly so it has a place later.
