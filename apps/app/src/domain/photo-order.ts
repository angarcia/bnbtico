// Órdenes de fotos que el propietario pide en el paso 7 (botones o arrastrando); la lista completa va a reorder_listing_photos y la portada es la primera.

export function asCover(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [id, ...ids.filter((x) => x !== id)] : [...ids];
}

export function moveBy(ids: readonly string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

export function moveTo(ids: readonly string[], id: string, toIndex: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return [...ids];
  const to = Math.min(Math.max(Math.round(toIndex), 0), ids.length - 1);
  const next = ids.filter((x) => x !== id);
  next.splice(to, 0, id);
  return next;
}

/** Order to send on drop, or null = do nothing (same slot, unknown id, or the set changed since the lift). */
export function reorderOnDrop(snapshot: readonly string[], current: readonly string[], id: string, toIndex: number): string[] | null {
  if (snapshot.length !== current.length || !snapshot.every((x) => current.includes(x))) return null;
  if (!current.includes(id)) return null;
  const next = moveTo(current, id, toIndex);
  return next.every((x, i) => x === current[i]) ? null : next;
}

/** Photos in `order` with positions 0..n-1; unchanged copy if the sets differ. */
export function applyOrder<T extends { id: string; position: number }>(photos: readonly T[], order: readonly string[]): T[] {
  const byId = new Map(photos.map((p) => [p.id, p]));
  if (order.length !== photos.length || !order.every((id) => byId.has(id))) return [...photos];
  return order.map((id, position) => ({ ...byId.get(id)!, position }));
}
