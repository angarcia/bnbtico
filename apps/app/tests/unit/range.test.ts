// Las reglas del calendario de rango con días ocupados (ticket 08 de la ronda del 2 nov): no se llega en un día ocupado, un
// rango con una noche ocupada no vale y la salida sí puede caer en el primer día ocupado.
import { describe, expect, it } from "vitest";
import { canTapDay, RANGE_BUSY_MESSAGE, tapRangeFree } from "../../src/domain/range";

const busy = new Set(["2026-12-10", "2026-12-11", "2026-12-20"]);
const isBusy = (d: string) => busy.has(d);
const none = { arrival: null, departure: null };

describe("canTapDay", () => {
  it("un día libre siempre se puede tocar", () => {
    expect(canTapDay(none, "2026-12-05", isBusy)).toBe(true);
    expect(canTapDay({ arrival: "2026-12-05", departure: null }, "2026-12-03", isBusy)).toBe(true);
  });
  it("un día ocupado no sirve de llegada: ni sin nada elegido, ni con el rango completo, ni antes de la llegada", () => {
    expect(canTapDay(none, "2026-12-10", isBusy)).toBe(false);
    expect(canTapDay({ arrival: "2026-12-01", departure: "2026-12-03" }, "2026-12-10", isBusy)).toBe(false);
    expect(canTapDay({ arrival: "2026-12-15", departure: null }, "2026-12-11", isBusy)).toBe(false);
  });
  it("con la llegada elegida, un día ocupado posterior sí se toca (puede ser la salida)", () => {
    expect(canTapDay({ arrival: "2026-12-05", departure: null }, "2026-12-10", isBusy)).toBe(true);
    expect(canTapDay({ arrival: "2026-12-05", departure: null }, "2026-12-20", isBusy)).toBe(true);
  });
});

describe("tapRangeFree", () => {
  it("elegir la llegada y la salida libres", () => {
    const a = tapRangeFree(none, "2026-12-05", isBusy);
    expect(a).toEqual({ state: { arrival: "2026-12-05", departure: null }, rejected: false });
    expect(tapRangeFree(a.state, "2026-12-08", isBusy)).toEqual({ state: { arrival: "2026-12-05", departure: "2026-12-08" }, rejected: false });
  });
  it("la salida puede caer en el primer día ocupado", () => {
    expect(tapRangeFree({ arrival: "2026-12-05", departure: null }, "2026-12-10", isBusy)).toEqual({ state: { arrival: "2026-12-05", departure: "2026-12-10" }, rejected: false });
  });
  it("un rango con una noche ocupada se rechaza y la llegada se queda", () => {
    const s = { arrival: "2026-12-05", departure: null };
    expect(tapRangeFree(s, "2026-12-12", isBusy)).toEqual({ state: s, rejected: true });
    expect(tapRangeFree(s, "2026-12-11", isBusy)).toEqual({ state: s, rejected: true });
    expect(tapRangeFree(s, "2026-12-15", isBusy)).toEqual({ state: s, rejected: true });
  });
  it("un día igual o anterior a la llegada la reemplaza (si es libre) y con el rango completo se empieza de nuevo", () => {
    expect(tapRangeFree({ arrival: "2026-12-05", departure: null }, "2026-12-03", isBusy)).toEqual({ state: { arrival: "2026-12-03", departure: null }, rejected: false });
    expect(tapRangeFree({ arrival: "2026-12-05", departure: "2026-12-08" }, "2026-12-14", isBusy)).toEqual({ state: { arrival: "2026-12-14", departure: null }, rejected: false });
  });
  it("tocar un día que no se puede (ocupado como llegada) no cambia nada", () => {
    expect(tapRangeFree(none, "2026-12-10", isBusy)).toEqual({ state: none, rejected: false });
  });
  it("el mensaje", () => {
    expect(RANGE_BUSY_MESSAGE).toBe("Hay noches ocupadas entre esas fechas.");
  });
});
