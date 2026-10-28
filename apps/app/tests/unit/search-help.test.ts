// «¿No encuentra lo que busca?» (fase 6, ticket 01): el mensaje redactado para el WhatsApp de atención a clientes.
import { describe, expect, it } from "vitest";
import type { Filters } from "../../src/domain/filters";
import { searchHelpMessage } from "../../src/domain/search-help";

const none: Filters = { prov: "Todas", modes: [], ppl: 0, beds: 0, features: [], min: 0, max: 0, open: false };
const lines = (f: Partial<Filters>) => searchHelpMessage({ ...none, ...f }).split("\n");

describe("searchHelpMessage", () => {
  it("sin filtros: el saludo y «Fechas: » para que el cliente las escriba", () => {
    expect(searchHelpMessage(none)).toBe("Hola, estoy buscando casa en bnbtico.\nFechas: ");
  });

  it("la provincia sale como zona; «Todas las zonas» no se escribe", () => {
    expect(lines({ prov: "Limón" })).toEqual(["Hola, estoy buscando casa en bnbtico.", "Zona: Limón.", "Fechas: "]);
    expect(searchHelpMessage({ ...none, prov: "Todas" })).not.toMatch(/Zona|Todas/);
  });

  it("personas", () => {
    expect(lines({ ppl: 4 })).toContain("Personas: 4.");
    expect(searchHelpMessage(none)).not.toContain("Personas");
  });

  it("modalidad: solo si hay una marcada", () => {
    expect(lines({ modes: ["nightly"] })).toContain("Modalidad: Vacacional.");
    expect(lines({ modes: ["monthly"] })).toContain("Modalidad: Mensual.");
    expect(searchHelpMessage({ ...none, modes: ["nightly", "monthly"] })).not.toContain("Modalidad");
    expect(searchHelpMessage(none)).not.toContain("Modalidad");
  });

  it("características con las etiquetas de la lista única", () => {
    expect(lines({ features: ["pool", "pets"] })).toContain("Necesito: Piscina, Mascotas.");
    expect(lines({ features: ["bbq"] })).toContain("Necesito: Rancho/BBQ.");
  });

  it("precio máximo en colones, con el formato de la app (₡80 000, espacio duro)", () => {
    expect(lines({ max: 80000 })).toContain("Precio por noche: hasta ₡80\u00a0000.");
    expect(searchHelpMessage({ ...none, min: 30000 })).not.toContain("Precio");
  });

  it("todo junto, en orden y con «Fechas: » al final", () => {
    expect(searchHelpMessage({ ...none, prov: "Limón", ppl: 4, modes: ["nightly"], features: ["pool", "pets"], max: 80000 })).toBe(
      [
        "Hola, estoy buscando casa en bnbtico.",
        "Zona: Limón.",
        "Personas: 4.",
        "Modalidad: Vacacional.",
        "Necesito: Piscina, Mascotas.",
        "Precio por noche: hasta ₡80\u00a0000.",
        "Fechas: ",
      ].join("\n"),
    );
  });

  it("nunca «undefined», «null» ni dobles espacios", () => {
    const cases: Partial<Filters>[] = [{}, { prov: "Limón" }, { ppl: 2, max: 1 }, { features: ["wifi", "ac", "kids_free"], modes: ["monthly"] }, { prov: "Guanacaste", ppl: 12, beds: 3, min: 10, max: 99999 }];
    for (const c of cases) {
      const text = searchHelpMessage({ ...none, ...c });
      expect(text).not.toMatch(/undefined|null|NaN/);
      expect(text).not.toMatch(/ {2}/);
      expect(text.endsWith("\nFechas: ")).toBe(true);
    }
  });
});
