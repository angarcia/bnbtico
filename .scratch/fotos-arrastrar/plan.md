# Fotos: ordenar arrastrando Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** In step 7 of the publish wizard, the owner reorders photos with a long press and a drag, as in a phone gallery. The order is applied optimistically and saved with one `reorder` call. Keyboard and screen-reader users get two hidden «Mover foto N antes/después» buttons per photo. The tap-to-select state and the «Hacer portada» / «← Antes» / «Después →» row are removed.

**Architecture:**
- Pure order logic in `src/domain/photo-order.ts`: `moveTo`, `reorderOnDrop`, `applyOrder`.
- Pure drag geometry in `src/client/publish/photo-drag.ts`: `slotAt`, `shiftBetween`, `edgeSpeed`, and the constants.
- One React hook, `usePhotoDrag`, in `src/client/publish/use-photo-drag.ts`. It handles Pointer Events, the long-press timer, `setPointerCapture`, rAF transforms and auto-scroll. It sets transforms through `element.style` (CSSOM). There is no `style={}` in JSX, because `tests/unit/architecture.test.ts` forbids it (CSP without `'unsafe-inline'`).
- Optimistic mutation callbacks in `src/client/publish/photo-reorder.ts`, in the same pattern as `useSetAvailable` in `client/owner.ts`: cancel, then patch, then roll back on error, then re-read on settle.
- `photos.tsx` wires it all together. Upload and remove still re-read from the server before they show a change.

**Tech Stack:**
- React 19 and TanStack Query v5.
- Pointer Events, `requestAnimationFrame` and CSS transforms. No library.
- Vitest (node environment, no jsdom).
- Playwright with the Pixel 7 device from `playwright.config.ts` (`hasTouch: true`, `isMobile: true`), with touch sent through CDP `Input.dispatchTouchEvent`.

**Spec:** `.scratch/fotos-arrastrar/spec.md` (2026-10-27).

## Global Constraints

- Long press of **~400 ms** lifts the photo (`LONG_PRESS_MS = 400`).
- Moving more than **8 px** before the lift cancels the gesture (`SLOP_PX = 8`). A short tap also cancels it. Normal scrolling keeps working.
- The lifted photo has `scale(1.05)` and a shadow, and calls `navigator.vibrate?.(10)`.
- The other photos shift with a transform transition of **~150 ms**. Only `transform` is animated.
- Exact copy, in Spanish de Costa Rica, treating the user as **usted**:
  - Help line, shown with ≥ 2 photos: «Mantenga pulsada una foto y arrástrela para cambiar el orden. La primera es la portada.»
  - Error: «No pudimos cambiar las fotos. Intente de nuevo.»
  - Hidden buttons: «Mover foto N antes», «Mover foto N después».
  - Live region: «Foto movida a la posición N», and «Foto movida a la posición 1, portada» for slot 1.
  - The ✕ keeps «Quitar foto N». The tag keeps «Portada».
- **No library.** Use Pointer Events, `setPointerCapture` and rAF only.
- **`pnpm size` stays green.** The «Asistente de publicar» budget is 15 KB gz. On 2026-10-27 it measured about 13.6 KB (publicar 12.2 + location-leaflet 0.8 + resize 0.4 + concurrency 0.2), so there is about 1.4 KB of headroom.
  - If the budget fails, **stop and ask Daniel**. Do not raise the limit silently.
  - `ubicacion-por-punto` also touches this chunk.
- **`prefers-reduced-motion: reduce`:** no 1.05 scale and no shift transition. Photos jump to their slot.
- `touch-action: pan-y` on thumbnails until the lift, and `none` while dragging. Also set `-webkit-touch-callout: none` and `user-select: none` on thumbnails, and `draggable={false}` on the `<img>`.
- No DB, RPC or `PhotosApi` change.
- No `style={}` in JSX and no `dangerouslySetInnerHTML`.
- No new `role="status"`: the photo count is already the only `getByRole("status")` in the step 7 tests. The live region uses `aria-live="polite"` without a role.
- Write the test first. Run it, see it FAIL, implement, then see it PASS.
- Commits in Spanish, in the imperative, one per task with tests green. **No co-author line.** **Do not push.**
- E2E needs `supabase start` (`pnpm db:start`) and a fresh build. Playwright serves `dist` with `vite preview`. Run from `apps/app`:

  ```
  pnpm build && CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm exec playwright test <file>
  ```

## Review Focus

These are the five failures most likely to slip past the spec's tests. Each has a test in the task that owns it.

1. **The list changes during a drag (upload finishing, refetch, or a second finger tapping ✕).**
   - Risk: the hook keeps a stale `ids` snapshot, or React reorders DOM nodes under imperative transforms. It then sends a list the RPC rejects («La lista de fotos cambió…»), or the grid jumbles.
   - Guard:
     - Lifting is refused while uploads are in flight or a change is pending.
     - Any change to `ids` mid-drag cancels the drag with no request.
     - `reorderOnDrop` returns `null` when the snapshot and the current set differ.
     - ✕ is disabled while a photo is lifted.
   - Tests: Task 1 (`reorderOnDrop` with sets that differ) and Task 6 («durante una subida no se levanta; al terminar, el orden incluye la foto nueva», with the request body holding 7 ids).
2. **Drop outside the grid.**
   - Risk: `slotAt` returns −1 or 0, so a release over «Continuar» makes the photo the cover, or clicks Continuar.
   - Guard: outside any slot, the target stays the last slot shown (fallback). Pointer capture keeps `pointerup` on the tile.
   - Tests: Task 3 (`slotAt` fallback) and Task 6 («soltar fuera de la rejilla deja la foto donde se veía»: URL still `/7`, photo 5 at index 1).
3. **Second finger / multi-touch.**
   - Risk: a second `pointerdown` starts a second gesture, or overwrites the first pointer's state. A pinch during the hold lifts a photo.
   - Guard: before the lift, a second pointer cancels the hold. After the lift, other pointers are ignored, and ✕ is disabled.
   - Test: Task 6 («un segundo dedo…»).
