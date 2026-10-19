import { describe, expect, it } from "vitest";
import { CURRENCY_COOKIE, parseCurrency } from "@/lib/currency";
import { FX_CRC_PER_USD, formatMoney } from "@/lib/money";

describe("parseCurrency", () => {
  it("USD solo con 'USD'; cualquier otra cosa es colones", () => {
    expect(CURRENCY_COOKIE).toBe("bnbtico_currency");
    expect(parseCurrency("USD")).toBe("USD");
    expect(parseCurrency("usd")).toBe("CRC");
    expect(parseCurrency(undefined)).toBe("CRC");
    expect(parseCurrency("EUR")).toBe("CRC");
  });
});

describe("formatMoney en dólares", () => {
  it("redondea al dólar con el tipo de referencia", () => {
    expect(FX_CRC_PER_USD).toBe(510);
    expect(formatMoney(85000, "USD")).toBe("$167");
    expect(formatMoney(85000, "CRC")).toBe("₡85\u00a0000");
  });
});
