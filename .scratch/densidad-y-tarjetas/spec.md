# Spec · Densidad, tarjetas con la etiqueta en la foto y un calendario más alto

Status: needs-triage
Date: 2026-10-28
Decided by: Daniel, question by question on 2026-10-28/29, from Ana's emails of 2026-10-28 («Cambios bnbtico»). Authority: `.scratch/ronda-ana-2026-10-28/decisiones.md`, sections **B** (densidad y diseño) and **C** (calendario).
Language note: technical artifact in English; all UI copy in Spanish de Costa Rica, treating the user as **usted**.
Supersedes:
- `docs/diseno-v1.md` l.9 (ocre «solo dinero y avisos de pago» stays, but now with an explicit list), l.13 (tab icon 22 px), l.20 (Explorar grid of two columns, card photo 168 px; the Explorar card itself is specified in `.scratch/explorar-airbnb/spec.md`), l.32 (Mis casas: 92 px thumbnail, price and situation line on each card, «Seguir publicando» notice card on top), l.35 (Calendario: month with arrows, 46 px days), l.37 (detail: switch «Disponible para consultas» / «Anuncio visible»), l.22 (§3 Ficha: hero 320 px with 28 px corners) and l.31 (Actividad house cards with a small photo).
- `design/tokens/tokens.json` `color.sun.role` «Aviso de pago … Solo avisos, nunca acciones normales» → «solo dinero y avisos de pago» (see Data).
- Decision «Una casa se ve directa en Mis casas» (`docs/decisiones.md`, 2026-10-27 «Navegación simple», and `.scratch/navegacion-simple/spec.md`): Mis casas is now always the list (see Solution §3 and «Questions for triage»).
- Revisión UX N1 (`.scratch/revision-ux/2026-10-26-revision-ux.md`): «Seguir» as the one filled button of a draft card becomes «Seguir publicando» in outline green (decision B).
Related: `.scratch/explorar-airbnb/spec.md` (A: Explorar card and header), `.scratch/editar-casa/spec.md` (D: the detail screen and «Edición en revisión»), `.scratch/publicar-v2/spec.md` (E: single draft item), `.scratch/cuenta-y-actividad/spec.md` (F+G: ocre rows, Actividad inquiry cards).
Visual authority, once Daniel approves them: the v2 mockups being drawn in `design/pantallas/v2/` (from `01-explorar-resultados` to `10-actividad`), for the ficha, Mis casas, Calendario and Actividad screens. Where a mockup and this spec disagree, the approved mockup wins on looks; this spec wins on behaviour.

## Order and dependencies

First project of the round (proposed order B+C → A → D → E → F+G). It depends on nothing. A reuses its density and button rules; D builds the editable detail on the card and label pattern defined here and assumes the visibility switch has already moved to Calendario; E relies on «a draft is one item»; F+G reuse the ocre rule and the house card.

## Problem Statement

Ana compared the app with Airbnb on her phone:

- **Too much air, too little content.** 20 px side margins and small photos and icons make every screen feel sparse; the tab icons (22 px) look small.
- **The ficha photo** is a 320 px rounded box inside the margins. On a phone the photo is the product; it should fill the width.
- **Mis casas cards** carry a 92 px thumbnail, a price, a subscription line and a status badge beside the title. Owners read the status first, and it is lost among the text. A draft appears twice: as the «Seguir publicando» notice on top and as a card in the list.
- **Ocre is used for things that are not money**: the «Corregir y reenviar» card, review notes, the «Cambios pedidos» badge, «No disponible por ahora» on the ficha, the update banner. Ocre should mean «this is about paying».
- **The calendar** has short cells and arrows to change month; prices are hard to read, a month leaves an empty band below, and «Anuncio visible» (closing the house) hides in the house detail, far from the nights it affects.

## Solution

### 1. Density (all screens)

- Side gutter **16 px** (was 20) everywhere: `.view` padding, and the negative margins of `.chiprow` and `.photo-strip` (`global.css` l.115, l.175, l.293) become `-16px` / `16px`. Introduce a `--gutter: 16px` custom property and use it in those three rules, so the value lives in one place.
- Bottom bar icons **26 px** (was 22, `chrome.tsx` `TabsFrame` `<Icon size={22} />`); the label, the 84 px bar height and the active colour do not change.
- Icons in `.list-item` rows 24 px (was 22); feature icons on the ficha grid 26 px.
- Text colour stays `--fg` `#1C2B2A` everywhere (decision B). No new colours.

