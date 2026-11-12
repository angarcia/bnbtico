import { describe, expect, it, vi } from "vitest";
import { clearLegacyStorage } from "../../src/client/legacy-storage";

function memoryStorage(entries: Record<string, string>): Storage {
  const data = new Map(Object.entries(entries));
  return {
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
}

describe("limpieza de lo que guardaba la marca anterior (bnbtico)", () => {
  it("borra las claves bnbtico del teléfono y conserva las de 3bstays y las ajenas", () => {
    const local = memoryStorage({ "bnbtico-auth": "x", "bnbtico_currency": "USD", "bnbticoDescripcion": "1", "3bstays-auth": "y", otra: "z" });
    const session = memoryStorage({ "bnbtico-fechas": "x", "bnbtico-contacto:CT-1042": "x", "3bstays-fechas": "y" });
    const deleteDatabase = vi.fn();
    clearLegacyStorage({ localStorage: local, sessionStorage: session, indexedDB: { deleteDatabase } });
    expect([...Array(local.length)].map((_, i) => local.key(i)).sort()).toEqual(["3bstays-auth", "otra"]);
    expect([...Array(session.length)].map((_, i) => session.key(i))).toEqual(["3bstays-fechas"]);
    expect(deleteDatabase).toHaveBeenCalledWith("bnbtico");
  });

  it("no falla si el almacenamiento no está disponible", () => {
    const broken = { get length(): number { throw new Error("bloqueado"); } } as unknown as Storage;
    expect(() => clearLegacyStorage({ localStorage: broken, sessionStorage: broken, indexedDB: undefined })).not.toThrow();
  });
});
