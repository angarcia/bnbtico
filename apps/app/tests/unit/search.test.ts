// Explorar al estilo Airbnb: resumen de la búsqueda, rango de llegada y salida, y sugerencias de zona.
import { describe, expect, it } from "vitest";
import { parseFilters } from "../../src/domain/filters";
import { monthlyWindowLabel, nightsBetween, nightsLabel, peopleLabel, resultsText, searchSummary, stayLabel, tapRange, zonePlace, zoneSuggestions } from "../../src/domain/search";
import type { ZoneWithListings } from "../../src/domain/zones";
import { cardFacts, mapPriceLabel } from "../../src/domain/describe";
import type { PublicListing } from "../../src/domain/listing";
import { formatMoney } from "../../src/domain/money";

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
    expect(resultsText(12, base)).toEqual({ count: "12 casas", rest: "" }); // sin zona: todo el país
    expect(resultsText(12, { ...base, prov: "Limón" })).toEqual({ count: "12 casas", rest: " en Limón" }); // enlace viejo con ?prov=
    expect(resultsText(4, n, "Cocles")).toEqual({ count: "4 casas", rest: " en Cocles y alrededores · 23–27 nov" });
    expect(resultsText(3, { ...base, zone: "704-cocles", monthly: true, monthlyFrom: "2026-12-01" }, "Cocles")).toEqual({ count: "3 casas", rest: " aceptan alquiler mensual en Cocles y alrededores · desde el 1 dic" });
    expect(resultsText(1, { ...base, arrival: "2026-11-23", departure: "2026-11-27" })).toEqual({ count: "1 casa", rest: " · 23–27 nov" });
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
  it("con espacio: el nombre entero o el comienzo de una palabra seguida de lo demás", () => {
    expect(zoneSuggestions(zones, "puerto viejo").map((x) => x.name)).toEqual(["Puerto Viejo"]);
    expect(zoneSuggestions(zones, "Puerto V").map((x) => x.name)).toEqual(["Puerto Viejo"]);
    expect(zoneSuggestions(zones, "uva").map((x) => x.name)).toEqual(["Punta Uva"]);
  });
  it("cantón y provincia", () => {
    expect(zonePlace({ canton: "Talamanca", province: "Limón" })).toBe("Talamanca, Limón");
  });
});

describe("cardFacts y mapPriceLabel (tarjeta y marcador de Explorar)", () => {
  const house = (over: Partial<PublicListing> = {}) =>
    ({ capacity: 4, bedrooms: 2, acceptsNightly: true, nightlyPriceCrc: 42000, acceptsMonthly: false, monthlyPriceCrc: null, ...over }) as PublicListing;
  it("personas y habitaciones; 0 habitaciones es «Estudio»", () => {
    expect(cardFacts({ capacity: 4, bedrooms: 2 })).toBe("4 personas · 2 habitaciones");
    expect(cardFacts({ capacity: 1, bedrooms: 1 })).toBe("1 persona · 1 habitación");
    expect(cardFacts({ capacity: 2, bedrooms: 0 })).toBe("2 personas · Estudio");
    // Una Habitación es 1 habitación, nunca «Estudio» (aunque venga sin dato).
    expect(cardFacts({ capacity: 2, bedrooms: 0, kind: "habitacion" })).toBe("2 personas · 1 habitación");
  });
  it("el precio de la noche, en la moneda elegida; con el mensual, el del mes o «A negociar»", () => {
    expect(mapPriceLabel(house(), false, "CRC", 525)).toBe("₡42 000");
    expect(mapPriceLabel(house(), false, "USD", 525)).toBe(formatMoney(42000, "USD", 525));
    expect(mapPriceLabel(house({ acceptsMonthly: true, monthlyPriceCrc: 350000 }), true, "CRC", 525)).toBe("₡350 000");
    expect(mapPriceLabel(house({ acceptsMonthly: true, monthlyPriceCrc: null }), true, "CRC", 525)).toBe("A negociar");
  });
});
