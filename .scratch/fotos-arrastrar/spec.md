# Spec · Fotos: ordenar arrastrando

Status: ready-for-agent (approved by Daniel 2026-10-27) · implementada en `develop` (258bf89..3898671); plan de pruebas en `docs/pruebas-manuales-revision-ux.md` (U54–U58)
Date: 2026-10-27
Decided by: Daniel, in the brainstorming of 2026-10-27 («Mejoras fase R y 3», project 3 of 4).
Language note: technical artifact in English; all UI copy in Spanish de Costa Rica, treating the user as **usted**.
Supersedes: the tap-to-select + «Hacer portada» / «← Antes» / «Después →» actions of the photos step (`apps/app/src/client/publish/photos.tsx` l.117-126).

## Problem Statement

Today, reordering photos takes several taps:

1. Tap a thumbnail.
2. Find the action row below the grid.
3. Press «Antes» or «Después» once per position. Each press makes a server round trip.

Moving the 8th photo to the cover position takes «Hacer portada», but moving it to position 3 takes five presses.

Owners expect to drag photos, as in their phone gallery.

## Solution

### Interaction (`PhotoUploader`, `client/publish/photos.tsx`)

- **Help line** above the grid, shown when there are 2 photos or more: «Mantenga pulsada una foto y arrástrela para cambiar el orden. La primera es la portada.»
- **Long press about 400 ms** on a thumbnail lifts it:
  - it scales to 1.05 with a shadow;
  - `navigator.vibrate?.(10)` where supported (Android; iOS ignores it).
- **Drag:**
  - The lifted photo follows the finger.
  - The other photos shift to show the drop slot, with a transform transition of about 150 ms on composite-only properties.
  - Near the top or bottom edge of the `.photos-scroll` container, it auto-scrolls.
- **Drop:**
  - The new order is applied **optimistically** to the `own-listing` query data. The grid does not snap back.
  - Then `api.reorder(listing.id, order)` is called once.
  - After that, the query is re-read from the server, as now.
- **Error:**
  - The previous order is restored.
  - The existing alert shows «No pudimos cambiar las fotos. Intente de nuevo.»
- **Cancel:**
  - Dropping in the original slot, or `pointercancel`, does nothing and makes no request.
- **Before the long press completes:**
  - A short tap, or moving more than about 8 px, cancels the gesture, so normal scrolling keeps working.
  - The thumbnail uses `touch-action: pan-y` until lifted, then `none` while dragging.
  - Disable `-webkit-touch-callout` and text selection on the thumbnails.
- **Cover:** the first photo keeps its «Portada» tag. It is a normal drag target: dragging any photo to slot 1 makes it the cover.
- **Remove:** each thumbnail keeps only its ✕ («Quitar foto N»). The ✕ does not start a drag.
- **While a reorder or remove is pending** (`change.isPending`), or while uploads are in flight, dragging is disabled. The grid has `aria-busy`, as now.

### Removed

- The tap-to-select state (`selected`, `.is-selected`, `aria-pressed`).
- The visible action row: «Hacer portada», «← Antes», «Después →».

### Accessibility

Each thumbnail keeps two buttons, **visually hidden but focusable**: «Mover foto N antes» and «Mover foto N después».

- They use the existing `moveBy` (`domain/photo-order.ts`).
- They are disabled at the ends.
- After a move, focus follows the photo.
- A polite live region announces «Foto movida a la posición N» (or «… N, portada»).

Keyboard and screen-reader users can reorder, and touch users only see the drag.

### Implementation constraints

- **No library.** Use Pointer Events, `setPointerCapture` and `requestAnimationFrame`, and animate transforms only. The publish chunk has a size budget, and `size-limit` must stay green.
- The order logic is a pure function, `domain/photo-order.ts` `moveTo(ids, id, toIndex) → ids`. The UI computes `toIndex` from the pointer position and the grid geometry, measured once at lift.
- This replaces the old rule «nada se reordena en el navegador por su cuenta» (header comment of `photos.tsx`) for reorder only. Upload and remove still re-read from the server before showing changes. Update the header comment.
- `prefers-reduced-motion`: no scale and no shift transition; photos jump to their slot.
- No change to the DB or the RPC `reorder_listing_photos`.

## Testing (test first)

- **Vitest** (`photo-order.ts`):
  - `moveTo` forwards, backwards, to 0 (cover), to the last index;
  - same index;
  - unknown id;
  - out-of-range index clamped.
- **Playwright** (mobile viewport, touch emulation):
  1. With 6 photos, long-press photo 5 and drag it to slot 1. It shows «Portada», the order persists after reload, and exactly one reorder request is made.
  2. A vertical swipe that starts on a thumbnail scrolls the page and does not reorder.
  3. A short tap does nothing.
  4. With the reorder request forced to fail, the order reverts and the alert shows.
  5. Keyboard: focus «Mover foto 3 antes», press Enter, and photo 3 is now 2. The live region announces it.
- Manual check on a real iPhone and Android, recorded in `docs/pruebas-manuales-revision-ux.md`: long press, haptic on Android, auto-scroll, no text-selection callout.

## Documentation

- `docs/decisiones.md`: reorder by long-press drag, buttons removed (accessible hidden alternatives kept), optimistic reorder.
- `docs/diseno-v1.md`: step 7 (photos) describes the drag.

## Out of scope

- Drag to reorder in other places (none exist).
- Multi-select.
- Desktop-specific drag affordances. Mouse drag works through Pointer Events, but the desktop pass is on hold.
