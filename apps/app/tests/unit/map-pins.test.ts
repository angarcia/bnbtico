// Marcadores de precio del mapa de Explorar que se pisan (revisión UX 2026-10-29, C2): se juntan en uno («2 casas»).
import { describe, expect, it } from "vitest";
import { groupPins, pinSize, type Pin } from "../../src/domain/map-pins";

const pin = (id: string, x: number, y: number, label = "₡95 000"): Pin => ({ id, x, y, label });

describe("groupPins", () => {
  it("sin solaparse, cada uno solo", () => {
    expect(groupPins([pin("a", 0, 0), pin("b", 200, 0), pin("c", 0, 100)]).map((g) => g.ids)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("dos que se pisan (el texto de uno tapa el del otro) van juntos, en el punto medio", () => {
    const groups = groupPins([pin("a", 100, 100), pin("b", 130, 110), pin("c", 300, 300)]);
    expect(groups.map((g) => g.ids)).toEqual([["a", "b"], ["c"]]);
    expect(groups[0]).toMatchObject({ x: 115, y: 105 });
  });

  it("en cadena: el que pisa al grupo se une a él", () => {
    const groups = groupPins([pin("a", 100, 100), pin("b", 150, 100), pin("c", 200, 100)]);
    expect(groups.map((g) => g.ids)).toEqual([["a", "b", "c"]]);
  });

  it("el tamaño de la píldora crece con el texto", () => {
    expect(pinSize("₡120 000").w).toBeGreaterThan(pinSize("$80").w);
    expect(pinSize("$80").h).toBe(pinSize("₡120 000").h);
  });
});

describe("pinLabel de un grupo", () => {
  it("«2 casas»", async () => {
    const { groupLabel } = await import("../../src/domain/map-pins");
    expect(groupLabel(2)).toBe("2 casas");
  });
});
