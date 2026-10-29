# Spec · Suscripción por casa, Cuenta más clara y Actividad con la casa de cada consulta

Status: ready-for-agent (approved by Daniel 2026-10-29, with mockups design/pantallas/v2/)
Date: 2026-10-28
Decided by: Daniel, question by question on 2026-10-28/29, from Ana's emails of 2026-10-28. Authority: `.scratch/ronda-ana-2026-10-28/decisiones.md`, sections **F** (suscripción y cuenta) and **G** (actividad).
Language note: technical artifact in English; all UI copy in Spanish de Costa Rica, treating the user as **usted**.
Supersedes:
- `CLAUDE.md` «En v1 no se muestra nada de identidad» (Reglas de producto, Veriff bullet): **only** for the informative line of §3; Veriff stays out of v1.
- `docs/diseno-v1.md` §8 «Mi cuenta» and §16 «Cuenta (propietario)» (l.27 and l.38: «cerrar sesión» in the list, no identity), §9 «Actividad» (l.31: «Últimas consultas … sin filtros por casa») and §14 (l.36: card «casa · fechas · personas»).
- The decision dropping the per-house chips of Actividad (`.scratch/navegacion-simple/spec.md` §«Actividad» item 3, «The per-house filter chips are dropped»; `docs/decisiones.md` 2026-10-27 «Navegación simple»).
- `docs/decisiones.md` 2026-10-27 «Fase 5, ticket 05»: «Reactivar» (filled green) on a stopped subscription becomes «Activar suscripción» in ocre; the subscription screen always lists all houses.
- `design/tokens/tokens.json` `color.sun.role`, as rewritten by `.scratch/densidad-y-tarjetas/spec.md` §4 (this spec applies it to Cuenta and Suscripción).
Related: `.scratch/densidad-y-tarjetas/spec.md` (B: ocre rule, house card), `.scratch/editar-casa/spec.md` (D: the subscription block of the editable ficha links here).
Visual authority, once Daniel approves them: `design/pantallas/v2/10-actividad` and the Cuenta / Suscripción mockups in `design/pantallas/v2/`.

## Order and dependencies

Last project (B+C → A → D → E → **F+G**). Depends on **B** (ocre rule and its allowlist test; Actividad house cards). Uses **D**'s subscription block as an entry point to `?casa=`; if built before D, the same link goes on today's «Suscripción» row of the detail (`Detail` in `propietario.tsx`, `SubscriptionLink`). No database change.

## Problem Statement

- From a house, «Suscripción» opens «Promoción y suscripción» with **every** house, tiers and explanations; the owner has to find the one they came from. A stopped house offers «Reactivar» in green, like any other action, though it is the step that costs money.
- In Cuenta, a missing payment method looks like any other row.
- «Cerrar sesión» sits next to «Términos y privacidad» and signs out with one tap; owners tap it thinking it closes the screen, and then need a new code.
- Owners ask whether they can verify their identity. Nothing says that it is coming (it is v1.1, optional).
- In Actividad, an owner with two houses cannot tell at a glance which house an inquiry is about (the house name is buried in the summary line «Casa Cocles · 20–27 dic · 4 personas»), and cannot filter.

## Solution

### 1. Suscripción scoped to one house

`/propietario/suscripcion` (`client/screens/suscripcion.tsx`, `suscripcionSearch` in `client/shell.tsx`):

- New search param **`casa=CT-####`** (public id, the same id as the existing `#pago=CT-####` hash). `suscripcionSearch` keeps `pago=ok` and adds `casa` when it matches `^CT-\d{4,}$`.
- With `casa` and that house in `owner_billing`:
  - header «Suscripción» with the house name as subtitle;
  - only that house's `HouseCard` (no «Sus casas» heading), then the «Método de pago» card, then «Cómo funciona»; the tiers card (`TiersCard`) is not shown (it describes the launch offer for new houses, not this one);
  - with two or more houses, a text link «Ver todas sus casas» at the bottom (→ same route without `casa`).
