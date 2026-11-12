import { describe, expect, it, vi } from "vitest";
import type { FavoritesApi } from "../../src/domain/api";
import { DomainError } from "../../src/domain/errors";
import { FAVORITES_KEY, serializeFavorites } from "../../src/domain/favorites";
import { SESSION_STORAGE_KEY } from "../../src/data/storage";
import { STORED_SESSION_KEY, createFavoritesStore, favoriteErrorMessage, syncFavorites, type FavoritesRemote } from "../../src/shared/favorites-store";

const at = (min: number) => new Date(Date.UTC(2026, 9, 23, 12, min)).toISOString();

function memory(initial?: string) {
  const data = new Map<string, string>(initial ? [[FAVORITES_KEY, initial]] : []);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

const ids = (store: ReturnType<typeof createFavoritesStore>) => store.list().map((f) => f.publicId);

describe("favoritos en el teléfono (store)", () => {
  it("sin sesión: guarda y quita al momento en el almacenamiento, avisa a los suscriptores y no toca la red", async () => {
    const storage = memory();
    let minute = 0;
    const remote = vi.fn(async () => null);
    const store = createFavoritesStore({ storage, remote, now: () => at(minute++), onError: vi.fn() });
    const seen = vi.fn();
    store.subscribe(seen);
    store.toggle("CT-1001");
    store.toggle("CT-1002");
    expect(ids(store)).toEqual(["CT-1002", "CT-1001"]);
    expect(store.has("CT-1001")).toBe(true);
    expect(JSON.parse(storage.data.get(FAVORITES_KEY)!)).toEqual([
      { publicId: "CT-1002", savedAt: at(1) },
      { publicId: "CT-1001", savedAt: at(0) },
    ]);
    store.toggle("CT-1001");
    expect(ids(store)).toEqual(["CT-1002"]);
    expect(seen).toHaveBeenCalledTimes(3);
    await vi.waitFor(() => expect(remote).toHaveBeenCalledTimes(3));
  });

  it("lee lo guardado (y tolera basura)", () => {
    expect(ids(createFavoritesStore({ storage: memory(serializeFavorites([{ publicId: "CT-1009", savedAt: at(0) }])), remote: async () => null, now: () => at(1), onError: () => {} }))).toEqual(["CT-1009"]);
    expect(ids(createFavoritesStore({ storage: memory("{roto"), remote: async () => null, now: () => at(1), onError: () => {} }))).toEqual([]);
  });

  it("otra pestaña cambia la lista: reload vuelve a leer y avisa", () => {
    const storage = memory();
    const store = createFavoritesStore({ storage, remote: async () => null, now: () => at(0), onError: () => {} });
    expect(ids(store)).toEqual([]);
    storage.setItem(FAVORITES_KEY, serializeFavorites([{ publicId: "CT-1003", savedAt: at(0) }]));
    const seen = vi.fn();
    store.subscribe(seen);
    store.reload();
    expect(ids(store)).toEqual(["CT-1003"]);
    expect(seen).toHaveBeenCalledOnce();
  });

  it("con sesión: primero el teléfono y después la cuenta (add/remove)", async () => {
    const api: FavoritesRemote = { add: vi.fn(async () => {}), remove: vi.fn(async () => {}) };
    const store = createFavoritesStore({ storage: memory(), remote: async () => api, now: () => at(0), onError: vi.fn() });
    store.toggle("CT-1001");
    expect(store.has("CT-1001")).toBe(true);
    await vi.waitFor(() => expect(api.add).toHaveBeenCalledWith("CT-1001"));
    store.toggle("CT-1001");
    expect(store.has("CT-1001")).toBe(false);
    await vi.waitFor(() => expect(api.remove).toHaveBeenCalledWith("CT-1001"));
  });

  it("la sesión guardada se busca con la misma clave que usa la cuenta", () => expect(STORED_SESSION_KEY).toBe(SESSION_STORAGE_KEY));

  it("si la cuenta falla, vuelve atrás (con su fecha) y avisa con el error", async () => {
    const add = deferred();
    const remove = deferred();
    const api: FavoritesRemote = { add: () => add.promise, remove: () => remove.promise };
    const onError = vi.fn();
    const storage = memory(serializeFavorites([{ publicId: "CT-1005", savedAt: at(5) }]));
    const store = createFavoritesStore({ storage, remote: async () => api, now: () => at(9), onError });

    store.toggle("CT-1001");
    const notPublished = new DomainError("Esta casa ya no está publicada.", "validation");
    add.reject(notPublished);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(notPublished));
    expect(ids(store)).toEqual(["CT-1005"]);

    store.toggle("CT-1005");
    expect(ids(store)).toEqual([]);
    remove.reject(new TypeError("Failed to fetch"));
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
    expect(store.list()).toEqual([{ publicId: "CT-1005", savedAt: at(5) }]);
    expect(JSON.parse(storage.data.get(FAVORITES_KEY)!)).toEqual([{ publicId: "CT-1005", savedAt: at(5) }]);
  });
});

describe("mensaje al fallar la cuenta", () => {
  it("el del dominio si lo hay; si no, sin conexión", () => {
    expect(favoriteErrorMessage(new DomainError("Su sesión venció. Ingrese de nuevo.", "session"))).toBe("Su sesión venció. Ingrese de nuevo.");
    expect(favoriteErrorMessage(new TypeError("Failed to fetch dynamically imported module"))).toBe("Sin conexión. Revise su internet e intente de nuevo.");
    expect(favoriteErrorMessage("raro")).toBe("Sin conexión. Revise su internet e intente de nuevo.");
  });
});

describe("sincronizar al ingresar", () => {
  it("sube los del teléfono, trae los de la cuenta y deja la mezcla en el teléfono", async () => {
    const store = createFavoritesStore({ storage: memory(serializeFavorites([{ publicId: "CT-1001", savedAt: at(1) }])), remote: async () => null, now: () => at(0), onError: () => {} });
    const calls: string[] = [];
    const api: Pick<FavoritesApi, "addMany" | "list"> = {
      addMany: async (list) => void calls.push(`addMany:${list.join(",")}`),
      list: async () => {
        calls.push("list");
        return [
          { publicId: "CT-1002", savedAt: at(3) },
          { publicId: "CT-1001", savedAt: at(0) },
        ];
      },
    };
    await syncFavorites(store, api);
    expect(calls).toEqual(["addMany:CT-1001", "list"]);
    expect(store.list()).toEqual([
      { publicId: "CT-1002", savedAt: at(3) },
      { publicId: "CT-1001", savedAt: at(1) },
    ]);
  });

  it("lo que se guarda mientras sincroniza no se pierde", async () => {
    const store = createFavoritesStore({ storage: memory(), remote: async () => null, now: () => at(7), onError: () => {} });
    const api: Pick<FavoritesApi, "addMany" | "list"> = {
      addMany: async () => {},
      list: async () => {
        store.toggle("CT-1004");
        return [{ publicId: "CT-1002", savedAt: at(3) }];
      },
    };
    await syncFavorites(store, api);
    expect(ids(store)).toEqual(["CT-1004", "CT-1002"]);
  });
});
