# Spec · Editar una casa publicada sin sacarla de Explorar

Status: needs-triage
Date: 2026-10-28
Decided by: Daniel, question by question on 2026-10-28/29, from Ana's emails of 2026-10-28. Authority: `.scratch/ronda-ana-2026-10-28/decisiones.md`, section **D**.
Language note: technical artifact in English; all UI copy in Spanish de Costa Rica, treating the user as **usted**.
Supersedes:
- `docs/diseno-v1.md` l.37 (detail «Detalle de mi casa»: photo with status and price, list with Compartir ficha / Editar la ficha / WhatsApp de esta casa / interruptor) and the editing rule behind «Editar la ficha · vuelve a revisión».
- `CLAUDE.md` «el trigger `listings_protect` … congela el contenido fuera de `draft`/`changes`»: published houses are still frozen for direct writes, but now change through RPCs (immediate fields) or through a reviewed edit (see Data).
- `docs/decisiones.md` (fase 2 and revisión UX A5): «una casa publicada que se reabre para editar vuelve a borrador» (`reopenForEdit`, `useReopen`, the confirmation «Su casa dejará de verse mientras la revisamos»). A published house never goes back to `draft`.
- `.scratch/fotos-arrastrar/spec.md` «No change to the DB or the RPC `reorder_listing_photos`»: the photo RPCs now also accept published houses (reorder and remove only).
Related: `.scratch/densidad-y-tarjetas/spec.md` (B: card, labels, ocre rule; C: «Anuncio visible» moved to Calendario), `.scratch/publicar-v2/spec.md` (E: title 5–32, ≥ 1 photo to approve), `.scratch/cuenta-y-actividad/spec.md` (F: `/propietario/suscripcion?casa=CT-####`), `.scratch/ubicacion-por-punto/spec.md` (location rules reused).
Visual authority, once Daniel approves them: the editable-ficha and admin edit-review mockups in `design/pantallas/v2/`.

## Order and dependencies

Third project (B+C → A → **D** → E → F+G). Depends on **B+C**: the card with the label on the photo (D adds the edit labels), the ocre rule, and the visibility switch already moved to Calendario. Shares rules with **E**: D validates the name with the domain constants `TITLE_MIN`/`TITLE_MAX` and the approval photo minimum with `MIN_PHOTOS_TO_APPROVE`; E changes their values (32, 1). If E lands first, nothing in D changes. F links the subscription block here to `?casa=`; until F lands, the block links to `/propietario/suscripcion#pago=CT-####` as today.

## Problem Statement

Today an owner who wants to change anything on a published house taps «Editar la ficha», confirms «Su casa dejará de verse mientras la revisamos», and the house goes back to `draft`: it leaves Explorar, its link stops working, and it waits for a full review. To fix a price or say the house now has wifi, an owner loses days of visibility. So owners don't update, and fichas go stale.

Editing also reopens the 9-step wizard, which is built for a first publication, not for touching one field.

## Solution

### 1. The house detail becomes its editable ficha

`/propietario/casas/$id` (`CasaPropietarioScreen`, `Detail` in `client/screens/propietario.tsx`) is rebuilt for published houses (`first_published_at` not null and status `active`, `payment_due` or `inactive`). Never-published houses (draft, review, changes, rejected) keep today's detail and the wizard.

Layout, top to bottom (it reads like the public ficha, without calendar):

1. Header: back, title = house name, «Ver ficha» (when `can(l, "share")`).
2. **Subscription block on top, in ocre, only if** the house is `payment_due` (the existing `PayNotice` with «Añadir método de pago») or `inactive` («Suscripción parada», «Activar suscripción», ocre). Otherwise the block goes to the bottom (item 9).
3. **Edit banner**, when an edit exists (§3): «Cambios sin enviar: nombre, descripción» with «Enviar a revisión» (filled) and «Descartar cambios» (text button); «Edición en revisión: nombre, descripción · normalmente en menos de 24 horas» with «Descartar cambios»; «Le pedimos cambios en la edición» with the admin note (arena), «Enviar a revisión» and «Descartar cambios».
4. **Photos**: a horizontal strip, approved photos first (the first tagged «Portada»), then the edit's new photos tagged «En revisión». A row «Fotos · 8» opens the photo screen.
5. **«Compartir ficha»** (filled verde selva, when `can(l, "share")`), with the `bnbtico.com/casa/CT-####` line, as `ShareListItem` today but as a button.
6. **Field rows** (`list-item` with chevron), each opening its own screen:
   - Nombre · Tipo (Alojamiento completo / Habitación, baño privado o compartido) · Ubicación (zone · cantón, provincia) · Descripción — **reviewed** fields; a pending value shows under the row with the tag «Sin enviar» or «En revisión».
   - Personas, habitaciones y baños · Características · Precio (por noche; «Alquiler mensual» and its price) — **immediate** fields.