- `casa` unknown or not the owner's → the screen shows all houses and the URL drops `casa` (replace).
- Without `casa`: today's screen (all houses). The **`#pago=CT-####` hash keeps working** for links already sent by WhatsApp (highlight and scroll, as today); with both, `casa` scopes and the hash highlights.
- Entry points that pass `casa`: D's subscription block and row on the editable ficha; the Mis casas card buttons «Añadir método de pago» / «Activar suscripción» (B); the Cuenta subscription card lines (each line links to its house). `PayButton` in `propietario.tsx` keeps the hash too, so reminders and buttons land the same way.
- After the payment page, the owner comes back to the same scope: on the scoped screen every `PayButton` (also the one of the «Método de pago» card) passes the scoped house to `openPaymentPage(publicId)`, and `setupReturnUrls(base, publicId)` (`domain/payments.ts`) adds `casa=<publicId>` to both return URLs when a house is given (`/propietario/suscripcion?pago=ok&casa=CT-…#pago=CT-…`; cancel without `pago=ok`). `useSavingMethod` keeps `casa` when it strips `pago=ok`.

### 2. Ocre for money in Suscripción and Cuenta

- **«Activar suscripción»** replaces «Reactivar» on a stopped (`inactive`) house: `btn-sun` (ocre), same mutation (`change.mutate("resume")`). Same label on B's Mis casas card and D's top block.
- «Añadir método de pago» stays ocre (`PayButton`). «Parar suscripción» stays outline. «Cambiar» (method) stays the small outline button.
- **Cuenta «Método de pago» row** (`CuentaPaymentRow`): when there is **no method**, the row is ocre (`list-item-sun`: `--sun-soft` background, `--sun-ink` text and icon) with the small line «Falta · añádalo antes de que termine su oferta»; with a method, as today (neutral). A new class `.list-item-sun` in `global.css`, and both components are in B's ocre allowlist.
- **Cuenta subscription card** (`CuentaSubscriptionCard`): a line for a `payment_due` or `inactive` house is ocre (sun-ink text with the «Pendiente de pago» / «Inactiva» badge); others stay neutral.

### 3. Cuenta: identity line and «Cerrar sesión» at the end

`client/screens/cuenta.tsx` `CuentaScreen`:

- Under «✓ WhatsApp verificado · 8888 1234» in the account card, an **informative line** (`xs muted`, not a button, not a link): **«Pronto podrá verificar también su identidad (opcional).»** Shown to every signed-in user. Nothing else about identity anywhere.
- **«Cerrar sesión»** moves out of the `foot-row`: it is the **last element** of the screen, below «Términos y privacidad», a centred, muted text button (`btn-link muted`, same size as the terms line). Tapping it opens a confirmation sheet (the modal sheet pattern of `ConfirmSheet` in `suscripcion.tsx`, extracted to `client/confirm-sheet.tsx` and reused by both):
  - title «¿Cerrar sesión?»;
  - body «Tendrá que recibir un código nuevo para volver a entrar.»;
  - «Cerrar sesión» (outline) and «Cancelar» (text); Escape and the backdrop cancel; focus returns to the button.
  - Confirming runs today's `logout`.
- **The session does not expire while in use** (decision F): Supabase refresh tokens already rotate with no time-box or inactivity timeout configured (`supabase/config.toml` sets none); supabase-js refreshes on use. No change; `docs/configuracion-supabase.md` records that `[auth.sessions] timebox` and `inactivity_timeout` must stay unset in `bnbtico-pruebas` and production.
- Passkeys: out (after launch).

### 4. Actividad: the house on every inquiry, chips by house

`client/screens/actividad.tsx` `InquiryCard`, `ActividadScreen`; `domain/inquiry.ts` `inquirySummary`.

