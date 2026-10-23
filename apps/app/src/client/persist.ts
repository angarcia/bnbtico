// Caché de Query en IndexedDB: una pantalla visitada se pinta sin red al volver a abrir la app.
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";

const DB = "bnbtico";
const STORE = "query-cache";
/** Solo lecturas públicas: nada que dependa de la sesión se guarda en el dispositivo. */
const PERSISTED = new Set(["listings", "provinces", "listing"]);
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
  persister: createAsyncStoragePersister({ storage: idbStorage(), key: "bnbtico-query", throttleTime: 1000 }),
  maxAge: PERSIST_MAX_AGE,
  // Cada despliegue empieza con la caché vacía: la forma de los datos puede haber cambiado.
  buster: __BUILD_ID__,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: Query) => q.state.status === "success" && PERSISTED.has(String(q.queryKey[0])),
  },
};
