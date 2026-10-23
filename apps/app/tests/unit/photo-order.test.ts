import { describe, expect, it } from "vitest";
import { asCover, moveBy } from "../../src/domain/photo-order";

describe("orden de fotos", () => {
  const ids = ["a", "b", "c", "d"];
  it("hacer portada pone esa foto la primera y deja el resto en su orden", () => {
    expect(asCover(ids, "c")).toEqual(["c", "a", "b", "d"]);
    expect(asCover(ids, "a")).toEqual(ids);
  });
  it("mover antes o después, sin salirse de la lista", () => {
    expect(moveBy(ids, "c", -1)).toEqual(["a", "c", "b", "d"]);
    expect(moveBy(ids, "c", 1)).toEqual(["a", "b", "d", "c"]);
    expect(moveBy(ids, "a", -1)).toEqual(ids);
    expect(moveBy(ids, "d", 1)).toEqual(ids);
  });
  it("una foto que ya no está no cambia nada", () => {
    expect(asCover(ids, "z")).toEqual(ids);
    expect(moveBy(ids, "z", 1)).toEqual(ids);
  });
});
