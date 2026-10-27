import { describe, expect, it } from "vitest";
import { CURRENCY_STORAGE_KEY, parseCurrency } from "../../src/domain/currency";
import { formatMoney } from "../../src/domain/money";

describe("parseCurrency", () => {
  it("USD solo con 'USD'; cualquier otra cosa es colones", () => {
    expect(CURRENCY_STORAGE_KEY).toBe("bnbtico_currency");
    expect(parseCurrency("USD")).toBe("USD");
    expect(parseCurrency("usd")).toBe("CRC");
    expect(parseCurrency(undefined)).toBe("CRC");
    expect(parseCurrency(null)).toBe("CRC");
    expect(parseCurrency("EUR")).toBe("CRC");
  });
});

describe("formatMoney en dólares", () => {
  it("redondea al dólar con el tipo de referencia", () => {
    expect(formatMoney(85000, "USD", 510)).toBe("$167");
    expect(formatMoney(85000, "USD", 455.07)).toBe("$187");
    expect(formatMoney(85000, "CRC", 455.07)).toBe("₡85 000");
  });
});
