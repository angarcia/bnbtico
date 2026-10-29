import { describe, expect, it } from "vitest";
import { addDays, costaRicaToday, formatInquiryDates, longDateWithYear, shortDate } from "../../src/domain/dates";

describe("shortDate", () => {
  it("día y mes corto, sin año", () => {
    expect(shortDate("2026-12-03")).toBe("3 dic");
    expect(shortDate("2027-09-15")).toBe("15 sep");
  });
  it("null si no es una fecha AAAA-MM-DD", () => {
    expect(shortDate("2026-13-01")).toBeNull();
    expect(shortDate("x")).toBeNull();
  });
});

describe("fechas compartidas de Explorar", () => {
  it("shortDate y longDateWithYear", () => {
    expect(shortDate("2026-12-01")).toBe("1 dic");
    expect(longDateWithYear("2026-11-23")).toBe("23 de noviembre de 2026");
    expect(longDateWithYear("2026-02-30")).toBeNull();
  });
  it("formatInquiryDates, addDays y costaRicaToday", () => {
    expect(formatInquiryDates("2026-11-23", "2026-11-27")).toBe("23–27 nov");
    expect(formatInquiryDates("2026-12-28", "2027-01-02")).toBe("28 dic – 2 ene");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(costaRicaToday(Date.parse("2026-11-02T05:30:00Z"))).toBe("2026-11-01");
  });
});