### 2. Ficha: square photo, full width

`shared/hero-gallery.tsx` and `.hero` (`global.css` l.279):

- The hero is **1:1** (`aspect-ratio: 1 / 1; height: auto`), **full bleed** (`margin: 0 calc(-1 * var(--gutter))`, no border radius), starting right under the safe area. The view's top padding is removed on the ficha only (`.listing-view` modifier), so the photo touches the top edge.
- Buttons on top, as today: volver, «₡ | $», compartir, corazón (`.hero .top`), on the existing cream round buttons; counter «1 / 5» bottom right (`.hero-counter`), hidden with one photo.
- Desktop layout (`.listing-view > .hero` at the ≥ 900 px breakpoint, l.771) keeps its 480 px height: the desktop pass is on hold (`docs/decisiones.md`, 2026-10-27).
- **SSR and hydration:** the hero is server-rendered in `/casa/CT-####` (`shared/listing-page.tsx`). The square box has its size from CSS before the image arrives (no CLS). Nothing in the hero depends on the session, so the hydration gate (`tests/e2e/ficha.spec.ts`, which fails on hydration warnings) must stay green without changes to what the server renders other than class names.
- **LCP:** the cover keeps `fetchpriority="high"`, `loading="eager"`, `decoding="sync"`. Its `sizes` stays `100vw`. On a 375 px phone at DPR 2–3 the browser picks the 800 or 1600 variant (variants are «lado mayor» 480/800/1600, `domain/image.ts`). A square box is taller than the old 320 px one, so a landscape 800 variant is slightly upscaled at DPR 3; this is accepted. The Lighthouse gate (`tests/lighthouse/lighthouse.spec.ts`, ficha cold < 2.0 s on the mobile profile) decides: if it fails, the hero `srcset` drops the 1600 candidate on phones (`<picture>` with a `(min-width: 900px)` source for 1600) rather than relaxing the budget.
- Ficha badge «No disponible por ahora» (`listing-page.tsx` l.252) changes from `badge-sun` to `badge-mute` (arena): it is not about money.

### 3. Mis casas: always a list, one house per row, the status on the photo

`client/screens/propietario.tsx` `CasasScreen`, `OwnerCard`, `NoticeCard`, `ResumeCard`; `domain/navigation.ts` `casasView`, `noticeFor`.

- **Always the list**, also with one house (`casasView` returns `"list"` for ≥ 1). Tapping a card opens the house detail (`/propietario/casas/$id`; after D, the editable ficha). The tab label «Mi casa» / «Mis casas» does not change. «Nueva» stays in the header; «Añadir otra casa» at the bottom of the single view goes away (the header button covers it).
- The summary tiles (activa / por pagar / en revisión) stay as today (0 hidden).
- **Card** (one per row, the whole card is a link, as today with `.stretched`):
  - **Square photo** (1:1) at the card's full width, 20 px corners, cover from `variantUrl(cover, 800)` with `srcset` 480/800 and `sizes="100vw"`, `loading="lazy"` except the first card. Without photos, the arena box with the house icon.
  - **Status label on the photo**, top left, a pill: «Activa», «En revisión», «Borrador», «Cambios pedidos», «Rechazada», «Pendiente de pago», «Inactiva», «Cerrada» (active and `available = false`; «Cerrada hasta el 3 dic» with `reopenAt`) and, from D, «Edición sin enviar» / «Edición en revisión» / «Cambios pedidos en la edición». One label only; priority: payment (Pendiente de pago, Inactiva) > edit state > Cerrada > status. Label colours follow §4.
  - Below the photo: **name** (Outfit, 18 px) and **zone** (`l.zone`, muted). **No price, no subscription line, no situation line, no stats** (decision B: «sin precio ni texto extra»).
  - **Buttons** below, at most one filled:
    - active: «Compartir ficha» (filled verde selva, `btn-primary`) + «Calendario» (outline);
    - draft: «Seguir publicando» (outline green, `btn-ghost`) + «Descartar» (text button; only if `can(l, "discard")`, same confirmation as today);
    - changes: the review note in an arena note, then «Corregir y reenviar» (filled green);
    - rejected: the review note, no buttons;
    - payment_due: «Añadir método de pago» (ocre, `btn-sun`);
    - inactive: «Activar suscripción» (ocre; wording shared with F);
    - review: no buttons.
