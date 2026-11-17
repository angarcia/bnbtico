// Búsqueda por número de noches (historia flags-noches, diseño #59 aprobado el 2026-11-17): `?noches=` de 1 a 90 en la
// URL, el modo del build decide qué claves de estancia valen, el resumen y la línea de resultados dicen las noches, y el
// total orientativo es precio por noche × noches (con 30 o más y precio al mes, mes × noches / 30). Sin fechas: las
// noches ocupadas no excluyen ninguna casa.
import { describe, expect, it } from "vitest";
import { NIGHTS_MAX, normalizeSearch, parseFilters, searchFor, toSearchParams } from "../../src/domain/filters";
import { readSearchNights } from "../../src/domain/contact-return";
import { composeInquiryMessage, redraft, startDraft } from "../../src/domain/inquiry";
import { durationTotal, resultsText, searchSummary } from "../../src/domain/search";
import { searchHelpMessage } from "../../src/domain/search-help";

const today = "2026-11-17";
const base = parseFilters({}, []);

describe("noches en la URL", () => {
  it.each([["1", 1], ["4", 4], ["90", 90]])("?noches=%s vale %i", (raw, nights) => {
    expect(parseFilters({ noches: raw }, [], { mode: "nights" }).nights).toBe(nights);
    expect(normalizeSearch({ noches: raw }, today, "nights")).toEqual({ noches: String(nights) });
  });

  it.each(["0", "91", "-3", "4.5", "abc", ""])("?noches=%s se ignora sin aviso", (raw) => {
    expect(parseFilters({ noches: raw }, [], { mode: "nights" }).nights).toBe(0);
    expect(normalizeSearch({ noches: raw }, today, "nights")).toEqual({});
  });

  it("el límite es 90", () => {
    expect(NIGHTS_MAX).toBe(90);
  });

  it("viaja de ida y vuelta y no se escribe sin noches", () => {
    expect(toSearchParams({ ...base, nights: 4, ppl: 2 }).toString()).toBe("noches=4&ppl=2");
    expect(searchFor({ ...base, nights: 0 })).toEqual({});
  });
});

describe("el modo del build decide qué estancia vale", () => {
  const params = { llegada: "2026-11-23", salida: "2026-11-27", noches: "4", ppl: "2" };
  it("modo noches: fechas viejas fuera, sin filtro oculto de disponibilidad", () => {
    expect(normalizeSearch(params, today, "nights")).toEqual({ noches: "4", ppl: "2" });
  });
  it("modo fechas: mandan las fechas y las noches se ignoran", () => {
    expect(normalizeSearch(params, today, "dates")).toEqual({ llegada: "2026-11-23", salida: "2026-11-27", ppl: "2" });
  });
  it("sin estancia: ni fechas ni noches", () => {
    expect(normalizeSearch(params, today, "none")).toEqual({ ppl: "2" });
  });
});

describe("resumen y resultados con noches", () => {
  it("la píldora y la línea de resultados dicen las noches", () => {
    expect(searchSummary({ ...base, nights: 4, ppl: 2 }, null)).toBe("4 noches · 2 personas");
    expect(searchSummary({ ...base, nights: 1 }, null)).toBe("1 noche");
    expect(resultsText(8, { ...base, nights: 4 })).toEqual({ count: "8 casas", rest: " · 4 noches" });
  });
});

describe("total orientativo por duración", () => {
  const house = { acceptsNightly: true, nightlyPriceCrc: 45_000, acceptsMonthly: false, monthlyPriceCrc: null };
  it("₡45 000 × 4 noches = ₡180 000", () => {
    expect(durationTotal(house, 4)).toBe(180_000);
  });
  it("con 30 noches o más y precio al mes: mes × noches / 30", () => {
    const monthly = { ...house, acceptsMonthly: true, monthlyPriceCrc: 600_000 };
    expect(durationTotal(monthly, 29)).toBe(29 * 45_000);
    expect(durationTotal(monthly, 30)).toBe(600_000);
    expect(durationTotal(monthly, 45)).toBe(900_000);
  });
  it("mensual sin precio (a negociar): por noches", () => {
    expect(durationTotal({ ...house, acceptsMonthly: true }, 30)).toBe(30 * 45_000);
  });
  it("sin noches o sin precio por noche, sin total", () => {
    expect(durationTotal(house, 0)).toBeNull();
    expect(durationTotal({ ...house, nightlyPriceCrc: null }, 4)).toBeNull();
    expect(durationTotal({ ...house, acceptsNightly: false }, 4)).toBeNull();
  });
});

describe("mensaje de WhatsApp con noches", () => {
  it("sin fechas, dice las noches y las personas", () => {
    expect(composeInquiryMessage("Casa Almendro", { nights: 4, people: 2 })).toBe("Hola, vi Casa Almendro en 3bstays y me interesa. ¿Está disponible para 4 noches y 2 personas? Gracias.");
    expect(composeInquiryMessage("Casa Almendro", { nights: 1 })).toBe("Hola, vi Casa Almendro en 3bstays y me interesa. ¿Está disponible para 1 noche? Gracias.");
  });
  it("si elige fechas, mandan las fechas", () => {
    expect(composeInquiryMessage("Casa Almendro", { nights: 4, arrival: "2026-12-20", departure: "2026-12-23", people: 2 })).toBe(
      "Hola, vi Casa Almendro en 3bstays y me interesa. ¿Está disponible del 20 al 23 de diciembre para 2 personas? Gracias.",
    );
  });
  it("la hoja arranca con las noches de Explorar y las conserva al cambiar las personas", () => {
    const start = startDraft("Casa Almendro", { nights: 4 });
    expect(redraft(start, { type: "fields", patch: { people: 3 } }, "Casa Almendro").message).toContain("para 4 noches y 3 personas");
  });
  it("las noches guardadas en la pestaña se leen solo de 1 a 90", () => {
    expect(readSearchNights("4")).toBe(4);
    for (const raw of [null, "", "0", "91", "x"]) expect(readSearchNights(raw)).toBeNull();
  });
});

describe("parseFilters también aplica el modo (el router mezcla los parámetros crudos de la raíz)", () => {
  const params = { llegada: "2026-11-23", salida: "2026-11-27", noches: "4" };
  it("modo noches: sin fechas", () => {
    expect(parseFilters(params, [], { today, mode: "nights" })).toMatchObject({ arrival: null, departure: null, nights: 4 });
  });
  it("modo fechas: sin noches", () => {
    expect(parseFilters(params, [], { today, mode: "dates" })).toMatchObject({ arrival: "2026-11-23", departure: "2026-11-27", nights: 0 });
  });
  it("sin estancia: ninguna", () => {
    expect(parseFilters(params, [], { today, mode: "none" })).toMatchObject({ arrival: null, departure: null, nights: 0 });
  });
});

describe("«¿No encuentra lo que busca?» con noches", () => {
  it("dice las noches en vez de pedir fechas", () => {
    const text = searchHelpMessage({ ...base, nights: 7, ppl: 2 });
    expect(text).toContain("Noches: 7.");
    expect(text).not.toContain("Fechas:");
  });
});
