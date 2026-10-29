// Explorar al estilo Airbnb: resumen de la búsqueda, rango de llegada y salida, y sugerencias de zona.
import { describe, expect, it } from "vitest";
import { parseFilters } from "../../src/domain/filters";
import { monthlyWindowLabel, nightsBetween, nightsLabel, peopleLabel, resultsText, searchSummary, stayLabel, tapRange, zonePlace, zoneSuggestions } from "../../src/domain/search";
import type { ZoneWithListings } from "../../src/domain/zones";

const base = parseFilters({}, ["Limón"]);
const n = { ...base, zone: "704-cocles", arrival: "2026-11-23", departure: "2026-11-27", ppl: 4 };
const z = (id: string, name: string, cantonCode: string): ZoneWithListings => ({ id, name, cantonCode, canton: "Talamanca", province: "Limón", lat: 9.6, lng: -82.7, listings: 1 });

describe("searchSummary", () => {
  it("une zona, fechas y personas", () => {
    expect(searchSummary(n, "Cocles")).toBe("Cocles · 23–27 nov · 4 personas");
    expect(searchSummary({ ...base, monthly: true, monthlyFrom: "2026-12-01", ppl: 2 }, null)).toBe("Desde el 1 dic · 2 personas");
    expect(searchSummary({ ...base, ppl: 1 }, null)).toBe("1 persona");
  });
  it("sin nada, null; con el mensual solo cuenta «desde», y por noches no", () => {
    expect(searchSummary(base, null)).toBeNull();
    expect(searchSummary({ ...base, monthlyFrom: "2026-12-01" }, null)).toBeNull();
    expect(searchSummary({ ...base, monthly: true, arrival: "2026-11-23", departure: "2026-11-27" }, null)).toBeNull();
  });
  it("etiquetas sueltas", () => {
    expect(stayLabel(n)).toBe("23–27 nov");
    expect(peopleLabel(0)).toBeNull();
    expect(peopleLabel(4)).toBe("4 personas");
  });
});

describe("resultsText", () => {
  it("provincia, zona, fechas y mensual", () => {
    expect(resultsText(12, base)).toEqual({ count: "12 casas", rest: " en Limón" });
    expect(resultsText(4, n, "Cocles")).toEqual({ count: "4 casas", rest: " en Cocles y alrededores · 23–27 nov" });
    expect(resultsText(3, { ...base, zone: "704-cocles", monthly: true, monthlyFrom: "2026-12-01" }, "Cocles")).toEqual({ count: "3 casas", rest: " aceptan alquiler mensual en Cocles y alrededores · desde el 1 dic" });
    expect(resultsText(1, { ...base, arrival: "2026-11-23", departure: "2026-11-27" })).toEqual({ count: "1 casa", rest: " en Limón · 23–27 nov" });
    expect(resultsText(2, { prov: "Limón", monthly: true, zone: null, arrival: null, departure: null, monthlyFrom: null })).toEqual({ count: "2 casas", rest: " aceptan alquiler mensual en Limón" });
    expect(resultsText(1, { ...base, prov: "Todas", monthly: true })).toEqual({ count: "1 casa", rest: " acepta alquiler mensual" });
    expect(resultsText(9, { ...base, prov: "Todas" })).toEqual({ count: "9 casas", rest: "" });
  });
});

describe("tapRange", () => {
  it("elige llegada y luego salida", () => {
    expect(tapRange({ arrival: null, departure: null }, "2026-11-23")).toEqual({ arrival: "2026-11-23", departure: null });
    expect(tapRange({ arrival: "2026-11-23", departure: null }, "2026-11-27")).toEqual({ arrival: "2026-11-23", departure: "2026-11-27" });
  });
  it("un día igual o anterior a la llegada la reemplaza; con rango completo empieza de nuevo", () => {
    expect(tapRange({ arrival: "2026-11-23", departure: null }, "2026-11-23")).toEqual({ arrival: "2026-11-23", departure: null });
    expect(tapRange({ arrival: "2026-11-23", departure: null }, "2026-11-20")).toEqual({ arrival: "2026-11-20", departure: null });
    expect(tapRange({ arrival: "2026-11-23", departure: "2026-11-27" }, "2026-11-25")).toEqual({ arrival: "2026-11-25", departure: null });
  });
});

describe("noches y ventana mensual", () => {
  it("cuenta y etiqueta", () => {
    expect(nightsBetween("2026-11-23", "2026-11-27")).toBe(4);
    expect(nightsLabel(4)).toBe("4 noches");
    expect(nightsLabel(1)).toBe("1 noche");
    expect(monthlyWindowLabel("2026-11-16")).toBe("Casas libres del 16 nov al 16 dic");
  });
});

describe("zoneSuggestions", () => {
  const zones = [z("704-punta-uva", "Punta Uva", "704"), z("704-puerto-viejo", "Puerto Viejo", "704"), z("101-carmen", "Carmen", "101"), z("704-cocles", "Cocles", "704")];
  it("vacío: todas, Caribe primero y por nombre", () => {
    expect(zoneSuggestions(zones, "").map((x) => x.name)).toEqual(["Cocles", "Puerto Viejo", "Punta Uva", "Carmen"]);
  });
  it("prefijo de cualquier palabra, sin tildes ni mayúsculas", () => {
    expect(zoneSuggestions(zones, "PU").map((x) => x.name)).toEqual(["Puerto Viejo", "Punta Uva"]);
    expect(zoneSuggestions(zones, "viejo").map((x) => x.name)).toEqual(["Puerto Viejo"]);
    expect(zoneSuggestions(zones, "erto")).toEqual([]);
  });
  it("cantón y provincia", () => {
    expect(zonePlace({ canton: "Talamanca", province: "Limón" })).toBe("Talamanca, Limón");
  });
});
