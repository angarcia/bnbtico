// Explorar al estilo Airbnb: resumen de la búsqueda, rango de llegada y salida, y sugerencias de zona.
import { describe, expect, it } from "vitest";
import { parseFilters } from "../../src/domain/filters";
import { nightsBetween, nightsLabel, peopleLabel, resultsText, searchSummary, stayLabel, tapRange, zonePlace, zoneSuggestions } from "../../src/domain/search";
import type { ZoneWithListings } from "../../src/domain/zones";
import { cardFacts, cardPrice, mapPriceLabel } from "../../src/domain/describe";
import type { PublicListing, SearchListing } from "../../src/domain/listing";
import { formatMoney } from "../../src/domain/money";

const base = parseFilters({}, ["Limón"]);
const n = { ...base, zone: "704-cocles", arrival: "2026-11-23", departure: "2026-11-27", ppl: 4 };
const z = (id: string, name: string, cantonCode: string): ZoneWithListings => ({ id, name, cantonCode, canton: "Talamanca", province: "Limón", lat: 9.6, lng: -82.7, listings: 1 });

describe("searchSummary", () => {
  it("une zona, fechas y personas", () => {
    expect(searchSummary(n, "Cocles")).toBe("Cocles · 23–27 nov · 4 personas");
    expect(searchSummary({ ...base, arrival: "2026-12-01", departure: "2026-12-04", ppl: 2 }, null)).toBe("1–4 dic · 2 personas");
    expect(searchSummary({ ...base, ppl: 1 }, null)).toBe("1 persona");
  });
  it("sin nada, null; una fecha sola no cuenta", () => {
    expect(searchSummary(base, null)).toBeNull();
    expect(searchSummary({ ...base, arrival: "2026-11-23" }, null)).toBeNull();
  });
  it("etiquetas sueltas", () => {
    expect(stayLabel(n)).toBe("23–27 nov");
    expect(peopleLabel(0)).toBeNull();
    expect(peopleLabel(4)).toBe("4 personas");
  });
});

describe("resultsText", () => {
  it("provincia, zona y fechas", () => {
    expect(resultsText(12, base)).toEqual({ count: "12 casas", rest: " en Limón" });
    expect(resultsText(4, n, "Cocles")).toEqual({ count: "4 casas", rest: " en Cocles y alrededores · 23–27 nov" });
    expect(resultsText(1, { ...base, arrival: "2026-11-23", departure: "2026-11-27" })).toEqual({ count: "1 casa", rest: " en Limón · 23–27 nov" });
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

describe("noches", () => {
  it("cuenta y etiqueta", () => {
    expect(nightsBetween("2026-11-23", "2026-11-27")).toBe(4);
    expect(nightsLabel(4)).toBe("4 noches");
    expect(nightsLabel(1)).toBe("1 noche");
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

describe("cardFacts, cardPrice y mapPriceLabel (tarjeta y marcador de Explorar)", () => {
  const house = (over: Partial<SearchListing> = {}) =>
    ({ capacity: 4, bedrooms: 2, acceptsNightly: true, nightlyPriceCrc: 42000, acceptsMonthly: false, monthlyPriceCrc: null, stayTotalCrc: null, ...over }) as SearchListing;
  it("personas y habitaciones; 0 habitaciones es «Estudio»", () => {
    expect(cardFacts({ capacity: 4, bedrooms: 2 })).toBe("4 personas · 2 habitaciones");
    expect(cardFacts({ capacity: 1, bedrooms: 1 })).toBe("1 persona · 1 habitación");
    expect(cardFacts({ capacity: 2, bedrooms: 0 })).toBe("2 personas · Estudio");
  });
  it("sin fechas, el precio de la noche (aunque acepte mensual); con fechas y total, el total de esas noches", () => {
    expect(cardPrice(house(), 0)).toEqual({ amount: 42000, unit: "noche" });
    expect(cardPrice(house({ acceptsMonthly: true, monthlyPriceCrc: 350000 }), 0)).toEqual({ amount: 42000, unit: "noche" });
    expect(cardPrice(house({ stayTotalCrc: 168000 }), 4)).toEqual({ stayTotalCrc: 168000, nights: 4 });
    // Sin noches el total no se usa (no debería venir, pero no se inventa una estancia).
    expect(cardPrice(house({ stayTotalCrc: 168000 }), 0)).toEqual({ amount: 42000, unit: "noche" });
  });
  it("con fechas pero sin total (alguna noche sin precio, o una casa de Favoritos), el precio de la noche o nada", () => {
    expect(cardPrice(house(), 4)).toEqual({ amount: 42000, unit: "noche" });
    const favorite = { capacity: 4, bedrooms: 2, acceptsNightly: true, nightlyPriceCrc: 42000, acceptsMonthly: false, monthlyPriceCrc: null } as PublicListing;
    expect(cardPrice(favorite, 4)).toEqual({ amount: 42000, unit: "noche" });
    expect(cardPrice(house({ nightlyPriceCrc: null }), 4)).toBeNull();
  });
  it("el marcador: la cifra de la tarjeta sin unidad, en la moneda elegida; sin precio, «A negociar»", () => {
    expect(mapPriceLabel(house(), 0, "CRC", 525)).toBe("₡42\u00a0000");
    expect(mapPriceLabel(house(), 0, "USD", 525)).toBe(formatMoney(42000, "USD", 525));
    expect(mapPriceLabel(house({ stayTotalCrc: 1050000 }), 35, "CRC", 525)).toBe("₡1\u00a0050\u00a0000");
    expect(mapPriceLabel(house({ stayTotalCrc: 1050000 }), 35, "USD", 525)).toBe(formatMoney(1050000, "USD", 525));
    expect(mapPriceLabel(house({ nightlyPriceCrc: null }), 4, "CRC", 525)).toBe("A negociar");
  });
});
