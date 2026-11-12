// Favoritos (fase 3): se guardan en el teléfono sin cuenta; con sesión se sincronizan con la tabla `favorites`.
// Aquí solo la forma de lo guardado y las operaciones puras (añadir, quitar, mezclar). Sin zod: este módulo entra en el
// JS que hidrata la ficha SSR (el corazón) y zod/mini sumaba ~7 KB gz allí.

export const FAVORITES_KEY = "3bstays-favoritos";
export const MAX_FAVORITES = 100;

export interface FavoriteEntry {
  publicId: string;
  /** ISO 8601. */
  savedAt: string;
}

const PUBLIC_ID = /^CT-\d{4,}$/;

const newestFirst = (list: FavoriteEntry[]) => [...list].sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0)).slice(0, MAX_FAVORITES);

export function parseFavorites(raw: string | null): FavoriteEntry[] {
  if (!raw) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(json)) return [];
  const valid = json.flatMap((item: unknown) => {
    const { publicId, savedAt } = (item ?? {}) as Record<string, unknown>;
    return typeof publicId === "string" && PUBLIC_ID.test(publicId) && typeof savedAt === "string" && !Number.isNaN(Date.parse(savedAt)) ? [{ publicId, savedAt }] : [];
  });
  return mergeFavorites(valid, []);
}

export function serializeFavorites(list: FavoriteEntry[]): string {
  return JSON.stringify(list);
}

export function isFavorite(list: FavoriteEntry[], publicId: string): boolean {
  return list.some((f) => f.publicId === publicId);
}

export function addFavorite(list: FavoriteEntry[], publicId: string, savedAt: string): FavoriteEntry[] {
  return newestFirst([{ publicId, savedAt }, ...list.filter((f) => f.publicId !== publicId)]);
}

export function removeFavorite(list: FavoriteEntry[], publicId: string): FavoriteEntry[] {
  return list.filter((f) => f.publicId !== publicId);
}

/** Local ∪ servidor sin duplicados; de cada casa se queda la fecha más reciente; las más nuevas primero, como mucho 100. */
export function mergeFavorites(local: FavoriteEntry[], remote: FavoriteEntry[]): FavoriteEntry[] {
  const by = new Map<string, FavoriteEntry>();
  for (const f of [...local, ...remote]) {
    const seen = by.get(f.publicId);
    if (!seen || f.savedAt > seen.savedAt) by.set(f.publicId, f);
  }
  return newestFirst([...by.values()]);
}
