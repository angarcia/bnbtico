// Geometría pura de arrastrar fotos en el paso 7 (sin dependencias: la importa solo el trozo de fotos).

export const LONG_PRESS_MS = 400, SLOP_PX = 8, LIFT_SCALE = 1.05, EDGE_PX = 48, MAX_SCROLL_PX = 12;

/** Slot rect in the scroller's content coordinates (measured once at lift: rect.top - scroller.top + scrollTop). */
export interface Slot { left: number; top: number; width: number; height: number }

/** Index of the slot containing (x, y); outside every slot (gaps, outside the grid) → `fallback` (the last target shown). */
export function slotAt(slots: readonly Slot[], x: number, y: number, fallback: number): number {
  const i = slots.findIndex((s) => x >= s.left && x < s.left + s.width && y >= s.top && y < s.top + s.height);
  return i < 0 ? fallback : i;
}

/** Translate + uniform scale that puts a tile measured at `from` onto `to` (transform-origin 0 0). */
export function shiftBetween(from: Slot, to: Slot): { x: number; y: number; s: number } {
  return { x: to.left - from.left, y: to.top - from.top, s: to.width / from.width };
}

/** Auto-scroll px per frame: negative near the top edge, positive near the bottom, 0 in the middle; clamped beyond the edges. */
export function edgeSpeed(y: number, top: number, bottom: number): number {
  const up = Math.min(Math.max((EDGE_PX - (y - top)) / EDGE_PX, 0), 1);
  const down = Math.min(Math.max((EDGE_PX - (bottom - y)) / EDGE_PX, 0), 1);
  return Math.round(down * MAX_SCROLL_PX) - Math.round(up * MAX_SCROLL_PX) || 0;
}