4. **A refetch with the old order arrives right after the optimistic update.**
   - Risk: an in-flight `own-listing` fetch resolves after `setQueryData`, or its cancel reverts the state. The grid then snaps back to the old order before the RPC finishes.
   - Guard: `await cancelQueries` before `setQueryData` (TanStack's revert-on-cancel runs inside the cancelled fetch). `isPending` lasts through `onSettled` (the re-read).
   - Test: Task 2 (a node test with a slow `fetchQuery` in flight).
5. **The browser takes the drag after the lift (pointercancel / page scroll), or the page jumps on lift.**
   - Risk: `touch-action` is fixed at `pointerdown`, so switching to `none` after the lift has no effect. The first vertical move after the lift scrolls `.photos-scroll` and fires `pointercancel`.
   - Guard: a **non-passive** native `touchmove` listener on the grid calls `preventDefault()` while lifted. React's `onTouchMove` is passive, so it does not work here.
   - Test: Task 5 («levantar no mueve la página») and Task 6 (the main drag test asserts the `.photos-scroll` `scrollTop` is unchanged and no `pointercancel` happened).

## Touch testing approach (decided)

**CDP `Input.dispatchTouchEvent`** through `page.context().newCDPSession(page)`, wrapped in `tests/e2e/helpers/touch.ts`.

- `page.touchscreen` only taps.
- `locator.dispatchEvent(new PointerEvent(...))` creates untrusted events. `setPointerCapture` throws `NotFoundError` for a pointerId the browser does not know, and those events never trigger `touch-action` or native scrolling. Test 2 (a swipe scrolls) could not mean anything that way.
- CDP touches go through Chromium's real input pipeline. They produce trusted `pointerdown/move/up` with `pointerType: "touch"`, the matching `touchstart/move/end`, real `touch-action` handling, native panning and `pointercancel`.
- The Pixel 7 project already enables touch emulation (`hasTouch`), which CDP touch needs.
- Coordinates are CSS px relative to the viewport, the same as `locator.boundingBox()`.
- Multi-touch: send `touchStart` / `touchMove` with every active point. Chromium compares by `id` to add or move points. `touchEnd` carries no points.
- Wait for the lift deterministically with `await expect(tile).toHaveClass(/is-lifted/)`, not with a fixed sleep. Holds that must *not* lift use `page.waitForTimeout(600)`, because a non-event cannot be awaited.
- **If headless Chromium does not scroll on a CDP touch swipe** (step 1 of Task 5 checks this first), stop and report. Do not swap in synthetic events.

## File Structure

| File | Change |
|---|---|
| `apps/app/src/domain/photo-order.ts` | + `moveTo`, `reorderOnDrop`, `applyOrder`; − `asCover` (Task 4); `moveBy` stays |
| `apps/app/src/client/publish/photo-reorder.ts` | **new**: optimistic callbacks + error copy |
| `apps/app/src/client/publish/photo-drag.ts` | **new**: pure geometry + constants |
| `apps/app/src/client/publish/use-photo-drag.ts` | **new**: the hook (Pointer Events, timer, rAF, auto-scroll) |
| `apps/app/src/client/publish/photos.tsx` | markup, hidden buttons, live region, help line, header comment |
| `apps/app/src/client/publish/fields.tsx` | l.377: helper text loses «Toque una foto…» |
| `apps/app/src/styles/global.css` | `.photos-grid .photo` touch, lifted, shift, reduced motion; `.sr-move`, `.sr-only`; − `.is-selected`, `.photo-pick`, `.photo-actions` |
| `apps/app/tests/unit/photo-order.test.ts` | rewritten for `moveTo` / `reorderOnDrop` / `applyOrder` |
| `apps/app/tests/unit/photo-reorder.test.ts` | **new** |
| `apps/app/tests/unit/photo-drag.test.ts` | **new** |
| `apps/app/tests/e2e/helpers/touch.ts` | **new**: CDP touch helper |
| `apps/app/tests/e2e/fotos-arrastrar.spec.ts` | **new** (default Pixel 7, 412×839: 6 photos fit without inner scroll) |
| `apps/app/tests/e2e/fotos.spec.ts` | l.69–79 and l.94–98: «Hacer portada» / «Mover después» / group replaced |
| `docs/decisiones.md`, `docs/diseno-v1.md`, `docs/pruebas-manuales-revision-ux.md` | Task 8 |

---

### Task 1: Pure order functions (`moveTo`, `reorderOnDrop`, `applyOrder`)

**Files:** `apps/app/src/domain/photo-order.ts`, `apps/app/tests/unit/photo-order.test.ts`

**Interfaces:**
```ts
export function moveTo(ids: readonly string[], id: string, toIndex: number): string[];
/** Order to send on drop, or null = do nothing (same slot, unknown id, or the set changed since the lift). */
export function reorderOnDrop(snapshot: readonly string[], current: readonly string[], id: string, toIndex: number): string[] | null;
/** Photos in `order` with positions 0..n-1; unchanged copy if the sets differ. */
export function applyOrder<T extends { id: string; position: number }>(photos: readonly T[], order: readonly string[]): T[];
```

- [ ] **Step 1: Add the failing tests.** Add them to `tests/unit/photo-order.test.ts`. Keep the existing `moveBy` and `asCover` cases until Task 4.
  ```ts
  describe("moveTo", () => {
    const ids = ["a", "b", "c", "d", "e"];
    it("hacia delante y hacia atrás", () => {
      expect(moveTo(ids, "b", 3)).toEqual(["a", "c", "d", "b", "e"]);
      expect(moveTo(ids, "d", 1)).toEqual(["a", "d", "b", "c", "e"]);
    });
    it("a la portada y al final", () => {
      expect(moveTo(ids, "e", 0)).toEqual(["e", "a", "b", "c", "d"]);
      expect(moveTo(ids, "a", 4)).toEqual(["b", "c", "d", "e", "a"]);
    });
    it("mismo sitio o foto desconocida: la misma lista, copia nueva", () => {
      const same = moveTo(ids, "c", 2);
      expect(same).toEqual(ids);
      expect(same).not.toBe(ids);
      expect(moveTo(ids, "z", 1)).toEqual(ids);
    });
    it("índice fuera de rango se recorta", () => {
      expect(moveTo(ids, "b", 99)).toEqual(["a", "c", "d", "e", "b"]);
      expect(moveTo(ids, "d", -3)).toEqual(["d", "a", "b", "c", "e"]);
      expect(moveTo(ids, "b", 1.6)).toEqual(["a", "c", "b", "d", "e"]); // Math.round
    });
    it("no toca la lista de entrada", () => {
      const input = [...ids];
      moveTo(input, "a", 3);
      expect(input).toEqual(ids);
    });
  });
  describe("reorderOnDrop", () => {
    const snap = ["a", "b", "c"];
    it("devuelve el orden nuevo", () => expect(reorderOnDrop(snap, ["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]));
    it("mismo sitio: null (ninguna petición)", () => expect(reorderOnDrop(snap, snap, "b", 1)).toBeNull());
    it("la lista cambió desde que se levantó: null", () => {
      expect(reorderOnDrop(snap, ["a", "b", "c", "d"], "c", 0)).toBeNull();
      expect(reorderOnDrop(snap, ["a", "c"], "c", 0)).toBeNull();
      expect(reorderOnDrop(snap, ["a", "b", "x"], "a", 2)).toBeNull();
    });
    it("foto que ya no está: null", () => expect(reorderOnDrop(snap, snap, "z", 0)).toBeNull());
  });
  describe("applyOrder", () => {
    const photos = [{ id: "a", position: 0, url: "A" }, { id: "b", position: 1, url: "B" }, { id: "c", position: 2, url: "C" }];
    it("reordena y renumera", () =>
      expect(applyOrder(photos, ["c", "a", "b"])).toEqual([{ id: "c", position: 0, url: "C" }, { id: "a", position: 1, url: "A" }, { id: "b", position: 2, url: "B" }]));
    it("con otro conjunto, copia sin cambios", () => expect(applyOrder(photos, ["a", "b"])).toEqual(photos));
  });
  ```
- [ ] **Step 2:** Run `pnpm test tests/unit/photo-order.test.ts`. Expected: FAIL (`moveTo is not a function` / import errors).
- [ ] **Step 3: Implement the three functions** with the signatures above. `toIndex` is rounded with `Math.round`, then clamped to `[0, ids.length - 1]`. `reorderOnDrop` compares sets by length and membership, then returns `null` when `moveTo` gives the same order. Update the header comment: the full list still goes to `reorder_listing_photos`, and the cover is the first photo.
- [ ] **Step 4:** Run `pnpm test tests/unit/photo-order.test.ts && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `apps/app/src/domain/photo-order.ts apps/app/tests/unit/photo-order.test.ts` with the message «Añade moveTo y el orden al soltar para ordenar fotos arrastrando».

### Task 2: Optimistic reorder (cancel → patch → roll back → re-read)

**Files:** `apps/app/src/client/publish/photo-reorder.ts` (new), `apps/app/tests/unit/photo-reorder.test.ts` (new)

**Interfaces:**
```ts
export const PHOTOS_ERROR = "No pudimos cambiar las fotos. Intente de nuevo.";
/** Copy for the alert: a DomainError with a known kind keeps its message; unknown / non-domain → PHOTOS_ERROR. */
export function photosErrorMessage(e: unknown): string;
export function photoReorderCallbacks(client: QueryClient, userId: string, listingId: string, reread: () => Promise<void>): {
  onMutate(order: string[]): Promise<{ previous: Listing | null | undefined }>;
  onError(error: unknown, order: string[], ctx: { previous: Listing | null | undefined } | undefined): void;
  onSettled(): Promise<void>;
};
```
The query key is `["own-listing", userId, listingId]`, as in `ownListingQuery`. `onMutate` awaits `cancelQueries` on `own-listing` and on `["own-listings", userId]`. It then calls `setQueryData` with `{ ...l, photos: applyOrder(l.photos, order) }`.

- [ ] **Step 1: Write the failing test** in node, with a real `QueryClient` from `@tanstack/react-query`:
  ```ts
  const key = ["own-listing", "u1", "l1"] as const;
  const listing = (order: string[]) => ({ id: "l1", photos: order.map((id, position) => ({ id, position, path: `l1/${id}`, url: id })) }) as unknown as Listing;
  const order = (c: QueryClient) => c.getQueryData<Listing>(key)!.photos.map((p) => p.id);

  it("una relectura en curso con el orden viejo no pisa el orden nuevo", async () => {
    const client = new QueryClient();
    client.setQueryData(key, listing(["a", "b", "c"]));
    const slow = client.fetchQuery({ queryKey: key, queryFn: () => new Promise<Listing>((r) => setTimeout(() => r(listing(["a", "b", "c"])), 30)), staleTime: 0 }).catch(() => {});
    const cb = photoReorderCallbacks(client, "u1", "l1", async () => {});
    await cb.onMutate(["c", "a", "b"]);
    expect(order(client)).toEqual(["c", "a", "b"]);
    await slow;
    await new Promise((r) => setTimeout(r, 40));
    expect(order(client)).toEqual(["c", "a", "b"]);
  });
  it("si falla, vuelve el orden anterior", async () => {
    const client = new QueryClient();
    client.setQueryData(key, listing(["a", "b", "c"]));
    const cb = photoReorderCallbacks(client, "u1", "l1", async () => {});
    const ctx = await cb.onMutate(["b", "a", "c"]);
    cb.onError(new Error("x"), ["b", "a", "c"], ctx);
    expect(order(client)).toEqual(["a", "b", "c"]);
  });
  it("onSettled relee", async () => {
    const reread = vi.fn(async () => {});
    await photoReorderCallbacks(new QueryClient(), "u1", "l1", reread).onSettled();
    expect(reread).toHaveBeenCalledOnce();
  });
  it("mensajes", () => {
    expect(photosErrorMessage(new Error("500"))).toBe("No pudimos cambiar las fotos. Intente de nuevo.");
    expect(photosErrorMessage(new DomainError("Algo salió mal. Intente de nuevo en un momento.", "unknown"))).toBe("No pudimos cambiar las fotos. Intente de nuevo.");
    expect(photosErrorMessage(new DomainError("La lista de fotos cambió. Vuelva a intentarlo.", "conflict"))).toBe("La lista de fotos cambió. Vuelva a intentarlo.");
  });
  ```
  Note: today `message()` in `photos.tsx` shows `GENERIC_MESSAGE` for a 500, because `toDomainError` wraps it as kind `"unknown"`. The spec wants the photos copy, so kind `"unknown"` maps to `PHOTOS_ERROR`.
- [ ] **Step 2:** Run `pnpm test tests/unit/photo-reorder.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `photo-reorder.ts`. Import only `QueryClient` as a type, plus `applyOrder`, `DomainError` and the `Listing` type, so the module stays tiny.
- [ ] **Step 4:** Run `pnpm test tests/unit/photo-reorder.test.ts && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** both files with the message «Añade el reordenado optimista de fotos con vuelta atrás si falla».

### Task 3: Drag geometry (pure)

**Files:** `apps/app/src/client/publish/photo-drag.ts` (new), `apps/app/tests/unit/photo-drag.test.ts` (new)

**Interfaces:**
```ts
export const LONG_PRESS_MS = 400, SLOP_PX = 8, LIFT_SCALE = 1.05, EDGE_PX = 48, MAX_SCROLL_PX = 12;
/** Slot rect in the scroller's content coordinates (measured once at lift: rect.top - scroller.top + scrollTop). */
export interface Slot { left: number; top: number; width: number; height: number }
/** Index of the slot containing (x, y); outside every slot (gaps, outside the grid) → `fallback` (the last target shown). */
export function slotAt(slots: readonly Slot[], x: number, y: number, fallback: number): number;
/** Translate + uniform scale that puts a tile measured at `from` onto `to` (transform-origin 0 0). */
export function shiftBetween(from: Slot, to: Slot): { x: number; y: number; s: number };
/** Auto-scroll px per frame: negative near the top edge, positive near the bottom, 0 in the middle; clamped beyond the edges. */
export function edgeSpeed(y: number, top: number, bottom: number): number;
```
Use a uniform scale (`to.width / from.width`): the cover slot is 2×2, and the cover is about 2.07× a thumbnail in both directions, so the photos are not distorted.

- [ ] **Step 1: Write the failing tests.** These use the real layout at 412 px: three columns, `gap: 8`, a 2×2 cover with `min-height: 224`, and thumbnails with `min-height: 108`.
  ```ts
  const slots: Slot[] = [
    { left: 0, top: 0, width: 220, height: 224 },
    { left: 228, top: 0, width: 106, height: 108 },
    { left: 228, top: 116, width: 106, height: 108 },
    { left: 0, top: 232, width: 106, height: 108 },
    { left: 114, top: 232, width: 106, height: 108 },
    { left: 228, top: 232, width: 106, height: 108 },
  ];
  it("slotAt: dentro de una casilla", () => {
    expect(slotAt(slots, 110, 112, 4)).toBe(0);
    expect(slotAt(slots, 280, 170, 0)).toBe(2);
    expect(slotAt(slots, 150, 300, 0)).toBe(4);
  });
  it("slotAt: en un hueco o fuera de la rejilla, la última casilla mostrada", () => {
    expect(slotAt(slots, 224, 50, 3)).toBe(3);
    expect(slotAt(slots, 100, 900, 1)).toBe(1);
    expect(slotAt(slots, -40, 10, 5)).toBe(5);
  });
  it("shiftBetween", () => {
    expect(shiftBetween(slots[3]!, slots[4]!)).toEqual({ x: 114, y: 0, s: 1 });
    const toCover = shiftBetween(slots[4]!, slots[0]!);
    expect(toCover.x).toBe(-114);
    expect(toCover.y).toBe(-232);
    expect(toCover.s).toBeCloseTo(220 / 106, 5);
  });
  it("edgeSpeed", () => {
    expect(edgeSpeed(100, 100, 500)).toBe(-12);
    expect(edgeSpeed(124, 100, 500)).toBe(-6);
    expect(edgeSpeed(148, 100, 500)).toBe(0);
    expect(edgeSpeed(300, 100, 500)).toBe(0);
    expect(edgeSpeed(476, 100, 500)).toBe(6);
    expect(edgeSpeed(500, 100, 500)).toBe(12);
    expect(edgeSpeed(530, 100, 500)).toBe(12);
    expect(edgeSpeed(40, 100, 500)).toBe(-12);
  });
  ```
- [ ] **Step 2:** Run `pnpm test tests/unit/photo-drag.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** No imports at all.
- [ ] **Step 4:** Run `pnpm test tests/unit/photo-drag.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** both files with the message «Añade la geometría pura para arrastrar fotos».

### Task 4: New step 7 markup — hidden move buttons, live region, help line, optimistic reorder; old UI removed

This task delivers the accessible path end to end, before any drag exists.

**Files:** `photos.tsx`, `fields.tsx` (l.377), `global.css`, `domain/photo-order.ts` (− `asCover`), `tests/unit/photo-order.test.ts` (− `asCover` cases), `tests/e2e/fotos.spec.ts`, `tests/e2e/fotos-arrastrar.spec.ts` (new)

**Decisions resolved:**
- **The move buttons use `aria-disabled="true"`, not `disabled`.** They use it at the ends and while busy, and their handler does nothing in that state. Chrome blurs a focused button when it becomes `disabled`. After «Mover foto 2 antes», the photo is now 1 and its «antes» button is at the end, so focus would drop to `<body>`. `aria-disabled` is still announced as unavailable.
- **The move buttons are visually hidden until `:focus-visible`.** `.sr-move` uses the clip pattern. On `:focus-visible` it shows as a small pill at the bottom of the tile, so a sighted keyboard user sees what has focus. The tile has `overflow: hidden`, so the pill stays inside it.
- **Focus follows the photo.** After a move, a `useLayoutEffect` keyed on `ids.join()` refocuses `[data-photo="<id>"] [data-move="before|after"]`. React may move the focused node with `insertBefore`, which blurs it.
- **The live region** is `<p className="sr-only" aria-live="polite">`, and its text is set when the move is requested (optimistic). Its text is «Foto movida a la posición N» or «Foto movida a la posición 1, portada». Drops in Task 6 use the same announcement.
- **The help line** is `<p className="small muted photos-help">`, rendered between the count row and `.photos-scroll` when `photos.length >= 2`. In `fields.tsx` l.377 the helper becomes «Horizontales, sin teléfonos ni marcas de agua.», which removes «Toque una foto para moverla o hacerla portada; la primera es la portada.».
- **There are two mutations.**
  - `change`, as today, for remove. Its `onSettled` calls `reread`.
  - `reorder` with `photoReorderCallbacks`.
  - `busy = change.isPending || reorder.isPending`.
  - The alert shows `[...notices, change error, reorder error]` through `photosErrorMessage`.
  - The help line, the move buttons and ✕ are blocked while `busy`. Drag gating comes in Task 5.
- **Tile markup:** `<div className="photo…" data-photo={p.id}>` with `<img draggable={false} …>`, the «Portada» tag on index 0, `.remove`, and the two hidden buttons with `data-move`. The `photo-pick` button, `selected`, `aria-pressed`, `.is-selected` and `.photo-actions` are removed, along with their CSS.
- **Header comment of `photos.tsx`.** Rewrite it to say:
  - The grid and the count come from the server list.
  - Upload and remove re-read before they show a change.
  - Reorder (drag or buttons) is shown at once (optimistic) and comes back if the server rejects it.
  - Then the house is re-read.

Steps:
- [ ] **Step 1: Write failing E2E tests** in the new `tests/e2e/fotos-arrastrar.spec.ts`. Use the same setup as `fotos.spec.ts`:
  - `postgrestHarness`, serial mode, `h.reset()` and `injectSession(page, "owner")` in `beforeEach`.
  - Public storage routed to `loft.jpg`, as in the «no pasa de 15» test.
  - The default Pixel 7 viewport.
  - Helpers:
    - `grid = (page) => page.locator(".photos-grid [data-photo]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.photo))`
    - `reorders: string[][]`, filled from `page.on("request")` on `/rest/v1/rpc/reorder_listing_photos`, with `JSON.parse(postData).p_ids`.
  ```ts
  test("teclado: «Mover foto 3 antes» la pone segunda, lo anuncia y el foco la sigue", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 6 });
    const before = (await own(id)).photos.map((p) => p.id);
    await page.goto(`/propietario/publicar/${id}/7`);
    await expect(page.getByText("Mantenga pulsada una foto y arrástrela para cambiar el orden. La primera es la portada.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Hacer portada" })).toHaveCount(0);
    await page.getByRole("button", { name: "Mover foto 3 antes" }).focus();
    await page.keyboard.press("Enter");
    const expected = [before[0], before[2], before[1], ...before.slice(3)];
    await expect.poll(() => grid(page)).toEqual(expected);
    await expect(page.locator('[aria-live="polite"].sr-only')).toHaveText("Foto movida a la posición 2");
    await expect(page.getByRole("button", { name: "Mover foto 2 antes" })).toBeFocused();
    await expect.poll(async () => (await own(id)).photos.map((p) => p.id)).toEqual(expected);
    expect(reorders).toHaveLength(1);
    // A la portada: el «antes» de la foto 1 queda sin efecto y conserva el foco.
    await page.keyboard.press("Enter");
    await expect(page.locator('[aria-live="polite"].sr-only')).toHaveText("Foto movida a la posición 1, portada");
    await expect(page.getByRole("button", { name: "Mover foto 1 antes" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Mover foto 1 antes" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Mover foto 6 después" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator(".photos-grid .photo.cover .tag")).toHaveText("Portada");
  });

  test("si el servidor rechaza el orden, vuelve el anterior y lo dice (teclado)", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 6 });
    const before = (await own(id)).photos.map((p) => p.id);
    await page.route("**/rest/v1/rpc/reorder_listing_photos", (r) => r.fulfill({ status: 500, json: {} }));
    await page.goto(`/propietario/publicar/${id}/7`);
    await page.getByRole("button", { name: "Mover foto 4 después" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('.field-error[role="alert"]')).toHaveText("No pudimos cambiar las fotos. Intente de nuevo.");
    await expect.poll(() => grid(page)).toEqual(before);
  });

  test("con una sola foto no sale la ayuda de arrastrar", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 1 });
    await page.goto(`/propietario/publicar/${id}/7`);
    await expect(page.getByRole("status")).toHaveText("1 de 5–15");
    await expect(page.getByText(/Mantenga pulsada una foto/)).toHaveCount(0);
  });
  ```
  Also update `tests/e2e/fotos.spec.ts`:
  - l.69–79 becomes: focus «Mover foto 3 antes» and press Enter twice. Assert that the cover `img` now has `l.photos[2].url` and that the DB order is `[2,0,1,3,4,5]`. Then do one «Mover foto 2 después». It keeps the same `expect.poll` as before.
  - l.94–98: remove the «Foto 4» click and the group assertion, and keep the no-page-scroll assertion.
- [ ] **Step 2:** Run `pnpm build && pnpm exec playwright test tests/e2e/fotos-arrastrar.spec.ts tests/e2e/fotos.spec.ts` (with `CHROMIUM_PATH`). Expected: FAIL. No «Mover foto 3 antes» button exists, and there is no help text.
- [ ] **Step 3: Implement** the markup, the mutations, the focus effect, the live region and the CSS:
  - Add `.sr-only` (the clip pattern).
  - Add `.photos-grid .sr-move` (clip pattern; `:focus-visible` → absolute pill at the bottom, `z-index: 1`).
  - Remove `.photo-pick`, `.is-selected` and `.photo-actions`.
  - Remove `asCover` and its test case. `moveBy` stays and feeds the buttons.
- [ ] **Step 4:** Run `pnpm test && pnpm typecheck && pnpm build && pnpm exec playwright test tests/e2e/fotos-arrastrar.spec.ts tests/e2e/fotos.spec.ts tests/e2e/publicar.spec.ts`. Expected: PASS. `publicar.spec.ts` checks `expectNoScroll` on step 7 with 5 photos, and the help line must not make the page scroll at 375×667. If it does, use `xs` for the help line rather than shrinking the grid.
- [ ] **Step 5:** Run `pnpm size`. Expected: «Asistente de publicar» < 15 KB. Write down the figure for the final task.
- [ ] **Step 6: Commit** `photos.tsx fields.tsx global.css photo-order.ts photo-order.test.ts fotos.spec.ts fotos-arrastrar.spec.ts` with the message «Paso 7: ordenar fotos con botones accesibles y al instante; quita «Hacer portada», «Antes» y «Después»».

### Task 5: CDP touch helper + long press (lift and cancel, no reorder yet)

**Files:** `apps/app/tests/e2e/helpers/touch.ts` (new), `apps/app/src/client/publish/use-photo-drag.ts` (new), `photos.tsx`, `global.css`, `tests/e2e/fotos-arrastrar.spec.ts`

**Interfaces:**
```ts
// tests/e2e/helpers/touch.ts
export interface Finger { x: number; y: number }
export async function touch(page: Page): Promise<{
  down(x: number, y: number): Promise<void>;                   // touchStart, id 0
  move(x: number, y: number, steps?: number): Promise<void>;   // touchMove, interpolated from the last point (default 10 steps)
  second(x: number, y: number): Promise<void>;                 // touchStart with [finger0, finger1]
  up(): Promise<void>;                                         // touchEnd, no points
  center(locator: Locator): Promise<Finger>;                   // boundingBox centre
}>;

// src/client/publish/use-photo-drag.ts
export interface PhotoDragOptions {
  ids: readonly string[];
  /** false while uploads are in flight or a change is pending: no lift; turning false mid-gesture cancels it. */
  enabled: boolean;
  scroller: RefObject<HTMLElement | null>;
  onDrop(order: string[], id: string): void;
}
export interface PhotoDrag {
  gridRef: RefObject<HTMLDivElement | null>;
  /** Photo lifted right now (drives `.is-lifted` and `.photos-grid.is-dragging`), or null. */
  liftedId: string | null;
  onPointerDown(e: React.PointerEvent<HTMLElement>, id: string): void;
}
export function usePhotoDrag(o: PhotoDragOptions): PhotoDrag;
```

What the hook does in this task:
- `onPointerDown` does nothing when:
  - the hook is not enabled;
  - the target is inside a `button` (✕ or move buttons);
  - it is not the primary button (`e.button !== 0`);
  - a gesture already exists.
- A second pointer during the hold cancels the hold. This is done in Task 6, but code the guard here.
- It stores `{ id, pointerId, x0, y0, timer }` in a ref and adds `pointermove/up/cancel` listeners on `window`, removed on end.
- Moving more than `SLOP_PX` before the timer fires, `pointerup` or `pointercancel` clears the timer.
- The timer (`LONG_PRESS_MS`) lifts the photo:
  - `setPointerCapture`;
  - measure the slots once in content coordinates;
  - store a snapshot of `ids`;
  - set `liftedId`;
  - `navigator.vibrate?.(10)`;
  - apply `translate(0,0) scale(LIFT_SCALE)`, or no scale when `matchMedia("(prefers-reduced-motion: reduce)")` matches.
- In this task, release after the lift returns the tile and calls nothing.
- A native `touchmove` listener on `gridRef` with `{ passive: false }` calls `preventDefault()` while lifted (Review Focus 5).
- `onContextMenu` on the tile calls `preventDefault()`, so the Android long-press menu over the image does not open.
- CSS:
  - `.photos-grid .photo:not(.uploading){touch-action:pan-y;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;transform-origin:0 0}`
  - `.photos-grid.is-dragging .photo{touch-action:none}`
  - `.photos-grid .photo.is-lifted{z-index:2;transform-origin:50% 50%;box-shadow:var(--shadow-lift, 0 12px 28px rgba(28,43,42,.28))}`. Use an existing shadow token if `tokens.json` has one.
- `photos.tsx` passes `enabled={!busy && uploads.length === 0}` and disables ✕ while `drag.liftedId`.

- [ ] **Step 1: Write the failing tests.** First check that the touch path is real: if the swipe test cannot scroll even before any app change, stop (see the touch testing approach).
  ```ts
  test.describe("tocar y arrastrar", () => {
    test.use({ viewport: { width: 375, height: 667 } }); // the grid scrolls inside: needed for the swipe test
    test("deslizar en vertical sobre una foto hace scroll y no reordena", async ({ page }) => {
      const { id } = await h.seed({ status: "draft", photos: 12 });
      const before = (await own(id)).photos.map((p) => p.id);
      await page.goto(`/propietario/publicar/${id}/7`);
      const scroller = page.locator(".photos-scroll");
      const t = await touch(page);
      const p = await t.center(page.locator(".photos-grid [data-photo]").nth(4));
      await t.down(p.x, p.y);
      await t.move(p.x, p.y - 200, 10); // no pause: a pan, not a long press
      await t.up();
      await expect.poll(() => scroller.evaluate((e) => e.scrollTop)).toBeGreaterThan(50);
      await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
      expect(await grid(page)).toEqual(before);
      expect(reorders).toHaveLength(0);
    });
  });
  test("un toque corto no hace nada", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 6 });
    const before = (await own(id)).photos.map((p) => p.id);
    await page.goto(`/propietario/publicar/${id}/7`);
    const t = await touch(page);
    const p = await t.center(page.locator(".photos-grid [data-photo]").nth(2));
    await t.down(p.x, p.y);
    await page.waitForTimeout(120);
    await t.up();
    await page.waitForTimeout(600);
    await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
    expect(await grid(page)).toEqual(before);
    expect(reorders).toHaveLength(0);
  });
  test("mantener pulsada levanta la foto sin mover la página; el ✕ no levanta", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 6 });
    await page.goto(`/propietario/publicar/${id}/7`);
    const scrollBefore = await page.evaluate(() => [window.scrollY, document.querySelector(".photos-scroll")!.scrollTop]);
    const t = await touch(page);
    const tile = page.locator(".photos-grid [data-photo]").nth(3);
    const p = await t.center(tile);
    await t.down(p.x, p.y);
    await expect(tile).toHaveClass(/is-lifted/);
    await expect(page.locator(".photos-grid")).toHaveClass(/is-dragging/);
    expect(await page.evaluate(() => [window.scrollY, document.querySelector(".photos-scroll")!.scrollTop])).toEqual(scrollBefore);
    await t.up();
    await expect(tile).not.toHaveClass(/is-lifted/);
    expect(reorders).toHaveLength(0);
    // Long press on the ✕ of photo 2: nothing lifts and nothing is removed.
    const x = await t.center(page.getByRole("button", { name: "Quitar foto 2" }));
    await t.down(x.x, x.y);
    await page.waitForTimeout(600);
    await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
    await t.up();
    await expect(page.getByRole("status")).toHaveText("6 de 5–15");
  });
  ```
  Note: Chromium's gesture detector turns a hold of 600 ms into a long-press, not a tap, so no `click` reaches ✕ and the count stays 6. If this proves wrong in practice, drop only the last assertion. A long press on ✕ that removes the photo would be today's behavior, not a regression. Do not add code to suppress it.
- [ ] **Step 2:** Run `pnpm build && pnpm exec playwright test tests/e2e/fotos-arrastrar.spec.ts`. Expected: FAIL on `is-lifted`. The swipe test should already PASS. If it does not, stop.
- [ ] **Step 3: Implement** the helper, the hook (lift and cancel only), the wiring and the CSS above.
- [ ] **Step 4:** Run `pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test tests/e2e/fotos-arrastrar.spec.ts tests/e2e/fotos.spec.ts`. Expected: PASS, and no CSP violations. `element.style` is CSSOM, which the CSP allows.
- [ ] **Step 5: Commit** `use-photo-drag.ts photos.tsx global.css tests/e2e/helpers/touch.ts tests/e2e/fotos-arrastrar.spec.ts` with the message «Paso 7: mantener pulsada una foto la levanta; deslizar sigue haciendo scroll».

### Task 6: Drag, shift and drop (one optimistic reorder)

**Files:** `use-photo-drag.ts`, `photos.tsx`, `global.css`, `tests/e2e/fotos-arrastrar.spec.ts`

Hook behavior added in this task:
- **Move:** while lifted, `pointermove` stores the last point and schedules one rAF per frame.
  - The rAF puts the lifted tile at `translate(dx, dy + scrollDelta) scale(1.05)`.
  - It computes `to = slotAt(slots, xContent, yContent, to)`.
  - For each other tile whose index in `moveTo(snapshot, id, to)` differs from its index in `snapshot`, it sets `shiftBetween(slots[i], slots[j])` as `translate(xpx,ypx) scale(s)`.
  - Other tiles get `transform: ""`.
- **Shift transition:** `.photos-grid.is-dragging .photo:not(.is-lifted){transition:transform 150ms var(--ease-out)}`. The lifted tile has no transition.
- **Drop:**
  - `order = reorderOnDrop(snapshot, latestIds.current, id, to)`.
  - If the order is `null`, all transforms are cleared with the transition (the photos glide back) and no request is made.
  - Otherwise, the hook keeps the transforms, stores `awaiting = order.join()`, sets `liftedId` to null and calls `onDrop(order, id)`.
  - A `useLayoutEffect` on `ids.join()`, when it equals `awaiting`, adds `.is-settling` to the grid (`transition: none !important`), clears every transform, reads `offsetWidth`, and removes the class on the next rAF. The grid therefore never snaps back.
  - A safety timeout of 1 s clears the transforms anyway.
  - The lifted photo jumps from the finger to its slot at commit. This was accepted: no FLIP, to save bytes.
- **Cancel:**
  - `pointercancel`, or `enabled` turning false, clears everything with no request.
  - So does any change of `ids.join()` mid-gesture. This guards list changes and refetches during a drag (Review Focus 1).
- **Multi-touch:**
  - A `pointerdown` with a different `pointerId` cancels the gesture during the hold.
  - After the lift it is ignored.
  - ✕ is `disabled` while `liftedId`.
- **`photos.tsx`:** `onDrop = (order, id) => { announce(order.indexOf(id)); reorder.mutate(order); }`.

- [ ] **Step 1: Write the failing tests.** Use the default Pixel 7 viewport, where 6 photos fit without inner scroll.
  ```ts
  /** Long press on tile `from` (0-based), then drag to the centre of `target`, then release. */
  async function drag(page: Page, from: number, target: { x: number; y: number }) {
    const t = await touch(page);
    const tile = page.locator(".photos-grid [data-photo]").nth(from);
    const p = await t.center(tile);
    await t.down(p.x, p.y);
    await expect(tile).toHaveClass(/is-lifted/);
    await t.move(target.x, target.y, 12);
    await t.up();
  }
  test("6 fotos: arrastrar la 5 a la portada; queda «Portada», se guarda y hace una sola petición", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 6 });
    const b = (await own(id)).photos.map((p) => p.id);
    await page.goto(`/propietario/publicar/${id}/7`);
    const scrollTop = await page.locator(".photos-scroll").evaluate((e) => e.scrollTop);
    await page.evaluate(() => { (window as any).__cancels = 0; addEventListener("pointercancel", () => (window as any).__cancels++, true); });
    const cover = await (await touch(page)).center(page.locator(".photos-grid .photo.cover"));
    await drag(page, 4, cover);
    const expected = [b[4], b[0], b[1], b[2], b[3], b[5]];
    await expect.poll(() => grid(page)).toEqual(expected);
    await expect(page.locator(`.photos-grid .photo.cover[data-photo="${b[4]}"] .tag`)).toHaveText("Portada");
    await expect(page.locator('[aria-live="polite"].sr-only')).toHaveText("Foto movida a la posición 1, portada");
    expect(await page.evaluate(() => (window as any).__cancels)).toBe(0);
    expect(await page.locator(".photos-scroll").evaluate((e) => e.scrollTop)).toBe(scrollTop);
    await expect.poll(async () => (await own(id)).photos.map((p) => p.id)).toEqual(expected);
    expect(reorders).toEqual([expected]);
    await page.reload();
    await expect.poll(() => grid(page)).toEqual(expected);
  });
  test("soltar en su sitio no hace ninguna petición", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 6 });
    await page.goto(`/propietario/publicar/${id}/7`);
    const tile = page.locator(".photos-grid [data-photo]").nth(3);
    const p = await (await touch(page)).center(tile);
    await drag(page, 3, { x: p.x + 20, y: p.y + 10 });
    await page.waitForTimeout(300);
    expect(reorders).toHaveLength(0);
  });
  test("soltar fuera de la rejilla deja la foto donde se veía (y no toca «Continuar»)", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 6 });
    const b = (await own(id)).photos.map((p) => p.id);
    await page.goto(`/propietario/publicar/${id}/7`);
    const t = await touch(page);
    const tile = page.locator(".photos-grid [data-photo]").nth(4);
    const p = await t.center(tile);
    const slot2 = await t.center(page.locator(".photos-grid [data-photo]").nth(1));
    const cont = await t.center(page.getByRole("button", { name: "Continuar" }));
    await t.down(p.x, p.y);
    await expect(tile).toHaveClass(/is-lifted/);
    await t.move(slot2.x, slot2.y, 10);
    await t.move(cont.x, cont.y, 10);
    await t.up();
    const expected = [b[0], b[4], b[1], b[2], b[3], b[5]];
    await expect.poll(() => grid(page)).toEqual(expected);
    await expect(page).toHaveURL(/\/7$/);
    expect(reorders).toEqual([expected]);
  });
  test("si el servidor rechaza el orden al soltar, vuelve el anterior y avisa", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 6 });
    const b = (await own(id)).photos.map((p) => p.id);
    await page.route("**/rest/v1/rpc/reorder_listing_photos", (r) => r.fulfill({ status: 500, json: {} }));
    await page.goto(`/propietario/publicar/${id}/7`);
    await drag(page, 4, await (await touch(page)).center(page.locator(".photos-grid .photo.cover")));
    await expect(page.locator('.field-error[role="alert"]')).toHaveText("No pudimos cambiar las fotos. Intente de nuevo.");
    await expect.poll(() => grid(page)).toEqual(b);
  });
  test("un segundo dedo: antes de levantar cancela; después se ignora y no quita fotos", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 6 });
    const b = (await own(id)).photos.map((p) => p.id);
    await page.goto(`/propietario/publicar/${id}/7`);
    const t = await touch(page);
    const tiles = page.locator(".photos-grid [data-photo]");
    const p = await t.center(tiles.nth(4));
    // (a) Second finger during the hold: nothing lifts.
    await t.down(p.x, p.y);
    await page.waitForTimeout(100);
    const other = await t.center(tiles.nth(2));
    await t.second(other.x, other.y);
    await page.waitForTimeout(600);
    await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
    await t.up();
    // (b) Second finger on the ✕ of photo 2 after the lift: ignored; the drop applies; 6 photos remain.
    await t.down(p.x, p.y);
    await expect(tiles.nth(4)).toHaveClass(/is-lifted/);
    const x = await t.center(page.getByRole("button", { name: "Quitar foto 2" }));
    await t.second(x.x, x.y);
    const cover = await t.center(page.locator(".photos-grid .photo.cover"));
    await t.move(cover.x, cover.y, 12); // moves finger 0; finger 1 stays put
    await t.up();
    await expect.poll(() => grid(page)).toEqual([b[4], b[0], b[1], b[2], b[3], b[5]]);
    await expect(page.getByRole("status")).toHaveText("6 de 5–15");
    expect(reorders).toHaveLength(1);
  });
  test("durante una subida no se levanta; al terminar, el orden incluye la foto nueva", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 6 });
    await page.unroute("**/storage/v1/object/public/**"); // real upload for this test
    await page.route("**/storage/v1/object/listings/**", async (r) => {
      if (r.request().method() === "POST") await new Promise((s) => setTimeout(s, 800));
      await r.continue();
    });
    await page.goto(`/propietario/publicar/${id}/7`);
    await page.getByLabel("Añadir fotos").setInputFiles([foto("hero.jpg")]);
    await expect(page.getByRole("progressbar")).toBeVisible();
    const t = await touch(page);
    const tile = page.locator(".photos-grid [data-photo]").nth(4);
    const p = await t.center(tile);
    await t.down(p.x, p.y);
    await page.waitForTimeout(600);
    await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
    await t.up();
    await expect(page.getByRole("status")).toHaveText("7 de 5–15", { timeout: 20_000 });
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await drag(page, 4, await t.center(page.locator(".photos-grid .photo.cover")));
    await expect.poll(() => reorders.length).toBe(1);
    expect(reorders[0]).toHaveLength(7);
    expect(reorders[0]).toEqual(expect.arrayContaining((await own(id)).photos.map((p) => p.id)));
  });
  ```
  Notes:
  - In this file, the public-storage route goes in `beforeEach` (`page.route`), so the upload test can `unroute` it.
  - `foto()` is the same helper as in `fotos.spec.ts`; copy its two lines.
  - The 7-photo layout puts the new photo after the 6. Index 4 is still a seeded photo.
- [ ] **Step 2:** Run `pnpm build && pnpm exec playwright test tests/e2e/fotos-arrastrar.spec.ts`. Expected: FAIL. Nothing reorders on drop.
- [ ] **Step 3: Implement** move, shift, drop, cancel and multi-touch as described.
- [ ] **Step 4:** Run `pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test tests/e2e/fotos-arrastrar.spec.ts tests/e2e/fotos.spec.ts tests/e2e/publicar.spec.ts`. Expected: PASS. Repeat `fotos-arrastrar.spec.ts` with `--repeat-each=3` to catch flakiness.
- [ ] **Step 5:** Run `pnpm size`. Expected: green. If it is red, stop and ask (Global Constraints).
- [ ] **Step 6: Commit** `use-photo-drag.ts photos.tsx global.css tests/e2e/fotos-arrastrar.spec.ts` with the message «Paso 7: arrastrar una foto la cambia de sitio al instante con un solo guardado».

### Task 7: Auto-scroll near the edges + reduced motion

**Files:** `use-photo-drag.ts`, `global.css`, `tests/e2e/fotos-arrastrar.spec.ts`

- While lifted, one rAF loop runs `scroller.scrollTop += edgeSpeed(lastY, scrollerRect.top, scrollerRect.bottom)`. `scrollerRect` is measured at lift.
- After each scroll step, the loop recomputes `to` and the lifted transform with the scroll delta, because slots are in content coordinates.
- The loop stops when the speed is 0, or on drop or cancel.
- Reduced motion:
  - `@media (prefers-reduced-motion:reduce){.photos-grid.is-dragging .photo{transition:none}}`.
  - The hook drops `scale(1.05)` (checked at lift).

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test.describe("rejilla con scroll", () => {
    test.use({ viewport: { width: 375, height: 667 } });
    test("cerca del borde de arriba la rejilla se desplaza sola y se puede soltar en la portada", async ({ page }) => {
      const { id } = await h.seed({ status: "draft", photos: 12 });
      const b = (await own(id)).photos.map((p) => p.id);
      await page.goto(`/propietario/publicar/${id}/7`);
      const scroller = page.locator(".photos-scroll");
      await scroller.evaluate((e) => (e.scrollTop = e.scrollHeight));
      const t = await touch(page);
      const last = page.locator(".photos-grid [data-photo]").nth(11);
      const p = await t.center(last);
      await t.down(p.x, p.y);
      await expect(last).toHaveClass(/is-lifted/);
      const box = (await scroller.boundingBox())!;
      await t.move(box.x + 60, box.y + 6, 12); // into the 48 px top band
      await expect.poll(() => scroller.evaluate((e) => e.scrollTop), { timeout: 5_000 }).toBe(0);
      await t.move(box.x + 60, box.y + 60, 4); // over the cover, out of the band
      await t.up();
      await expect.poll(() => grid(page)).toEqual([b[11], ...b.slice(0, 11)]);
    });
  });
  test("con movimiento reducido: sin escala al levantar y sin transición al apartarse", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { id } = await h.seed({ status: "draft", photos: 6 });
    await page.goto(`/propietario/publicar/${id}/7`);
    const t = await touch(page);
    const tile = page.locator(".photos-grid [data-photo]").nth(4);
    const p = await t.center(tile);
    await t.down(p.x, p.y);
    await expect(tile).toHaveClass(/is-lifted/);
    expect(await tile.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a)).toBe(1);
    expect(await page.locator(".photos-grid [data-photo]").nth(0).evaluate((e) => getComputedStyle(e).transitionDuration)).toBe("0s");
    await t.up();
  });
  ```
  Also add one assertion to the main drag test (Task 6) in normal motion, checked while lifted: `DOMMatrix(...).a` is close to `1.05`, and a non-lifted tile has `transitionDuration === "0.15s"`. To do this, split `drag()` so it can be inspected before `up()`.
- [ ] **Step 2:** Run `pnpm build && pnpm exec playwright test tests/e2e/fotos-arrastrar.spec.ts`. Expected: FAIL. `scrollTop` stays at its maximum, and with reduced motion the scale is 1.05.
- [ ] **Step 3: Implement** the auto-scroll loop and reduced motion.
- [ ] **Step 4:** Run `pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test tests/e2e/fotos-arrastrar.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `use-photo-drag.ts global.css tests/e2e/fotos-arrastrar.spec.ts` with the message «Paso 7: la rejilla se desplaza sola al arrastrar cerca del borde y respeta el movimiento reducido».