- **House tag** at the top of every inquiry card: a 32 px rounded thumbnail (`variantUrl(cover, 480)`, from the own-listings cache by `listingId`; arena box without photo) and the house name (`small strong`), on one line, ellipsis if long. Then the client row (initials, name, «Nueva», time) as today.
- The summary line drops the house name: «20–27 dic · 4 personas» (`inquirySummary` without `listingTitle`; «sin fechas» when there are none).
- **Chips by house** when the owner has **two or more houses that can receive inquiries** (`first_published_at` not null): above «Últimas consultas», a `chiprow` «Todas · Casa Cocles · Cabina Punta Uva» (names truncated with ellipsis at ~18 characters; the full name as accessible name). «Todas» is selected by default.
  - Selecting a house filters the inquiries **before** taking the 20 most recent (`owner_inquiries()` returns up to 200, so a quiet house still shows its last 20).
  - The selection lives in the URL: `/propietario/actividad?casa=<listing uuid>` (same param name and format as `/propietario/calendario?casa=`), validated like `calendarioSearch`; an unknown id falls back to «Todas».
  - The house cards with figures above (B's `HouseCardTop` + figures) are not filtered.
  - Empty filter: «Todavía no hay consultas de esta casa.»
- With one house: the tag is shown too (decision G: «cada consulta lleva arriba una etiqueta»), and there are no chips.

## Data

No schema, RPC or view change. `owner_billing`, `owner_inquiries` and the own-listings query already carry everything (house id, public id, title, photos, `first_published_at`).

- `domain/subscription.ts`: `parsePayHash` unchanged; new `scopeBilling(houses, casa) → { scoped: HouseBilling | null, all }`.
- `domain/inquiry.ts`: `inquirySummary` without the title; new `filterInquiries(list, listingId | null)`; `inquiryChips(listings) → { id, label }[] | null` (null under two houses).
- `client/shell.tsx`: `suscripcionSearch` and a new `actividadSearch`.

## Testing (test first)

- **Vitest:** `setupReturnUrls` with and without a house; `scopeBilling` (known, unknown, other owner's id); `suscripcionSearch` and `actividadSearch` validation; `inquirySummary` without title; `filterInquiries` before slicing; `inquiryChips` with 1 and 2 published houses (a draft does not count).
- **Playwright** (mobile viewport):
  1. From a house's subscription row → `/propietario/suscripcion?casa=CT-…` shows only that house and «Método de pago»; «Ver todas sus casas» shows both.
  2. A stopped house shows «Activar suscripción» in ocre (`btn-sun`); tapping it reactivates (existing flow).
  3. A reminder link `/propietario/suscripcion#pago=CT-…` still highlights the house.
  4. Cuenta without payment method: the row has the ocre class; with method, not.
  5. Cuenta shows «Pronto podrá verificar también su identidad (opcional).» under «WhatsApp verificado».
  6. «Cerrar sesión» is the last element; tapping it shows «Tendrá que recibir un código nuevo para volver a entrar.»; «Cancelar» keeps the session; confirming signs out.
  7. Actividad with two houses and inquiries for both: every card has its house tag; the chip of one house shows only its inquiries and puts `?casa=` in the URL; reload keeps the filter.
  - Update `cuenta.spec.ts`, `suscripcion.spec.ts`, `fase3.spec.ts` (Actividad cards) where they relied on the old layout.
- **Gates:** `size-limit` — Suscripción (7 KB), Actividad (4 KB), tab screens (24.5 KB, Cuenta lives there: the confirm sheet is shared with `suscripcion-*.js`, so it must not be duplicated into `cuenta-*.js`; if it does not fit, the sheet is lazy-loaded on tap).

## Documentation (same day)

- `docs/decisiones.md`: subscription scoped by `?casa=CT-####`; «Activar suscripción» in ocre; ocre «Método de pago» row when missing; «Cerrar sesión» at the end with confirmation; session without expiry while in use; the identity line (and that it is the only identity text in v1); Actividad house tag and chips (reverting the 2026-10-27 drop).
- `docs/diseno-v1.md` §8, §9, §14, §16.
- `CLAUDE.md`: the Veriff bullet gets «salvo la línea informativa de Cuenta».
- `docs/configuracion-supabase.md`: the session settings that must stay unset.

## Out of scope

- The future ocre «Añadir método de pago» button on the scoped screen beyond what `payButtonDue` already shows (decision F: «Futuro»).
- Identity verification itself (Veriff, v1.1).
- Passkeys.
- Filtering the house figures by house, or inquiries older than the 200 returned by `owner_inquiries()`.
