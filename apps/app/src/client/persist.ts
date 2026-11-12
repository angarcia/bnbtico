// Caché de Query en IndexedDB: una pantalla visitada se pinta sin red al volver a abrir la app.
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";
import { PERSISTED_PRIVATE_KEYS } from "./query-policy";
import { sessionState } from "./session";

const DB = "3bstays";
const STORE = "query-cache";
/** Lecturas públicas, siempre; las privadas (la cuenta), solo mientras haya sesión: al cerrarla se borran de la caché. */
const PUBLIC_KEYS = new Set(["listings", "provinces", "listing", "listing-days", "offer-taken", "favorite-listings", "fx"]);

function persisted(q: Query): boolean {
  const key = String(q.queryKey[0]);
  return PUBLIC_KEYS.has(key) || (PERSISTED_PRIVATE_KEYS.has(key) && sessionState().status === "signed-in");
}
export const PERSIST_MAX_AGE = 24 * 60 * 60_000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbStorage() {
  if (typeof indexedDB === "undefined") return undefined;
  let db: Promise<IDBDatabase> | null = null;
  const run = <T,>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>) =>
    (db ??= openDb()).then(
      (d) =>
        new Promise<T>((resolve, reject) => {
          const req = op(d.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
  return {
    getItem: (key: string) => run<string | undefined>("readonly", (s) => s.get(key) as IDBRequest<string | undefined>).then((v) => v ?? null),
    setItem: (key: string, value: string) => run("readwrite", (s) => s.put(value, key)).then(() => undefined),
    removeItem: (key: string) => run("readwrite", (s) => s.delete(key)).then(() => undefined),
  };
}

export const persistOptions = {
  persister: createAsyncStoragePersister({ storage: idbStorage(), key: "3bstays-query", throttleTime: 1000 }),
  maxAge: PERSIST_MAX_AGE,
  // Cada despliegue empieza con la caché vacía: la forma de los datos puede haber cambiado.
  buster: __BUILD_ID__,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: Query) => q.state.status === "success" && persisted(q),
  },
};
