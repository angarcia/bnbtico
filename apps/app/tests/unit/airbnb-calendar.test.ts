import { describe, expect, it } from "vitest";
import { applyChange, effectiveDay, emptySelection, selectDay } from "../../src/domain/calendar";

describe("Airbnb · escrituras optimistas de la capa manual", () => {
  it("el editor precarga el manual, aunque Airbnb mantenga la ocupación efectiva", () => {
    const days = [{ day: "2026-12-11", available: false, imported: true, manualAvailable: true, specialPriceCrc: null }];
    const selection = selectDay(emptySelection, "2026-12-11", { days, base: 42000, today: "2026-12-01" });
    expect(selection.available).toBe(true);
    expect(effectiveDay(days, 42000, "2026-12-11").available).toBe(false);
    const both = selectDay(emptySelection, "2026-12-11", { days: [{ ...days[0]!, manualAvailable: false }], base: 42000, today: "2026-12-01" });
    expect(both.available).toBe(false);
  });
  it("liberar el manual no muestra libre una noche importada y conserva el precio", () => {
    const days = [{ day: "2026-12-11", available: false, imported: true, manualAvailable: false, specialPriceCrc: 75000 }];
    const next = applyChange(days, 42000, { days: ["2026-12-11"], available: true });
    expect(next).toEqual([{ day: "2026-12-11", available: false, imported: true, manualAvailable: true, specialPriceCrc: 75000 }]);
    expect(effectiveDay(next, 42000, "2026-12-11").available).toBe(false);
    expect(days[0]?.manualAvailable).toBe(false);
  });
  it("cambiar precio no transforma el importado en bloqueo manual", () => {
    const days = [{ day: "2026-12-11", available: false, imported: true, manualAvailable: true, specialPriceCrc: null }];
    expect(applyChange(days, 42000, { days: ["2026-12-11"], priceCrc: 75000 })).toEqual([
      { day: "2026-12-11", available: false, imported: true, manualAvailable: true, specialPriceCrc: 75000 },
    ]);
  });
});
