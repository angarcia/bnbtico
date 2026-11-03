// El precio orientativo de una estancia (ronda de Ana 2 nov, ticket 07): una sola regla, la misma que search_listings en SQL.
import { describe, expect, it } from "vitest";
import { addDays } from "../../src/domain/dates";
import { stayTotalLabel } from "../../src/domain/search";
import { hasBusyNight, listingStay, stayEstimate, stayLine, stayNights } from "../../src/domain/stay-price";

const ARRIVAL = "2026-12-01";
/** Las `n` noches desde la llegada. */
const nights = (n: number) => stayNights(ARRIVAL, addDays(ARRIVAL, n));
const nightly = { days: [], base: 45_000, acceptsMonthly: false, monthlyCrc: null };
const monthly = { ...nightly, acceptsMonthly: true, monthlyCrc: 900_000 };
const special = (day: string, specialPriceCrc: number) => ({ day, available: true, specialPriceCrc });

describe("stayNights", () => {
  it("de la llegada a la víspera de la salida (la salida no cuenta)", () => {
    expect(stayNights("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
    expect(nights(1)).toEqual([ARRIVAL]);
  });
  it("vacío si la salida no es posterior a la llegada", () => {
    expect(stayNights(ARRIVAL, ARRIVAL)).toEqual([]);
    expect(stayNights(ARRIVAL, "2026-11-30")).toEqual([]);
  });
});

describe("stayEstimate", () => {
  it("noches normales: la suma del precio de la noche", () => {
    expect(stayEstimate({ ...nightly, nights: nights(4) })).toEqual({ totalCrc: 180_000, kind: "nightly" });
  });

  it("noches con precio especial: cada noche con el suyo, más caro o más barato; la de la salida no cuenta", () => {
    const days = [special("2026-12-02", 60_000), special("2026-12-03", 30_000), special("2026-12-05", 1)];
    expect(stayEstimate({ ...nightly, days, nights: nights(4) })).toEqual({ totalCrc: 45_000 + 60_000 + 30_000 + 45_000, kind: "nightly" });
    // También con el calendario como Map (el de la ficha).
    expect(stayEstimate({ ...nightly, days: new Map(days.map((d) => [d.day, d])), nights: nights(4) })?.totalCrc).toBe(180_000);
  });

  it("una noche sin precio (ni el de la noche ni uno especial): null", () => {
    expect(stayEstimate({ ...nightly, base: null, nights: nights(2) })).toBeNull();
    expect(stayEstimate({ ...nightly, base: null, days: [special(ARRIVAL, 20_000)], nights: nights(2) })).toBeNull();
    // Con precio especial en todas sí hay total.
    expect(stayEstimate({ ...nightly, base: null, days: nights(2).map((d) => special(d, 20_000)), nights: nights(2) })).toEqual({ totalCrc: 40_000, kind: "nightly" });
  });

  it("sin noches: null", () => {
    expect(stayEstimate({ ...nightly, nights: [] })).toBeNull();
    expect(stayEstimate({ ...monthly, nights: [] })).toBeNull();
  });

  it("29 noches: por noches aunque tenga precio al mes", () => {
    expect(stayEstimate({ ...monthly, nights: nights(29) })).toEqual({ totalCrc: 29 * 45_000, kind: "nightly" });
  });

  it("30 y 45 noches con precio al mes: mes × noches / 30, sin mirar los precios especiales", () => {
    const days = [special("2026-12-10", 100_000)];
    expect(stayEstimate({ ...monthly, days, nights: nights(30) })).toEqual({ totalCrc: 900_000, kind: "monthly" });
    expect(stayEstimate({ ...monthly, days, nights: nights(45) })).toEqual({ totalCrc: 1_350_000, kind: "monthly" });
  });

  it("el mes prorrateado se redondea al colón (como round() de SQL con positivos)", () => {
    expect(stayEstimate({ ...monthly, monthlyCrc: 1_000_001, nights: nights(31) })?.totalCrc).toBe(1_033_334); // 1 033 334,37
    expect(stayEstimate({ ...monthly, monthlyCrc: 15, nights: nights(31) })?.totalCrc).toBe(16); // 15,5 → 16
  });

  it("30 noches o más sin precio al mes, con precio 0, o que no acepta mensual: por noches, con los especiales", () => {
    const days = [special("2026-12-10", 100_000)];
    const byNight = { totalCrc: 29 * 45_000 + 100_000, kind: "nightly" };
    expect(stayEstimate({ ...nightly, days, nights: nights(30) })).toEqual(byNight);
    expect(stayEstimate({ ...monthly, monthlyCrc: null, days, nights: nights(30) })).toEqual(byNight);
    expect(stayEstimate({ ...monthly, monthlyCrc: 0, days, nights: nights(30) })).toEqual(byNight);
    expect(stayEstimate({ ...monthly, acceptsMonthly: false, days, nights: nights(30) })).toEqual(byNight);
  });
});

describe("stayTotalLabel", () => {
  const text = (...args: Parameters<typeof stayTotalLabel>) => {
    const { amount, unit } = stayTotalLabel(...args);
    return `${amount} ${unit}`;
  };
  it("«≈ ₡180 000 por 4 noches»; en dólares, redondeado al dólar como el resto", () => {
    expect(stayTotalLabel(180_000, 4, "CRC", 515)).toEqual({ amount: "≈ ₡180\u00a0000", unit: "por 4 noches" });
    expect(text(180_000, 4, "USD", 515)).toBe("≈ $350 por 4 noches");
    expect(text(1_050_000, 35, "USD", 515)).toBe("≈ $2\u00a0039 por 35 noches");
    expect(text(45_000, 1, "CRC", 515)).toBe("≈ ₡45\u00a0000 por 1 noche");
  });
  it("nunca «total a pagar»", () => {
    expect(text(180_000, 4, "CRC", 515)).not.toMatch(/total|pagar/i);
  });
});

// La ficha y la hoja de contacto (ticket 08): el total de una casa para las fechas de la pestaña, con los días ya cargados.
describe("listingStay y hasBusyNight", () => {
  const house = { acceptsNightly: true, nightlyPriceCrc: 45_000, acceptsMonthly: true, monthlyPriceCrc: 900_000 };
  const busy = (day: string) => ({ day, available: false, specialPriceCrc: null });
  const days = [special("2026-12-02", 60_000), busy("2026-12-10")];
  const at = (n: number) => addDays(ARRIVAL, n);

  it("las noches de llegada a salida con sus precios especiales, y cuántas son", () => {
    expect(listingStay(house, days, { arrival: ARRIVAL, departure: at(4) })).toEqual({ totalCrc: 45_000 * 3 + 60_000, kind: "nightly", nights: 4 });
  });

  it("30 noches o más con precio al mes: por meses (la misma regla que Explorar)", () => {
    expect(listingStay(house, [], { arrival: ARRIVAL, departure: at(35) })).toEqual({ totalCrc: 1_050_000, kind: "monthly", nights: 35 });
  });

  it("sin fechas, o con una noche ocupada: null; la salida sí puede caer en el ocupado", () => {
    expect(listingStay(house, days, null)).toBeNull();
    expect(hasBusyNight(days, null)).toBe(false);
    // Ocupado el 10 de diciembre (at(9)): del 8 al 11 lo atraviesa; del 8 al 10, la salida cae en él.
    expect(hasBusyNight(days, { arrival: at(7), departure: at(10) })).toBe(true);
    expect(listingStay(house, days, { arrival: at(7), departure: at(10) })).toBeNull();
    expect(hasBusyNight(days, { arrival: at(7), departure: at(9) })).toBe(false);
    expect(listingStay(house, days, { arrival: at(7), departure: at(9) })).toEqual({ totalCrc: 90_000, kind: "nightly", nights: 2 });
  });

  it("una casa sin precio por noche: sin total por noches", () => {
    expect(listingStay({ ...house, acceptsNightly: false }, [], { arrival: ARRIVAL, departure: at(3) })).toBeNull();
  });

  it("la línea: «≈ ₡180 000 por 4 noches · 1–5 dic», en la moneda de la página", () => {
    const dates = { arrival: ARRIVAL, departure: at(4) };
    expect(stayLine({ totalCrc: 180_000, nights: 4 }, dates, "CRC", 515)).toBe("≈ ₡180\u00a0000 por 4 noches · 1–5 dic");
    expect(stayLine({ totalCrc: 180_000, nights: 4 }, dates, "USD", 515)).toBe("≈ $350 por 4 noches · 1–5 dic");
    expect(stayLine({ totalCrc: 1_050_000, nights: 35 }, { arrival: "2026-12-20", departure: "2027-01-24" }, "CRC", 515)).toBe("≈ ₡1\u00a0050\u00a0000 por 35 noches · 20 dic – 24 ene");
  });
});
