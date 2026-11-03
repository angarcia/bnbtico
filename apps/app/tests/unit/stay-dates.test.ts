// Las fechas de la estancia que comparten Explorar, la ficha y la hoja de contacto (ticket 08 de la ronda del 2 nov): una
// sola clave en la pestaña (`bnbtico-fechas`), con aviso al momento a quien la mira.
import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../../src/data/storage";
import { DATES_FILTER_KEY } from "../../src/domain/contact-return";
import { createStayDates } from "../../src/shared/stay-dates";

const NOW = Date.parse("2026-11-10T15:00:00Z"); // hoy en Costa Rica: 2026-11-10
const make = () => {
  const store = memoryStore();
  return { store, dates: createStayDates(() => store, () => NOW) };
};

describe("fechas compartidas de la estancia", () => {
  it("sin nada guardado: null", () => {
    expect(make().dates.read()).toBeNull();
  });

  it("escribir deja la clave de Explorar y lo leído es lo escrito", () => {
    const { store, dates } = make();
    dates.write({ arrival: "2026-11-20", departure: "2026-11-24" });
    expect(JSON.parse(store.getItem(DATES_FILTER_KEY)!)).toEqual({ llegada: "2026-11-20", salida: "2026-11-24" });
    expect(dates.read()).toEqual({ arrival: "2026-11-20", departure: "2026-11-24" });
  });

  it("lo que ya guardó Explorar se lee tal cual", () => {
    const { store, dates } = make();
    store.setItem(DATES_FILTER_KEY, JSON.stringify({ llegada: "2026-12-01", salida: "2026-12-03" }));
    expect(dates.read()).toEqual({ arrival: "2026-12-01", departure: "2026-12-03" });
  });

  it("escribir null quita la clave", () => {
    const { store, dates } = make();
    dates.write({ arrival: "2026-11-20", departure: "2026-11-24" });
    dates.write(null);
    expect(store.getItem(DATES_FILTER_KEY)).toBeNull();
    expect(dates.read()).toBeNull();
  });

  it("descarta lo pasado o mal formado, como Explorar", () => {
    const { store, dates } = make();
    for (const raw of [JSON.stringify({ llegada: "2026-11-01", salida: "2026-11-12" }), JSON.stringify({ llegada: "2026-11-20", salida: "2026-11-20" }), "{", JSON.stringify({ llegada: "x" })]) {
      store.setItem(DATES_FILTER_KEY, raw);
      expect(dates.read()).toBeNull();
    }
  });

  it("la misma lectura devuelve el mismo objeto mientras no cambie (lo exige useSyncExternalStore)", () => {
    const { dates } = make();
    dates.write({ arrival: "2026-11-20", departure: "2026-11-24" });
    expect(dates.read()).toBe(dates.read());
  });

  it("avisa a quien escucha al escribir (también al quitar) y deja de avisar al darse de baja", () => {
    const { dates } = make();
    const seen = vi.fn();
    const off = dates.subscribe(seen);
    dates.write({ arrival: "2026-11-20", departure: "2026-11-24" });
    dates.write(null);
    expect(seen).toHaveBeenCalledTimes(2);
    off();
    dates.write({ arrival: "2026-11-20", departure: "2026-11-24" });
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
