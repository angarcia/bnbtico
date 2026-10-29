import { describe, expect, it } from "vitest";
import { shortDate } from "../../src/domain/dates";

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
