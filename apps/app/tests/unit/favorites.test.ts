import { describe, expect, it } from "vitest";
import { FAVORITES_KEY, MAX_FAVORITES, addFavorite, isFavorite, mergeFavorites, parseFavorites, removeFavorite, serializeFavorites } from "../../src/domain/favorites";

const at = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString();

describe("favoritos en el teléfono", () => {
  it("la clave del almacenamiento", () => {
    expect(FAVORITES_KEY).toBe("bnbtico-favoritos");
  });

  it("añadir pone la casa primero, sin duplicar; quitar es idempotente", () => {
    let list = addFavorite([], "CT-1000", at(1));
    list = addFavorite(list, "CT-1001", at(2));
    list = addFavorite(list, "CT-1000", at(3));
    expect(list).toEqual([
      { publicId: "CT-1000", savedAt: at(3) },
      { publicId: "CT-1001", savedAt: at(2) },
    ]);
    expect(isFavorite(list, "CT-1001")).toBe(true);
    list = removeFavorite(removeFavorite(list, "CT-1001"), "CT-1001");
    expect(list.map((f) => f.publicId)).toEqual(["CT-1000"]);
    expect(isFavorite(list, "CT-1001")).toBe(false);
  });

  it(`como mucho ${MAX_FAVORITES}: se cae la más antigua`, () => {
    let list = [] as ReturnType<typeof addFavorite>;
    for (let i = 0; i < MAX_FAVORITES + 3; i++) list = addFavorite(list, `CT-${1000 + i}`, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString());
    expect(list).toHaveLength(MAX_FAVORITES);
    expect(list[0]!.publicId).toBe(`CT-${1000 + MAX_FAVORITES + 2}`);
    expect(isFavorite(list, "CT-1002")).toBe(false);
  });

  it("lee lo guardado con tolerancia: basura o entradas raras se descartan", () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites("{rota")).toEqual([]);
    expect(parseFavorites(JSON.stringify({ a: 1 }))).toEqual([]);
    const raw = JSON.stringify([{ publicId: "CT-1000", savedAt: at(1) }, { publicId: "drop table", savedAt: at(2) }, { publicId: "CT-1001" }, 7]);
    expect(parseFavorites(raw)).toEqual([{ publicId: "CT-1000", savedAt: at(1) }]);
    expect(parseFavorites(serializeFavorites([{ publicId: "CT-1002", savedAt: at(2) }]))).toEqual([{ publicId: "CT-1002", savedAt: at(2) }]);
  });

  it("mezcla local ∪ servidor: sin duplicados, la fecha más reciente, las más nuevas primero", () => {
    const local = [
      { publicId: "CT-1000", savedAt: at(5) },
      { publicId: "CT-1001", savedAt: at(1) },
    ];
    const remote = [
      { publicId: "CT-1002", savedAt: at(4) },
      { publicId: "CT-1001", savedAt: at(3) },
    ];
    expect(mergeFavorites(local, remote)).toEqual([
      { publicId: "CT-1000", savedAt: at(5) },
      { publicId: "CT-1002", savedAt: at(4) },
      { publicId: "CT-1001", savedAt: at(3) },
    ]);
  });
});
