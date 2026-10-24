// Rejilla del mes (src/shared/month-grid.tsx): la del calendario del propietario (botones) y la de la ficha (solo lectura,
// ticket 05). Se comprueba el HTML que pinta: el mismo en el worker y en el navegador.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalendarDay } from "../../src/domain/calendar";
import { MonthGrid, MonthLegend } from "../../src/shared/month-grid";

const TODAY = "2026-12-10";
const days = (rows: CalendarDay[]) => new Map(rows.map((r) => [r.day, r]));
const DAYS = days([
  { day: "2026-12-12", available: false, specialPriceCrc: null },
  { day: "2026-12-24", available: true, specialPriceCrc: 180000 },
  { day: "2026-12-31", available: false, specialPriceCrc: 150000 },
]);

const html = (props: Partial<Parameters<typeof MonthGrid>[0]> = {}) =>
  renderToString(<MonthGrid month="2026-12" today={TODAY} days={DAYS} base={95000} prices="all" label="Diciembre 2026" onSelect={() => {}} {...props} />);
const cells = (out: string) => [...out.matchAll(/<(button|div)[^>]*class="day[^"]*"[^>]*>[\s\S]*?<\/\1>/g)].map((m) => m[0]);
const cell = (out: string, n: number) => cells(out).find((c) => new RegExp(`<b>${n}( ★)?</b>`).test(c))!;

describe("MonthGrid", () => {
  it("lunes primero: cabecera L K M J V S D y huecos antes del 1 (diciembre 2026 empieza en martes)", () => {
    const out = html();
    expect([...out.matchAll(/<span class="wd">(.)<\/span>/g)].map((m) => m[1])).toEqual(["L", "K", "M", "J", "V", "S", "D"]);
    expect(out.indexOf('class="day-blank"')).toBeLessThan(out.indexOf("<b>1</b>"));
    expect(cells(out)).toHaveLength(31);
  });

  it("interactiva: botones con aria-label (fecha, estado y precio), «95k» en los disponibles, «ocupado» en los ocupados y ★ en los distintos", () => {
    const out = html();
    expect(cell(out, 20)).toMatch(/^<button/);
    expect(cell(out, 20)).toContain('aria-label="20 de diciembre de 2026, disponible, ₡95\u00a0000"');
    expect(cell(out, 20)).toContain("95k");
    expect(cell(out, 12)).toContain('aria-label="12 de diciembre de 2026, ocupado, ₡95\u00a0000"');
    expect(cell(out, 12)).toContain("ocupado");
    expect(cell(out, 12)).toMatch(/class="day is-busy"/);
    expect(cell(out, 24)).toContain("<b>24 ★</b>");
    expect(cell(out, 24)).toContain("180k");
    expect(cell(out, 24)).toContain('aria-label="24 de diciembre de 2026, disponible, ₡180\u00a0000, precio distinto"');
    // Ocupado con precio especial: conserva la ★ (el precio vuelve al liberarlo).
    expect(cell(out, 31)).toContain("<b>31 ★</b>");
  });

  it("los días pasados están desactivados y atenuados; los seleccionados llevan aria-pressed", () => {
    const out = html({ selected: ["2026-12-20", "2026-12-21"] });
    expect(cell(out, 9)).toMatch(/disabled=""/);
    expect(cell(out, 9)).toMatch(/is-past/);
    expect(cell(out, 10)).not.toMatch(/disabled=""/);
    expect(cell(out, 20)).toContain('aria-pressed="true"');
    expect(cell(out, 22)).toContain('aria-pressed="false"');
  });

  it("casa solo mensual (sin precio base): ni precios ni ★", () => {
    const out = html({ base: null, prices: "none", days: days([{ day: "2026-12-12", available: false, specialPriceCrc: null }]) });
    expect(out).not.toMatch(/\dk</);
    expect(out).not.toContain("★");
    expect(cell(out, 20)).toContain('aria-label="20 de diciembre de 2026, disponible"');
    expect(cell(out, 12)).toContain("ocupado");
  });

  it("solo lectura (ficha): rejilla con celdas etiquetadas, sin botones; cifra solo en los días ★ y en la moneda elegida", () => {
    const out = html({ onSelect: undefined, prices: "special", currency: "USD" });
    expect(out).toContain('role="grid"');
    expect(out).not.toContain("<button");
    expect(cell(out, 20)).toContain('role="gridcell"');
    expect(cell(out, 20)).toContain('<span class="day-sub"></span>');
    expect(cell(out, 20)).toContain('aria-label="20 de diciembre de 2026, disponible"');
    expect(cell(out, 24)).toMatch(/\$\d+/);
  });

  it("atenuada (casa cerrada): clase is-dimmed y sin botones", () => {
    const out = html({ onSelect: undefined, dimmed: true });
    expect(out).toMatch(/class="month-grid is-dimmed"/);
    expect(out).not.toContain("<button");
  });

  it("leyenda: Disponible · Ocupado · ★ Precio distinto (sin ★ en una casa solo mensual)", () => {
    expect(renderToString(<MonthLegend special />)).toMatch(/Disponible.*Ocupado.*★ Precio distinto/);
    expect(renderToString(<MonthLegend special={false} />)).not.toContain("★");
  });
});