### Task 8: Documentation (decisión, diseño, prueba manual)

**Files:** `docs/decisiones.md`, `docs/diseno-v1.md`, `docs/pruebas-manuales-revision-ux.md`

- [ ] **Step 1: Add a new top entry to `docs/decisiones.md`,** «## 2026-10-27 · Fotos: ordenar arrastrando», with «Decisión de Daniel (lluvia de ideas «Mejoras fase R y 3», proyecto 3 de 4).». Bullets:
  - **Qué:**
    - Mantener pulsada una foto (~400 ms) la levanta (×1,05, vibración en Android).
    - Al arrastrar, las demás se apartan.
    - Al soltar, el orden se aplica al instante y se guarda con una sola llamada a `reorder_listing_photos`.
    - Si falla, vuelve el anterior con «No pudimos cambiar las fotos. Intente de nuevo.».
    - Moverse más de 8 px antes o un toque corto cancela, y el scroll sigue funcionando.
  - **Quitado:** tocar para elegir, «Hacer portada», «← Antes» y «Después →». La portada es la primera y se cambia arrastrando a la casilla 1.
  - **Accesible:**
    - Dos botones ocultos por foto, «Mover foto N antes/después», que se ven al enfocarlos con el teclado.
    - Usan `aria-disabled` en los extremos, para no perder el foco.
    - El foco sigue a la foto, y se anuncia «Foto movida a la posición N».
  - **Regla que cambia:** «nada se reordena en el navegador por su cuenta» deja de valer para el orden (optimista). Subir y quitar siguen releyendo antes de mostrar.
  - **Cómo:**
    - Sin librería: Pointer Events, `setPointerCapture`, rAF, solo `transform`.
    - Un `touchmove` no pasivo impide que el navegador se quede el gesto tras levantar.
    - Pruebas con toques reales por CDP (`tests/e2e/helpers/touch.ts`).
    - Peso del asistente: X KB de 15 (rellenar con la cifra de la Tarea 9).
  - **Decisiones menores:**
    - Soltar fuera de la rejilla deja la foto en la última casilla mostrada.
    - Un segundo dedo cancela antes de levantar y se ignora después.
    - Durante una subida no se puede arrastrar.
    - La foto soltada salta a su casilla, sin animación de asiento.
