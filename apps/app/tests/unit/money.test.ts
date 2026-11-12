import { describe, expect, it } from "vitest";
import { formatCRC, formatMoney, formatUSD } from "../../src/domain/money";

describe("dinero", () => {
  it("formatea colones con espacio fino de miles", () => {
    expect(formatCRC(95000)).toBe("₡95\u00a0000");
    expect(formatCRC(9900)).toBe("₡9\u00a0900");
    expect(formatCRC(150000)).toBe("₡150\u00a0000");
  });
  it("convierte a dólares solo como referencia", () => {
    expect(formatUSD(95000, 510)).toBe("$186");
    // Miles con espacio, como los colones (revisión UX 2026-10-29, N3).
    expect(formatUSD(1450000, 510)).toBe("$2\u00a0843");
    expect(formatMoney(85000, "USD", 510)).toBe("$167");
    expect(formatMoney(85000, "CRC", 510)).toBe("₡85\u00a0000");
  });
});
