// El toque en un calendario de rango con días ocupados (ronda de Ana 2 nov, ticket 08): el de la ficha y el de la hoja de
// contacto siguen las mismas reglas.
import { describe, expect, it } from "vitest";
import { canTapDay, RANGE_BUSY_MESSAGE, tapRangeFree, type RangeState } from "../../src/domain/range";

// Ocupados: el 10 y el 11.
const busy = (day: string) => day === "2026-12-10" || day === "2026-12-11";
const none: RangeState = { arrival: null, departure: null };
const from = (arrival: string): RangeState => ({ arrival, departure: null });
const d = (n: number) => `2026-12-${String(n).padStart(2, "0")}`;

describe("canTapDay", () => {
  it("un día libre siempre se toca", () => {
    expect(canTapDay(none, d(9), busy)).toBe(true);
    expect(canTapDay(from(d(5)), d(9), busy)).toBe(true);
    expect(canTapDay({ arrival: d(5), departure: d(8) }, d(9), busy)).toBe(true);
  });

  it("un ocupado no vale de llegada: sin llegada, con el rango completo o antes de la llegada", () => {
    expect(canTapDay(none, d(10), busy)).toBe(false);
    expect(canTapDay({ arrival: d(5), departure: d(8) }, d(10), busy)).toBe(false);
    expect(canTapDay(from(d(12)), d(10), busy)).toBe(false);
  });

  it("con la llegada elegida, un ocupado posterior sí se toca: puede ser la salida", () => {
    expect(canTapDay(from(d(8)), d(10), busy)).toBe(true);
    expect(canTapDay(from(d(8)), d(11), busy)).toBe(true);
  });
});

describe("tapRangeFree", () => {
  it("sin ocupados en medio, como tapRange: llegada, salida y, con el rango completo, otra llegada", () => {
    expect(tapRangeFree(none, d(3), busy)).toEqual({ state: from(d(3)), rejected: false });
    expect(tapRangeFree(from(d(3)), d(6), busy)).toEqual({ state: { arrival: d(3), departure: d(6) }, rejected: false });
    expect(tapRangeFree({ arrival: d(3), departure: d(6) }, d(4), busy)).toEqual({ state: from(d(4)), rejected: false });
    expect(tapRangeFree(from(d(6)), d(3), busy)).toEqual({ state: from(d(3)), rejected: false });
  });

  it("la salida puede caer en el primer día ocupado (su noche no se duerme)", () => {
    expect(tapRangeFree(from(d(8)), d(10), busy)).toEqual({ state: { arrival: d(8), departure: d(10) }, rejected: false });
  });

  it("un rango con una noche ocupada no vale: la llegada se queda y se avisa", () => {
    expect(tapRangeFree(from(d(8)), d(11), busy)).toEqual({ state: from(d(8)), rejected: true });
    expect(tapRangeFree(from(d(8)), d(15), busy)).toEqual({ state: from(d(8)), rejected: true });
    expect(RANGE_BUSY_MESSAGE).toBe("Hay noches ocupadas entre esas fechas.");
  });

  it("un día que no se puede tocar no cambia nada", () => {
    const s = { arrival: d(3), departure: d(6) };
    expect(tapRangeFree(s, d(10), busy)).toEqual({ state: s, rejected: false });
  });

  it("también a través de fin de mes", () => {
    const busyJan = (day: string) => day === "2027-01-01";
    expect(tapRangeFree(from("2026-12-30"), "2027-01-02", busyJan).rejected).toBe(true);
    expect(tapRangeFree(from("2026-12-30"), "2027-01-01", busyJan).rejected).toBe(false);
  });
});