- **A draft is one item** (decision B): `noticeFor` no longer returns `kind: "resume"`; only the payment notice can sit on top. `ResumeCard` is deleted; its «where you are» line («Fotos y texto · 2 de 2») is dropped (the card has no extra text). The «Seguir publicando» target stays `resumeStep(l)`.
- The «Promoción y suscripción» ocre notice (`PayNotice`) stays on top when a payment is due, unchanged.

### 4. Colour rules for actions

- **Ocre (`--sun`, `--sun-soft`, `--sun-ink`) only for money and payment notices**: pay, «Activar suscripción», «Añadir método de pago», and the subscription / payment-method row or card when something is missing. Concretely:
  - stays ocre: `PayButton`, `PayNotice`, `card-sun` for payment, `tile-sun` «por pagar», `badge-sun` «Pendiente de pago» / admin «Por pagar», the contact sheet's «no pague por adelantado» warning (it is about money);
  - changes to arena (`note-arena`, `badge-mute`) or salvia: review notes in `ResumeCard`/`OwnerCard`/`Detail` (`note-sun` → `note-arena`), the «Le pedimos cambios» card in `Detail` (`card-sun` → `card-arena`) and its «Corregir y reenviar» button (`btn-sun` → `btn-primary`), `STATUS_LABELS.changes.badge` (`badge-sun` → `badge-review`), admin «con cambios» tile (`tile-sun` → `tile-review`), admin «Zona propuesta por el dueño» and «Faltan fotos» notes, the admin sync-failed note, the ficha «No disponible por ahora» badge, and the update banner button (`update-banner.tsx`, `btn-sun` → `btn-primary`).