- [ ] **Step 2: Update `docs/diseno-v1.md`,** item 11, step (7). After «la rejilla hace scroll por dentro», add: «; con 2 fotos o más, «Mantenga pulsada una foto y arrástrela para cambiar el orden. La primera es la portada.»: mantener pulsada la levanta, al arrastrar las demás se apartan y al soltar queda en su sitio (la primera lleva «Portada»); cada foto conserva solo su ✕ («Quitar foto N») y, para teclado y lector de pantalla, «Mover foto N antes/después» ocultos». Item 11 appears twice, at l.5 and l.33. Find both with `grep -n "(7) Fotos" docs/diseno-v1.md` and update both the same way.
- [ ] **Step 3: Add rows U44–U48 to `docs/pruebas-manuales-revision-ux.md`,** in the table «Propietaria nueva: publicar (C4, A1)», after U29. Each row has «☐». The device column is «iPhone y Android» unless the row says otherwise.
  - U44: paso 7 con 6+ fotos: mantener pulsada una foto ~½ s. Se agranda un poco con sombra. **En Android vibra** (en iPhone no). **No** sale el menú de la imagen ni la lupa o selección de texto.
  - U45: arrastrarla a la portada y soltar. Las demás se apartan mientras arrastra. Al soltar queda primera con «Portada», sin parpadeo de vuelta. Tras recargar, sigue igual.
  - U46: con 12+ fotos, arrastrar la última hacia el borde de arriba de la rejilla. La rejilla baja sola hasta la portada.
  - U47: deslizar el dedo en vertical empezando sobre una foto. Hace scroll normal y no levanta ninguna. Un toque corto no hace nada.
  - U48 (opcional, iPhone con VoiceOver): dos dedos hacia la derecha hasta «Mover foto 3 antes», luego doble toque. Dice «Foto movida a la posición 2».
