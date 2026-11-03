import { describe, expect, it } from "vitest";
import { hasBusyNight, listingStay, stayEstimate, stayLine, stayNights } from "../../src/domain/stay-price";
import { stayTotalLabel } from "../../src/domain/search";

const nights = (arrival: string, n: number) => stayNights(arrival, new Date(Date.parse(arrival) + n * 86_400_000).toISOString().slice(0, 10));
const house = { days: [], base: 45_000, acceptsMonthly: false, monthlyCrc: null };

describe("stayNights", () => {
  it("de la llegada a la salida, sin contar la salida", () => {
    expect(stayNights("2026-12-01", "2026-12-04")).toEqual(["2026-12-01", "2026-12-02", "2026-12-03"]);
    expect(stayNights("2026-12-01", "2026-12-01")).toEqual([]);
    expect(stayNights("2026-12-02", "2026-12-01")).toEqual([]);
  });
});

describe("stayEstimate", () => {
  it("noches normales: la suma del precio base", () => {
    expect(stayEstimate({ ...house, nights: nights("2026-12-01", 4) })).toEqual({ totalCrc: 180_000, kind: "nightly" });
  });

  it("noches con precio especial: cada noche con el suyo", () => {
    const days = [
      { day: "2026-12-02", available: true, specialPriceCrc: 60_000 },
      { day: "2026-12-03", available: true, specialPriceCrc: 30_000 },
    ];
    expect(stayEstimate({ ...house, days, nights: nights("2026-12-01", 4) })).toEqual({ totalCrc: 45_000 + 60_000 + 30_000 + 45_000, kind: "nightly" });
    // La noche de la salida no cuenta.
    expect(stayEstimate({ ...house, days: [{ day: "2026-12-05", available: true, specialPriceCrc: 1 }], nights: nights("2026-12-01", 4) })?.totalCrc).toBe(180_000);
  });

  it("una noche sin precio (sin base ni especial): null", () => {
    expect(stayEstimate({ ...house, base: null, nights: nights("2026-12-01", 2) })).toBeNull();
    // Con precio especial en todas las noches sí hay total aunque no haya base.
    const days = nights("2026-12-01", 2).map((day) => ({ day, available: true, specialPriceCrc: 20_000 }));
    expect(stayEstimate({ ...house, base: null, days, nights: nights("2026-12-01", 2) })?.totalCrc).toBe(40_000);
    expect(stayEstimate({ ...house, nights: [] })).toBeNull();
  });

  it("29 noches: por noches aunque tenga precio al mes", () => {
    expect(stayEstimate({ ...house, acceptsMonthly: true, monthlyCrc: 900_000, nights: nights("2026-12-01", 29) })).toEqual({ totalCrc: 29 * 45_000, kind: "nightly" });
  });

  it("30 y 45 noches con precio al mes: mes × noches / 30, redondeado", () => {
    const monthly = { ...house, acceptsMonthly: true, monthlyCrc: 900_000 };
    expect(stayEstimate({ ...monthly, nights: nights("2026-12-01", 30) })).toEqual({ totalCrc: 900_000, kind: "monthly" });
    expect(stayEstimate({ ...monthly, nights: nights("2026-12-01", 45) })).toEqual({ totalCrc: 1_350_000, kind: "monthly" });
    expect(stayEstimate({ ...monthly, monthlyCrc: 1_000_001, nights: nights("2026-12-01", 31) })?.totalCrc).toBe(Math.round((1_000_001 * 31) / 30));
  });

  it("30 o más noches sin precio al mes, o que no acepta mensual: total por noches (con especiales)", () => {
    const days = [{ day: "2026-12-10", available: true, specialPriceCrc: 100_000 }];
    const expected = 29 * 45_000 + 100_000;
    expect(stayEstimate({ ...house, days, nights: nights("2026-12-01", 30) })).toEqual({ totalCrc: expected, kind: "nightly" });
    expect(stayEstimate({ ...house, days, acceptsMonthly: true, monthlyCrc: null, nights: nights("2026-12-01", 30) })).toEqual({ totalCrc: expected, kind: "nightly" });
    expect(stayEstimate({ ...house, days, acceptsMonthly: true, monthlyCrc: 0, nights: nights("2026-12-01", 30) })?.kind).toBe("nightly");
    expect(stayEstimate({ ...house, days, acceptsMonthly: false, monthlyCrc: 900_000, nights: nights("2026-12-01", 30) })?.kind).toBe("nightly");
  });
});

describe("stayTotalLabel", () => {
  it("«≈ ₡180 000 por 4 noches» en colones y «≈ $350 por 4 noches» en dólares", () => {
    expect(stayTotalLabel(180_000, 4, "CRC", 515)).toBe("≈ ₡180 000 por 4 noches");
    expect(stayTotalLabel(180_000, 4, "USD", 515)).toBe("≈ $350 por 4 noches");
    expect(stayTotalLabel(45_000, 1, "CRC", 515)).toBe("≈ ₡45 000 por 1 noche");
  });
});

describe("listingStay y stayLine (ficha, barra de precio y hoja)", () => {
  const casa = { acceptsNightly: true, nightlyPriceCrc: 45_000, acceptsMonthly: false, monthlyPriceCrc: null };
  const dates = { arrival: "2026-11-20", departure: "2026-11-24" };

  it("el total de las noches con los días de la casa; sin fechas, null", () => {
    expect(listingStay(casa, [], dates)).toEqual({ totalCrc: 180_000, kind: "nightly", nights: 4 });
    expect(listingStay(casa, [{ day: "2026-11-21", available: true, specialPriceCrc: 90_000 }], dates)?.totalCrc).toBe(225_000);
    expect(listingStay(casa, [], null)).toBeNull();
  });

  it("fechas con una noche ocupada: sin total y `hasBusyNight` lo dice; la salida en un ocupado sí vale", () => {
    const days = [{ day: "2026-11-22", available: false, specialPriceCrc: null }];
    expect(hasBusyNight(casa, days, dates)).toBe(true);
    expect(listingStay(casa, days, dates)).toBeNull();
    expect(hasBusyNight(casa, days, { arrival: "2026-11-20", departure: "2026-11-22" })).toBe(false);
    expect(listingStay(casa, days, { arrival: "2026-11-20", departure: "2026-11-22" })?.totalCrc).toBe(90_000);
    expect(hasBusyNight(casa, days, null)).toBe(false);
  });

  it("sin precio por noche (ni especial): null", () => {
    expect(listingStay({ ...casa, nightlyPriceCrc: null }, [], dates)).toBeNull();
  });

  it("30 noches con precio al mes: el mensual prorrateado, igual que Explorar", () => {
    const month = { arrival: "2026-12-01", departure: "2026-12-31" };
    expect(listingStay({ ...casa, acceptsMonthly: true, monthlyPriceCrc: 900_000 }, [], month)).toEqual({ totalCrc: 900_000, kind: "monthly", nights: 30 });
  });

  it("la línea: total, noches y fechas, en la moneda elegida", () => {
    const stay = listingStay(casa, [], dates)!;
    expect(stayLine(stay, dates, "CRC", 510)).toBe(`${stayTotalLabel(180_000, 4, "CRC", 510)} · 20–24 nov`);
    expect(stayLine(stay, dates, "CRC", 510)).toMatch(/^≈ ₡180\s000 por 4 noches · 20–24 nov$/);
    expect(stayLine(stay, dates, "USD", 500)).toMatch(/^≈ \$360 por 4 noches · 20–24 nov$/);
  });
});