- **«Compartir ficha»** is filled verde selva wherever it is a button (Mis casas card; D's detail). **«Seguir publicando»** is outline green.
- **One filled action per card** (and, as today, one per screen where the screen has no cards).
- A unit test in `tests/unit/` scans `src/client` and `src/shared` for `btn-sun`/`card-sun`/`note-sun` and fails if one appears outside an allowlist of the money components (`PayButton`, `PayNotice`, suscripción, contact sheet warning, Cuenta payment row): the rule stays true by construction.

### 5. Actividad house cards

`client/screens/actividad.tsx` `ActivityCard` (two or more houses) uses the **same card** as Mis casas: square photo with the status label, name and zone, and below, instead of buttons, the three figures (visitas · toques en WhatsApp · consultas, `Figures`). Extract the photo + label + name block as `HouseCardTop` in `client/house-card.tsx`, used by Mis casas and Actividad (and D's list state). The single-house view (`SingleActivity`, big figures) does not change. Inquiry cards are specified in F+G.

### 6. Calendario: taller days, months one under another, «Cerrar la casa hasta…» on top

`client/screens/calendario.tsx`, `shared/month-grid.tsx`, `client/close-sheet.tsx`.

- **Vertical months.** The month arrows go away. The calendar is a vertical list of months from the current month to the last month of `calendarWindow` (today + 365), each with a sticky month title («Diciembre 2026»). Months render lazily: only those within one screen of the viewport mount their grid (an `IntersectionObserver` sentinel per month, or `content-visibility: auto` with `contain-intrinsic-size`), so opening the tab stays inside the «toque < 50 ms» budget.
- **Taller cells with the price inside.** A month block fills the visible height (`min-height` = viewport minus top bar, house picker, close row and tab bar); its six week rows share that height (cells ≥ 64 px). Each available day shows its number top left and the compact price inside («₡95k», `compactPrice`), ★ for a special price, busy days in terracota claro without price, as today. Five-week months stretch their rows; no empty band below.
- `MonthGrid` gets a `size: "compact" | "tall"` prop. The owner calendar uses `"tall"`; the ficha's read-only calendar (`shared/listing-calendar.tsx`) keeps `"compact"` and its arrows. The ficha calendar chunk budget (4 KB) must stay green.
- **Selection** works across months (the existing `Selection` in `domain/calendar.ts` is a set of days; tapping days in two months selects both). The bottom panel (`Panel`) is unchanged and sticky.
- **`?mes=YYYY-MM`** stays valid: on open, that month scrolls into view (links already sent keep working); scrolling does not rewrite the URL.
- **«Cerrar la casa hasta…»** row at the top of each house's calendar, under the house picker, only when `can(l, "available")` (active):
  - open house: an outline button «Cerrar la casa hasta…» that opens `CloseSheet` (same function as the old «Anuncio visible» switch: `set_listing_available(p_listing, false, p_reopen_at)`, reopening date optional);
  - closed house: the line «Cerrada hasta el 3 dic» (or «Cerrada: no aparece en Explorar ni recibe consultas») and an outline button «Abrir la casa» (`set_listing_available(…, true)`), replacing today's note «Esta casa está cerrada a consultas…» + «Abrir a consultas». The grid stays dimmed while closed, as today.
  - `CloseSheet` title «Pausar anuncio» → «Cerrar la casa»; body «No aparecerá en Explorar ni recibirá consultas. Sus noches y precios se conservan.»; date field label «Abrir de nuevo el (opcional)»; confirm «Cerrar la casa».
- **The switch leaves the detail.** The «Anuncio visible» list item in `Detail` (`propietario.tsx` l.488–515) and its `CloseSheet` are removed; the detail shows nothing about it (D rebuilds that screen).

## Data

No schema or RPC change. `set_listing_available` and `save_listing_days` are reused as they are.

Tokens (`design/tokens/tokens.json`): `color.sun.role` becomes «Dinero y avisos de pago: pagar, "Activar suscripción", "Añadir método de pago", y la fila o tarjeta de suscripción o método de pago cuando falta algo. Nunca acciones normales». Bump the file version to 0.2.1 and update the mention in `CLAUDE.md` («tokens … 0.2.0»).

## Testing (test first)

- **Vitest:**
  - `casasView` returns `"list"` for 1; `noticeFor` never returns `"resume"`; a draft yields no notice.
  - `cardLabel(listing, edit?, billing?)` (new, `domain/navigation.ts`): the label and its badge class for every status, «Cerrada hasta el …», and the priority order.
  - The ocre allowlist test (§4).
  - `calendar.ts`: selection across two months.
- **Playwright** (mobile viewport, existing helpers):
  1. Mis casas with one active house shows a card (not the detail) with «Activa» on the photo, name, zone, «Compartir ficha» filled and «Calendario» outline; no price on the card.
  2. A single draft appears once: no notice card above, the card has «Seguir publicando» (outline) and «Descartar».
  3. Ficha: the hero is square and full width at 375 px (box width = viewport width, height = width); no hydration warnings (existing check).
  4. Calendario: two months visible by scrolling, no month arrows; a day in each month selected and saved in one go; `?mes=` scrolls to that month.
  5. «Cerrar la casa hasta…» with a date → the house disappears from Explorar and the row reads «Cerrada hasta el …»; «Abrir la casa» brings it back. The house detail has no «Anuncio visible».
  - Update the specs that relied on the old layout: `propietario.spec.ts`, `calendario.spec.ts`, `no-disponible.spec.ts`, `navegacion.spec.ts`.
- **Gates:** `size-limit` (calendar 8 KB, ficha calendar 4 KB, tab screens 24.5 KB — the tab screens are at 24.46 KB: removing `ResumeCard` and the single view must pay for `HouseCardTop`; if not, `house-card` goes into its own deferred chunk with its own entry), Lighthouse ficha and shell.
- Manual on a real iPhone and Android, recorded in `docs/pruebas-manuales-revision-ux.md` (next free U numbers): gutter, tab icons, square hero under the notch, calendar scroll and selection across months.

## Documentation (same day)

- `docs/decisiones.md`: density (16 px, 26 px icons), square full-bleed hero, Mis casas always a list with the status on the photo, a draft is one item, ocre rule with its list, calendar vertical and tall, «Cerrar la casa hasta…» in Calendario.
- `docs/diseno-v1.md`: lines listed under Supersedes (l.9 list of ocre uses, l.13, l.22 ficha hero, l.31, l.32, l.35, l.37).
- `design/tokens/tokens.json` role and version; `CLAUDE.md` token version.
- `docs/pruebas-manuales-revision-ux.md`: new recorridos.

## Out of scope

- The Explorar card, header and map (A).
- The editable detail and edit labels' data (D).
- Desktop layouts (on hold).
- Calendar sync with Airbnb by iCal (future, decisions file).

## Questions for triage

- Resolved 2026-10-29 (Daniel): Mis casas with **one** house shows the **list with one card** (§3); tapping it opens the house detail (the editable ficha after D).