- [ ] **Step 4:** Run `grep -n "Hacer portada\|Toque una foto" docs/diseno-v1.md docs/pruebas-manuales-revision-ux.md apps/app/src apps/app/tests`. Expected: no current-rule hits (history in `decisiones.md` is fine).
- [ ] **Step 5: Commit** the three docs with the message «Documenta ordenar fotos arrastrando: decisión, diseño del paso 7 y prueba manual».

### Task 9: Final verification

- [ ] **Step 1:** From `apps/app`, run `pnpm typecheck && pnpm test`. Expected: all green, including `architecture.test.ts` (no `style={}`, no raw HTML).
- [ ] **Step 2:** Run `pnpm build && pnpm size`. Expected: every budget green. Write down the «Asistente de publicar» figure and put it in the `decisiones.md` entry (Task 8, «X KB»), in the same commit as this step if it changed.
- [ ] **Step 3:** Run `CHROMIUM_PATH=… pnpm test:e2e`, the whole suite, one worker. Expected: green. Pay attention to `publicar.spec.ts` (no scroll at step 7) and the CSP fixture (no violations from `element.style`).
- [ ] **Step 4:** Run `pnpm exec playwright test tests/e2e/fotos-arrastrar.spec.ts --repeat-each=5`. Expected: 0 flaky.
- [ ] **Step 5: Manual smoke in the local app** (`.claude/launch.json` «app», Pixel 7 emulation in the browser pane):
  - long press, then drag to the cover, then reload;
  - the keyboard Tab shows the «Mover…» pill.
  This is not a substitute for U44–U48 on real phones, which Daniel does.
