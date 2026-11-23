// Cambio de marca (2026-11-11): lo que la app guardaba en el teléfono con el nombre anterior (claves `bnbtico…` y la
// base IndexedDB `bnbtico`) ya no se lee. Se borra una vez tras cargar para no dejar datos huérfanos. Retirar este
// módulo cuando ya no queden teléfonos de prueba con la marca anterior.
const LEGACY = /^bnbtico/;

type Stores = {
  localStorage?: Storage;
  sessionStorage?: Storage;
  indexedDB?: Pick<IDBFactory, "deleteDatabase">;
};

function clear(storage: Storage | undefined) {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && LEGACY.test(key)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Almacenamiento bloqueado (modo privado, permisos): no hay nada que limpiar.
  }
}

export function clearLegacyStorage(stores: Stores = globalThis as Stores) {
  clear(stores.localStorage);
  clear(stores.sessionStorage);
  try {
    stores.indexedDB?.deleteDatabase("bnbtico");
  } catch {
    // Sin IndexedDB: nada que borrar.
  }
}
