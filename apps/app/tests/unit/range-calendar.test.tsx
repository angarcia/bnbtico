// El calendario de rango de la búsqueda y de la hoja de contacto (src/shared/range-calendar.tsx): con los días ocupados de la
// casa (ticket 08 de la ronda del 2 nov), los que no sirven de llegada salen apagados y su nombre no cambia.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { longDateWithYear } from "../../src/domain/dates";
import { RangeCalendar } from "../../src/shared/range-calendar";

const TODAY = "2026-12-01";
const busy = (d: string) => d === "2026-12-12" || d === "2026-12-13";
const html = (props: Partial<Parameters<typeof RangeCalendar>[0]> = {}) => renderToString(<RangeCalendar today={TODAY} value={{ arrival: null, departure: null }} onChange={() => {}} {...props} />);
const button = (out: string, day: string) => out.match(new RegExp(`<button[^>]*aria-label="${longDateWithYear(day)}"[^>]*>`))![0];

describe("RangeCalendar con días ocupados", () => {
  it("sin días ocupados (la búsqueda) todos los días futuros se pueden tocar", () => {
    expect(button(html(), "2026-12-12")).not.toContain("disabled");
  });
  it("un ocupado no se puede tocar como llegada y su nombre es el de siempre", () => {
    expect(button(html({ busy }), "2026-12-12")).toContain('disabled=""');
    expect(button(html({ busy }), "2026-12-14")).not.toContain("disabled");
  });
  it("con la llegada elegida, el primer ocupado se puede tocar como salida", () => {
    const out = html({ busy, value: { arrival: "2026-12-05", departure: null } });
    expect(button(out, "2026-12-12")).not.toContain("disabled");
  });
  it("hoy se puede tocar y el día de hoy + 365 solo vale como salida (como antes)", () => {
    expect(button(html({ busy }), TODAY)).not.toContain("disabled");
    expect(button(html({ busy }), "2027-12-01")).toContain('disabled=""');
  });
});