7. «WhatsApp de esta casa» (read-only, as today).
8. Stats line (visits and inquiries, 30 days), as today.
9. **Suscripción** row (when not on top): «Gratis hasta el 14 oct 2027», linking to `/propietario/suscripcion?casa=CT-####` (F).

### 2. Field screens

Route `/propietario/casas/$id/editar/$campo`, `campo ∈ fotos | nombre | tipo | ubicacion | capacidad | caracteristicas | descripcion | precio`, in the publish chunk (they reuse the wizard's `StepFields` for steps 1, 2, 4, 5, 6 and 8, and `PhotoUploader`), with a header (back, field title) and a bottom bar «Guardar» (filled). Back without saving discards the screen's changes.

- **Immediate** (decision D: «al momento, sin revisión»): personas, habitaciones, baños, características (with parking type), precio por noche, «Alquiler mensual» and its price, photo order, removing a photo. «Guardar» calls `update_listing_live` (or the photo RPCs); optimistic on the `own-listing` cache; on success a toast «Guardado. Ya se ve en su ficha.» and back to the ficha; on error the cache reverts and the screen shows the message.
- **Reviewed** (decision D: «con revisión del admin»): ubicación (pin and zone), **fotos nuevas**, nombre, tipo, descripción. «Guardar» calls `save_edit` (creating the edit on first save); toast «Guardado. Envíelo a revisión cuando termine.»; back to the ficha, where the edit banner now shows. The public ficha does not change.
- The screens show the edit's pending value when there is one (not the approved one).
- **Photos screen**: the approved photos in the drag grid of `fotos-arrastrar` (reorder and remove are immediate; removing the last approved photo is refused: «Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.»); below, «Fotos nuevas · en revisión» with the edit's photos (add, remove, reorder among themselves; they go to the end of the ficha on approval). «Añadir fotos» uploads into the edit. Max 15 counting both groups.
- While the edit is **in review**, reviewed field screens open read-only with the note «Este cambio está en revisión. Si quiere cambiar algo, descarte la edición y empiece otra.»; immediate fields stay editable.

### 3. One edit at a time

- A house has **at most one edit** (primary key on `listing_id`). States: `open` (being edited, not sent) → `review` (sent) → approved (the row is deleted after applying) or `changes` (admin asked for changes; owner edits and resends).
- While an edit exists, no other can be opened: every reviewed save goes into that same edit; in `review` it is frozen (decision D: «si hay una edición sin enviar o en revisión, no se puede abrir otra»).
- **«Descartar cambios»** is always available (open, review, changes), with the confirmation «¿Descartar los cambios sin aplicar? Su ficha sigue como está.»; it deletes the edit and its new photos.
- «Enviar a revisión» with nothing changed is refused: «No hay cambios que enviar.»
- **Mis casas** shows the edit on the card's photo label (B): «Edición sin enviar», «Edición en revisión», «Cambios pedidos en la edición»; the house is listed once.
- **The approved version stays public** the whole time: the house stays `active`, `listings_public` and the SSR ficha read only `listings` and `listing_photos`, which the edit does not touch until approval.

### 4. Admin review of an edit

- `AnunciosScreen` (admin queue) gets a section «Ediciones por revisar» (oldest first) listing edits in `review`: photo, CT-####, name, owner, «Edición: nombre, descripción, 2 fotos nuevas».
- New route `/admin/ediciones/$id` (listing id), `RevisarEdicionScreen` in the admin chunk: for each changed field a **diff** block «Antes» / «Ahora» (text side by side for name and type; description with the new text and the old one folded; location: both points on one map with the zone names; new photos as a grid), the unchanged fields folded under «Lo que no cambia», and the same checklist as the first review.
- Decisions: «Aprobar cambios» (filled) and «Pedir cambios» (outline, note required). There is no «Rechazar» for an edit: the owner can always discard.
- Approving applies the edit (§Data) and the public ficha is purged; the owner sees the house without the banner.

### 5. Removed

- `useReopen`, `reopenForEdit` (`data/postgrest/owner.ts` l.114) for active houses, and `can(l, "reopen")` for `active` (it stays for `changes` and `rejected` of never-published houses).
- The «Editar la ficha · vuelve a revisión» row and its confirmation.
- The «Estuvo publicada. Está editándola…» note (no published house is a draft any more).
- The «Anuncio visible» switch (moved to Calendario by C).

## Data

### Tables (new migration `editar_casa_publicada`)

```sql
create table public.listing_edits (
  listing_id uuid primary key references public.listings(id) on delete cascade,  -- una edición por casa
  status text not null default 'open' check (status in ('open','review','changes')),
  -- Campos con revisión; null = sin cambio.
  title text check (title is null or char_length(btrim(title)) between 5 and 60),  -- E baja el máximo a 32 en las RPCs
  kind public.listing_kind,
  bathroom_shared boolean,          -- va con el tipo: solo cuenta si el tipo resultante es habitación
  description text check (description is null or char_length(description) <= 2000),
  lat double precision, lng double precision,
  zone text, zone_id text references public.zones(id) on delete set null, zone_source text check (zone_source in ('list','district','other')),
  review_note text,
  submitted_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  check ((lat is null) = (zone_source is null))   -- ubicación completa o nada
);
create trigger listing_edits_updated before update on public.listing_edits for each row execute function public.set_updated_at();

create table public.listing_edit_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listing_edits(listing_id) on delete cascade,
  path text not null,                 -- <casa>/<uuid>: la misma carpeta que las fotos aprobadas
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.listing_edit_photos (listing_id, position);
```

- **RLS:** `select` for the listing's owner and for `is_admin()`; no `insert/update/delete` grants for `anon`/`authenticated` on either table. Every write goes through the RPCs below (`security definer`).
- The description in the edit can be the empty string (E makes the description optional): `''` means «borrar la descripción», `null` means «sin cambio».
- **Owner listing read:** `ownListings`/`ownListing` embed `listing_edits(status, review_note, title, kind, bathroom_shared, description, zone, lat, lng, zone_source, submitted_at, listing_edit_photos(id, path, position))` through the FK (1:1). `Listing` gains `edit: ListingEdit | null`.

### RPCs

All `security definer set search_path = ''`, owner checked with `auth.uid()`, messages in Spanish shared with the domain (`EDIT_MESSAGES` in `domain/edit.ts`) and the fake. «Published» = `status in ('active','payment_due','inactive') and first_published_at is not null`.

- `update_listing_live(p_listing uuid, p_patch jsonb) returns void` — immediate fields.
  - Allowed keys: `capacity, bedrooms, bathrooms, features, parking_paid, nightly_price_crc, accepts_monthly, monthly_price_crc`. Any other key: «Ese dato no se puede cambiar aquí.»
  - Published houses only: «Solo puede cambiar así una casa publicada.»
  - Validates the **resulting** row with the same rules and messages as `submit_listing` (capacity ≥ 1; bedrooms ≥ 1 unless the current kind is completo/apartamento; bathrooms ≥ 1; parking ⇔ parking_paid; nightly > 0; monthly null or > 0; `accepts_monthly = false` clears `monthly_price_crc`). The kind used is the approved one (a pending kind change is checked again at approval).
  - Writes with `set_config('app.allow_status','on',true)`. The existing `listings_purge_page` trigger purges the ficha.
- `start_edit(p_listing uuid) returns public.listing_edits` — returns the existing edit if it is `open` or `changes`; raises «Ya hay una edición en revisión. Espere la respuesta o descártela.» if it is `review`; otherwise inserts an `open` row. Published houses only.
- `save_edit(p_listing uuid, p_patch jsonb) returns public.listing_edits` — calls `start_edit`, refuses in `review`. Allowed keys: `title, kind, bathroom_shared, description, lat, lng, zone, zone_id, zone_source` (location keys only all together). A value equal to the approved one is stored as `null` (no change). Light checks only (lengths, types); full validation at submit. If the result has no changed field and no new photo, the row is deleted (an empty edit does not linger).
- `add_edit_photo(p_listing uuid, p_path text) returns table (id uuid, path text, "position" int)` — like `add_listing_photo` (same path rule `<casa>/<uuid>`), into the edit (calls `start_edit`); refuses in `review`; total approved + new ≤ 15 («Máximo 15 fotos.»).
- `remove_edit_photo(p_photo uuid) returns text` and `reorder_edit_photos(p_listing uuid, p_ids uuid[]) returns void` — like their `listing_photos` twins, on the edit's photos; refuse in `review`.
- `submit_edit(p_listing uuid) returns text` — status `open`/`changes` → `review`, `submitted_at = now()`, `review_note = null`. Refuses an empty edit («No hay cambios que enviar.»). Validates the **merged** listing (approved row overlaid with the edit) with `submit_listing`'s rules for the reviewed fields: name `TITLE_MIN..TITLE_MAX`, description empty or within the allowed length, kind + bathroom rule, location with `place_at` and the zone rules (5 km for `'list'`, district name for `'district'`, ≤ 60 chars for `'other'`).
- `discard_edit(p_listing uuid) returns text[]` — deletes the edit (any state) and returns the new photos' paths so the browser deletes their Storage objects (as `remove_listing_photo` does).
- `review_edit(p_listing uuid, p_decision text, p_note text) returns text` — admin with `aal2` (`is_admin()`, same «Confirme el segundo código…» message as `review_listing`); edit must be in `review` («Esta edición ya tiene una decisión.»); `p_decision in ('approve','changes')`; note required for `changes`.
  - `approve`: re-validates the merged listing (an immediate change may have happened meanwhile; if it fails, raises the validation message for the admin to ask for changes); recomputes `province, canton, district` from the new point with `place_at` and the zone name for `'list'`; copies every non-null field to `listings`; appends the new photos to `listing_photos` after the current last position, in their order (re-checking ≤ 15); deletes the edit; inserts `admin_actions (action = 'edit.approve')`. Status, subscription and `first_published_at` are untouched. The ficha is purged by the existing triggers on `listings` and `listing_photos`.
  - `changes`: status `changes`, `review_note`, `reviewed_at`, `reviewed_by`; `admin_actions ('edit.changes')`.
- Grants: all the owner RPCs to `authenticated` only; `review_edit` to `authenticated` (checked inside). Revoke from `public, anon`.

### Changes to existing functions

- **`listings_protect`** (latest in `20261027060732_primera_publicacion.sql`): drop `'active'` from the allowed owner transition `status → 'draft'` (it stays for `changes` and `rejected`). The frozen-row message becomes «Esta casa está publicada: cambie sus datos desde Mis casas.» Everything else unchanged: the new RPCs write with `app.allow_status`.
- **`listing_photos_guard`** (`20261023073359_cliente_directo_fotos.sql`): allows published houses for `reorder_listing_photos` and `remove_listing_photo`; `add_listing_photo` keeps refusing them («Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.»). `remove_listing_photo` on a published house refuses to remove the last photo (message in §2).
- **Storage** (`storage.objects` policies on bucket `listings`):
  - insert: `listing_editable(folder)` OR (published and an edit in `open`/`changes`) — new helper `listing_photo_uploadable(p_listing uuid)`; the 45-object folder cap stays and matches 15 photos × 3 variants because approved + new ≤ 15.
  - delete: owner of the folder AND the object's `<casa>/<uuid>` prefix is not referenced by `listing_photos` nor `listing_edit_photos` (new helper `photo_unreferenced(p_name text)`). The browser only deletes after the RPC removed the row, so this lets it clean up removed approved photos and discarded new ones, and never a photo in use.
  - New photos are readable by URL like the approved ones (the bucket is public; the paths are random UUIDs and not listed anywhere public).
- **`listings_public`, `public_listing_days`, `search_listings`, the SSR**: unchanged.
- **Admin reads:** `AdminListingsApi` gains `editQueue()`, `getEdit(listingId)` (approved row + edit + photos of both) and `reviewEdit(listingId, decision, note)`; admin `select` on both new tables through RLS.

### Domain and adapters

- `domain/edit.ts`: `ListingEdit`, `EDIT_MESSAGES`, `IMMEDIATE_FIELDS`, `REVIEWED_FIELDS`, `mergeEdit(listing, edit) → ListingDraft`, `editSummary(edit) → "nombre, descripción, 2 fotos nuevas"`, `editLabel(edit)` (for B's card label), and `planEdit(listing, field, patch) → { immediate } | { reviewed } | { error }`, reusing `validateStep`.
- `OwnerListingsApi`: `updateLive`, `saveEdit`, `submitEdit`, `discardEdit`; `PhotosApi`: `addEditPhoto`, `removeEditPhoto`, `reorderEditPhotos`. PostgREST adapter and fake, with **contract tests before any screen** (CLAUDE.md rule for new tables).
- Regenerate `domain/database.types.ts`.

## Testing (test first)

- **DB (`tests/db/editar-casa.test.ts`):**
  - `update_listing_live` on an active house changes the price and the house stays `active` and in `listings_public`; refuses `title`; refuses on a draft; refuses `parking` without `parking_paid`.
  - Direct `update listings set title = …` on an active house is refused by `listings_protect`; `status = 'draft'` on an active house is refused.
  - `save_edit` + `submit_edit` leave `listings` and `listings_public` unchanged; a second `start_edit` in `review` raises; `save_edit` with the approved value stores null and an all-null edit is deleted.
  - `submit_edit` refuses a zone 10 km away, a 4-character name, an empty edit.
  - `review_edit approve` applies name, description, kind and location (province/cantón/district recomputed), appends new photos after the approved ones, deletes the edit, keeps status and `first_published_at`; `changes` requires a note; non-admin and `aal1` admin are refused.
  - Photos: approved + new ≤ 15; removing the last approved photo of an active house is refused; `add_listing_photo` on an active house is refused; `anon` cannot read `listing_edits`; another owner cannot read or write them.
  - Storage: upload into an active house's folder allowed only with an open edit; delete of a referenced object refused, of an unreferenced one allowed.
- **Contract suite** (`tests/contract/owner-listings.contract.ts`, `photos.contract.ts`, `admin.contract.ts`): the new methods against PostgREST and the fake.
- **Vitest:** `mergeEdit`, `planEdit` (each field to immediate/reviewed), `editSummary`, `editLabel`.
- **Playwright** (mobile viewport):
  1. Change the price of an active house: saved at once, the public ficha shows it after reload, the house is still in Explorar.
  2. Change the name: the ficha keeps the old name; Mis casas shows «Edición sin enviar»; «Enviar a revisión» → «Edición en revisión»; the name screen is read-only.
  3. Admin approves: the ficha shows the new name; the banner is gone.
  4. Admin asks for changes: the owner sees the note, edits, resends.
  5. «Descartar cambios» with two new photos: the edit and the photos are gone, Storage objects deleted (stubbed check in the fake).
  6. Reorder approved photos (drag) on an active house: immediate on the public ficha.
- Manual on a phone, in `docs/pruebas-manuales-revision-ux.md` (next free U numbers): the full edit cycle with the admin on another phone.
- **Gates:** `size-limit` — the field screens live in the publish chunk (at 14.94 of 15 KB: they go in a new deferred chunk `editar-*.js` with its own entry, 6 KB, rather than raising the publish limit); the admin edit review in the admin chunk (12 KB); tab screens (the new detail lives in `propietario-*.js`, inside «Pantallas de las pestañas», 24.5 KB — if it does not fit, the detail moves into `editar-*.js`).

## Documentation (same day)

- `docs/decisiones.md`: edits without leaving Explorar; immediate vs reviewed fields; `listing_edits` model; one edit at a time; no «Rechazar» for edits; published houses never return to draft.
- `docs/diseno-v1.md` l.37 (the editable ficha) and §18 (admin: edit review with diff).
- `CLAUDE.md` «Esquema» paragraph: `listings_protect` and the edit RPCs.
- `docs/architecture.md`: the edit tables in the data section.
- `docs/publicacion.md`: what can be changed at once and what goes to review.

## Out of scope

- Several edits in parallel, or a history of past edits (approved edits are only in `admin_actions`).
- Editing the WhatsApp number of a house (as today: from Cuenta).
- An automatic WhatsApp to the owner with the edit decision: the first review has none either today; the owner sees the result in Mis casas.
- Rejecting an edit.
- Changing a never-published house through this screen (it keeps the wizard).
