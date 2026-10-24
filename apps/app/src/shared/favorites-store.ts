// Favoritos en el teléfono (localStorage `bnbtico-favoritos`), compartidos por la ficha SSR y el shell. El toque cambia
// la lista al momento; con sesión, después se escribe en la cuenta y, si falla, se vuelve atrás y se avisa. Sin sesión
// guardada nunca se toca la red (ni se descarga supabase-js).
import { useSyncExternalStore } from "react";
import type { FavoritesApi } from "../domain/api";
import { FAVORITES_KEY, addFavorite, isFavorite, mergeFavorites, parseFavorites, removeFavorite, serializeFavorites, type FavoriteEntry } from "../domain/favorites";
import { toast } from "./toast";

/** = SESSION_STORAGE_KEY (data/storage): ese módulo no se importa aquí para no arrastrarlo al JS de la ficha SSR. */
export const STORED_SESSION_KEY = "bnbtico-auth";

export type FavoritesRemote = Pick<FavoritesApi, "add" | "remove">;

interface Deps {
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  /** La API de la cuenta si hay sesión; null sin sesión. */
  remote: () => Promise<FavoritesRemote | null>;
  now: () => string;
  /** La escritura en la cuenta falló (ya se volvió atrás). */
  onError: (error: unknown) => void;
}

export function createFavoritesStore({ storage, remote, now, onError }: Deps) {
  const listeners = new Set<() => void>();
  let list: FavoriteEntry[] | null = null;
  const read = () => {
    try {
      return parseFavorites(storage.getItem(FAVORITES_KEY));
    } catch {
      return [];
    }
  };
  const current = () => (list ??= read());
  const set = (next: FavoriteEntry[]) => {
    list = next;
    try {
      storage.setItem(FAVORITES_KEY, serializeFavorites(next));
    } catch {
      /* sin almacenamiento (modo privado): vale para esta visita */
    }
    listeners.forEach((l) => l());
  };

  return {
    list: current,
    has: (publicId: string) => isFavorite(current(), publicId),
    replace: set,
    /** Otra pestaña cambió la lista. */
    reload() {
      list = read();
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    toggle(publicId: string) {
      const before = current().find((f) => f.publicId === publicId);
      set(before ? removeFavorite(current(), publicId) : addFavorite(current(), publicId, now()));
      void remote()
        .then((api) => api && (before ? api.remove(publicId) : api.add(publicId)))
        .catch((error: unknown) => {
          set(before ? addFavorite(current(), publicId, before.savedAt) : removeFavorite(current(), publicId));
          onError(error);
        });
    },
  };
}

export type FavoritesStore = ReturnType<typeof createFavoritesStore>;

/** Al ingresar (y al abrir la app con sesión): los del teléfono suben a la cuenta y el teléfono se queda con la mezcla. */
export async function syncFavorites(store: FavoritesStore, api: Pick<FavoritesApi, "addMany" | "list">): Promise<void> {
  await api.addMany(store.list().map((f) => f.publicId));
  const remote = await api.list();
  store.replace(mergeFavorites(store.list(), remote));
}

function hasStoredSession(): boolean {
  try {
    return !!localStorage.getItem(STORED_SESSION_KEY);
  } catch {
    return false;
  }
}

/** Los adaptadores ya fallan con DomainError (mensaje en español); lo demás (no se pudo ni descargar el adaptador) es la
 *  red. Sin importar errors.ts: no hace falta en el JS de la ficha SSR. */
export function favoriteErrorMessage(error: unknown): string {
  return error instanceof Error && "kind" in error ? error.message : "Sin conexión. Revise su internet e intente de nuevo.";
}

export const favoritesStore = createFavoritesStore({
  // Sin localStorage (el worker, modo privado estricto) cada llamada falla y el store sigue en memoria.
  storage: { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) },
  remote: async () => (hasStoredSession() ? (await import("../client/supabase-data")).favoritesApi() : null),
  now: () => new Date().toISOString(),
  onError: (error) => toast(favoriteErrorMessage(error)),
});

if (typeof window !== "undefined") addEventListener("storage", (e) => e.key === FAVORITES_KEY && favoritesStore.reload());

const EMPTY: FavoriteEntry[] = [];

export function useFavorites(): FavoriteEntry[] {
  return useSyncExternalStore(favoritesStore.subscribe, favoritesStore.list, () => EMPTY);
}

/** En el servidor y al hidratar, no guardada; después, lo del teléfono. */
export function useIsFavorite(publicId: string): boolean {
  return useSyncExternalStore(favoritesStore.subscribe, () => favoritesStore.has(publicId), () => false);
}
