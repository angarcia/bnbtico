import { describe, expect, it } from "vitest";
import { CANTONES, cantonesDe, esCanton } from "../../src/domain/cantones";
import { PROVINCES } from "../../src/domain/listing";

// División territorial oficial: 7 provincias y 84 cantones (los dos últimos: Monteverde 2021 y Puerto Jiménez 2022).

describe("CANTONES", () => {
  it("cubre exactamente las 7 provincias del formulario", () => {
    expect(Object.keys(CANTONES).sort()).toEqual([...PROVINCES].sort());
  });
  it("son 84 cantones sin repetidos dentro de cada provincia", () => {
    const all = Object.values(CANTONES).flat();
    expect(all).toHaveLength(84);
    for (const [prov, list] of Object.entries(CANTONES)) expect(new Set(list).size, prov).toBe(list.length);
  });
  it("reparto por provincia", () => {
    expect(Object.fromEntries(Object.entries(CANTONES).map(([p, l]) => [p, l.length]))).toEqual({
      "San José": 20, Alajuela: 16, Cartago: 8, Heredia: 10, Guanacaste: 11, Puntarenas: 13, Limón: 6,
    });
  });
  it("Limón tiene sus 6 cantones en el orden oficial", () => {
    expect(CANTONES["Limón"]).toEqual(["Limón", "Pococí", "Siquirres", "Talamanca", "Matina", "Guácimo"]);
  });
  it("incluye los dos cantones más recientes", () => {
    expect(CANTONES.Puntarenas).toContain("Monteverde");
    expect(CANTONES.Puntarenas).toContain("Puerto Jiménez");
  });
});

describe("cantonesDe / esCanton", () => {
  it("devuelve la lista de la provincia y vacía para una desconocida", () => {
    expect(cantonesDe("Limón")).toHaveLength(6);
    expect(cantonesDe("Marte")).toEqual([]);
  });
  it("un cantón solo vale dentro de su provincia", () => {
    expect(esCanton("Limón", "Talamanca")).toBe(true);
    expect(esCanton("Guanacaste", "Talamanca")).toBe(false);
    expect(esCanton("Limón", "talamanca")).toBe(false);
    expect(esCanton("Limón", "")).toBe(false);
  });
});
