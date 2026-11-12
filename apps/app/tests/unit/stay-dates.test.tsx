// Las fechas de la estancia en la pestaña (ronda de Ana 2 nov, ticket 08): una sola clave, `3bstays-fechas`, que escribe
// Explorar y comparten la ficha y la hoja de contacto, con aviso en memoria.
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { memoryStore } from "../../src/data/storage";
import { DATES_FILTER_KEY } from "../../src/domain/contact-return";
import { createStayDates, useStayDates } from "../../src/shared/stay-dates";

const NOW = Date.parse("2026-11-03T18:00:00Z"); // 3 nov en Costa Rica

function setup(raw?: string) {
  const store = memoryStore();
  if (raw !== undefined) store.setItem(DATES_FILTER_KEY, raw);
  let now = NOW;
  const dates = createStayDates(() => store, () => now);
  return { store, dates, later: (ms: number) => (now += ms) };
}

describe("stayDates", () => {
  it("lee lo que guarda Explorar", () => {
    const { dates } = setup('{"llegada":"2026-11-20","salida":"2026-11-24"}');
    expect(dates.read()).toEqual({ arrival: "2026-11-20", departure: "2026-11-24" });
  });

  it("descarta lo pasado, lo mal formado y el «desde» del modo mensual", () => {
    for (const raw of ['{"llegada":"2026-11-01","salida":"2026-11-04"}', "{", '{"desde":"2026-12-01"}', '{"llegada":"2026-11-24","salida":"2026-11-20"}', "null"]) {
      expect(setup(raw).dates.read(), raw).toBeNull();
    }
    expect(setup().dates.read()).toBeNull();
  });

  it("escribe en la misma clave y con null la quita", () => {
    const { dates, store } = setup();
    dates.write({ arrival: "2026-12-01", departure: "2026-12-05" });
    expect(store.getItem(DATES_FILTER_KEY)).toBe('{"llegada":"2026-12-01","salida":"2026-12-05"}');
    dates.write(null);
    expect(store.getItem(DATES_FILTER_KEY)).toBeNull();
  });

  it("avisa a los suscritos al escribir; al darse de baja, ya no", () => {
    const { dates } = setup();
    const listener = vi.fn();
    const off = dates.subscribe(listener);
    dates.write({ arrival: "2026-12-01", departure: "2026-12-05" });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    dates.write(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("devuelve el mismo objeto mientras no cambien la clave ni el día (useSyncExternalStore lo exige)", () => {
    const { dates, later } = setup('{"llegada":"2026-11-04","salida":"2026-11-06"}');
    const first = dates.read();
    expect(dates.read()).toBe(first);
    dates.write({ arrival: "2026-11-04", departure: "2026-11-07" });
    const second = dates.read();
    expect(second).not.toBe(first);
    expect(dates.read()).toBe(second);
    // Al pasar la llegada, ya no valen.
    later(2 * 86_400_000);
    expect(dates.read()).toBeNull();
  });
});

describe("useStayDates", () => {
  it("en el servidor (y al hidratar) no hay fechas: el HTML de la ficha no depende de la pestaña", () => {
    function Probe() {
      return <span>{JSON.stringify(useStayDates())}</span>;
    }
    expect(renderToString(<Probe />)).toBe("<span>null</span>");
  });
});