- [ ] **Step 6:** Run `git status`. Only the files listed in this plan should have changed. **Do not push.** Report the size figure and the commits to Daniel.

---

## Self-review

- **Spec coverage:**
  - help line → T4;
  - long press, 1.05 and vibrate → T5/T7;
  - follow the finger, shift 150 ms and auto-scroll → T6/T7;
  - optimistic drop, one call and re-read → T2/T6;
  - error revert and copy → T2/T4/T6;
  - cancel (same slot, `pointercancel`) → T6;
  - tap or > 8 px cancels, and `pan-y` → `none` → T5;
  - callout and selection → T5;
  - cover is a normal target → T6;
  - ✕ only, with no drag from ✕ → T5;
  - disabled while pending or uploading → T5/T6;
  - removed UI → T4;
  - hidden buttons, `moveBy`, ends, focus and live region → T4;
  - no library and size budget → constraints, T4/T6/T9;
  - pure `moveTo` → T1;
  - header comment → T4;
  - reduced motion → T7;
  - no DB change → constraints;
  - the five Vitest groups and the five Playwright cases → T1, T4–T6;
  - manual check → T8;
  - docs → T8.
- **Ambiguities resolved here (not in the spec):**
  - `aria-disabled` instead of `disabled` for the move buttons;
  - the move buttons show on `:focus-visible`;
  - the live region has no `role="status"`;
  - a drop outside the grid uses the last slot shown;
  - multi-touch rules;
  - an `ids` change mid-drag cancels;
  - a uniform scale for shifts into or out of the 2×2 cover;
  - no settle animation;
  - kind `"unknown"` errors map to the photos copy;
  - the `fields.tsx` helper text is shortened;
  - `asCover` is removed;
  - the E2E viewport is Pixel 7 by default, and 375×667 for the scroll tests.
- **Types are consistent across tasks:** `moveTo`, `reorderOnDrop`, `applyOrder`, `Slot`, `slotAt`, `shiftBetween`, `edgeSpeed`, `photoReorderCallbacks`, `photosErrorMessage`, `usePhotoDrag` / `PhotoDragOptions` / `PhotoDrag`.
- **Risks to watch:**
  - The size budget (about 1.4 KB of headroom, shared with the location work).
  - Whether CDP touch scrolls in headless Chromium. This is checked first in Task 5, with a stop rule.
  - The no-page-scroll at 375×667 with the help line. This is checked in Task 4 against `publicar.spec.ts`.
