// Calendario de rango (src/shared/range-calendar.tsx) en la hoja de contacto con los días ocupados de la casa (ronda de Ana
// 2 nov, ticket 08): los nombres de los días no cambian (las pruebas de la hoja dependen de ellos).
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RangeCalendar } from "../../src/shared/range-calendar";

const TODAY = "2026-12-01";
const busy = (day: string) => day === "2026-12-10";
const html = (props: Partial<Parameters<typeof RangeCalendar>[0]> = {}) =>
  renderToString(<RangeCalendar today={TODAY} value={{ arrival: null, departure: null }} onChange={() => {}} {...props} />);
const day = (out: string, label: string) => out.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))![0];

describe("RangeCalendar", () => {
  it("sin días ocupados (la búsqueda de Explorar): todos los días desde hoy se tocan", () => {
    const out = html();
    expect(day(out, "10 de diciembre de 2026")).not.toContain('disabled=""');
    expect(day(out, "1 de diciembre de 2026")).not.toContain('disabled=""');
  });

  it("con días ocupados: un ocupado no vale de llegada; el nombre sigue siendo la fecha completa", () => {
    const out = html({ busy });
    expect(day(out, "10 de diciembre de 2026")).toContain('disabled=""');
    expect(day(out, "11 de diciembre de 2026")).not.toContain('disabled=""');
  });

  it("con la llegada elegida, el ocupado posterior se toca (puede ser la salida)", () => {
    const out = html({ busy, value: { arrival: "2026-12-08", departure: null } });
    expect(day(out, "10 de diciembre de 2026")).not.toContain('disabled=""');
  });
});
