import { describe, expect, it } from "vitest";
import { applyOrder, moveBy, moveTo, reorderOnDrop } from "../../src/domain/photo-order";

describe("orden de fotos", () => {
  const ids = ["a", "b", "c", "d"];
  it("mover antes o después, sin salirse de la lista", () => {
    expect(moveBy(ids, "c", -1)).toEqual(["a", "c", "b", "d"]);
    expect(moveBy(ids, "c", 1)).toEqual(["a", "b", "d", "c"]);
    expect(moveBy(ids, "a", -1)).toEqual(ids);
    expect(moveBy(ids, "d", 1)).toEqual(ids);
  });
  it("una foto que ya no está no cambia nada", () => {
    expect(moveBy(ids, "z", 1)).toEqual(ids);
  });
});

describe("moveTo", () => {
  const ids = ["a", "b", "c", "d", "e"];
  it("hacia delante y hacia atrás", () => {
    expect(moveTo(ids, "b", 3)).toEqual(["a", "c", "d", "b", "e"]);
    expect(moveTo(ids, "d", 1)).toEqual(["a", "d", "b", "c", "e"]);
  });
  it("a la portada y al final", () => {
    expect(moveTo(ids, "e", 0)).toEqual(["e", "a", "b", "c", "d"]);
    expect(moveTo(ids, "a", 4)).toEqual(["b", "c", "d", "e", "a"]);
  });
  it("mismo sitio o foto desconocida: la misma lista, copia nueva", () => {
    const same = moveTo(ids, "c", 2);
    expect(same).toEqual(ids);
    expect(same).not.toBe(ids);
    expect(moveTo(ids, "z", 1)).toEqual(ids);
  });
  it("índice fuera de rango se recorta", () => {
    expect(moveTo(ids, "b", 99)).toEqual(["a", "c", "d", "e", "b"]);
    expect(moveTo(ids, "d", -3)).toEqual(["d", "a", "b", "c", "e"]);
    expect(moveTo(ids, "b", 1.6)).toEqual(["a", "c", "b", "d", "e"]); // Math.round
  });
  it("no toca la lista de entrada", () => {
    const input = [...ids];
    moveTo(input, "a", 3);
    expect(input).toEqual(ids);
  });
});

describe("reorderOnDrop", () => {
  const snap = ["a", "b", "c"];
  it("devuelve el orden nuevo", () => expect(reorderOnDrop(snap, ["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]));
  it("mismo sitio: null (ninguna petición)", () => expect(reorderOnDrop(snap, snap, "b", 1)).toBeNull());
  it("la lista cambió desde que se levantó: null", () => {
    expect(reorderOnDrop(snap, ["a", "b", "c", "d"], "c", 0)).toBeNull();
    expect(reorderOnDrop(snap, ["a", "c"], "c", 0)).toBeNull();
    expect(reorderOnDrop(snap, ["a", "b", "x"], "a", 2)).toBeNull();
  });
  it("foto que ya no está: null", () => expect(reorderOnDrop(snap, snap, "z", 0)).toBeNull());
});

describe("applyOrder", () => {
  const photos = [{ id: "a", position: 0, url: "A" }, { id: "b", position: 1, url: "B" }, { id: "c", position: 2, url: "C" }];
  it("reordena y renumera", () =>
    expect(applyOrder(photos, ["c", "a", "b"])).toEqual([{ id: "c", position: 0, url: "C" }, { id: "a", position: 1, url: "A" }, { id: "b", position: 2, url: "B" }]));
  it("con otro conjunto, copia sin cambios", () => expect(applyOrder(photos, ["a", "b"])).toEqual(photos));
});
