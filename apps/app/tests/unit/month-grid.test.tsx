// Rejilla del mes (src/shared/month-grid.tsx): la del calendario del propietario (botones) y la de la ficha (solo lectura,
// ticket 05). Se comprueba el HTML que pinta: el mismo en el worker y en el navegador.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalendarDay } from "../../src/domain/calendar";
import { MonthGrid, MonthLegend, WeekdayRow } from "../../src/shared/month-grid";

const TODAY = "2026-12-10";
const days = (rows: CalendarDay[]) => new Map(rows.map((r) => [r.day, r]));
const DAYS = days([
  { day: "2026-12-12", available: false, specialPriceCrc: null },
  { day: "2026-12-24", available: true, specialPriceCrc: 180000 },
  { day: "2026-12-31", available: false, specialPriceCrc: 150000 },
]);

const html = (props: Partial<Parameters<typeof MonthGrid>[0]> = {}) =>
  renderToString(<MonthGrid month="2026-12" today={TODAY} days={DAYS} base={95000} label="Diciembre 2026" onSelect={() => {}} {...props} />);
const cells = (out: string) => [...out.matchAll(/<(button|div)[^>]*class="day[^"]*"[^>]*>[\s\S]*?<\/\1>/g)].map((m) => m[0]);
const cell = (out: string, n: number) => cells(out).find((c) => new RegExp(`<b>${n}</b>`).test(c))!;
const sub = (c: string) => c.match(/<span class="day-sub[^"]*">([^<]*)<\/span>/)![1];

// Formato de la revisión UX 2026-10-29 (C4 y N4): el mismo en el calendario del propietario y en la ficha.
describe("MonthGrid", () => {
  it("lunes primero: huecos antes del 1 (diciembre 2026 empieza en martes) y el mes entero, también las semanas pasadas", () => {
    const out = html({ today: "2026-12-16" });
    expect(out.indexOf('class="day-blank"')).toBeLessThan(out.indexOf("<b>1</b>"));
    expect(cells(out)).toHaveLength(31);
    expect(out).not.toContain("month-head");
  });

  it("interactiva: botones con aria-label (fecha, estado y precio); precio completo sin «₡» en los disponibles, solo el número en los ocupados y sin ★", () => {
    const out = html();
    expect(cell(out, 20)).toMatch(/^<button/);
    expect(cell(out, 20)).toContain('aria-label="20 de diciembre de 2026, disponible, ₡95\u00a0000"');
    expect(sub(cell(out, 20))).toBe("95\u00a0000");
    expect(cell(out, 12)).toContain('aria-label="12 de diciembre de 2026, ocupado, ₡95\u00a0000"');
    expect(sub(cell(out, 12))).toBe("");
    expect(cell(out, 12)).toMatch(/class="day is-busy"/);
    // Precio especial: solo la cifra distinta (el lector de pantalla lo dice).
    expect(sub(cell(out, 24))).toBe("180\u00a0000");
    expect(cell(out, 24)).toContain("is-long");
    expect(cell(out, 24)).toContain('aria-label="24 de diciembre de 2026, disponible, ₡180\u00a0000, precio distinto"');
    expect(sub(cell(out, 31))).toBe("");
    expect(out).not.toContain("★");
    expect(out).not.toContain("₡</span>");
  });

  it("los días pasados están desactivados y tachados (is-past), con su precio; los seleccionados llevan aria-pressed", () => {
    const out = html({ selected: ["2026-12-20", "2026-12-21"] });
    expect(cell(out, 9)).toMatch(/disabled=""/);
    expect(cell(out, 9)).toMatch(/is-past/);
    expect(cell(out, 9)).toContain('aria-label="9 de diciembre de 2026"');
    expect(sub(cell(out, 9))).toBe("95\u00a0000");
    expect(cell(out, 10)).not.toMatch(/disabled=""/);
    expect(cell(out, 20)).toContain('aria-pressed="true"');
    expect(cell(out, 22)).toContain('aria-pressed="false"');
  });

  it("casa solo mensual (sin precio base): sin cifras", () => {
    const out = html({ base: null, days: days([{ day: "2026-12-12", available: false, specialPriceCrc: null }]) });
    expect(sub(cell(out, 20))).toBe("");
    expect(cell(out, 20)).toContain('aria-label="20 de diciembre de 2026, disponible"');
    expect(cell(out, 12)).toMatch(/is-busy/);
  });

  it("solo lectura (ficha): rejilla con celdas etiquetadas, sin botones; precio de cada noche en la moneda elegida, sin decir el de los ocupados", () => {
    const out = html({ onSelect: undefined, currency: "USD", fx: 500 });
    expect(out).toContain('role="grid"');
    expect(out).not.toContain("<button");
    expect(cell(out, 20)).toContain('role="gridcell"');
    expect(sub(cell(out, 20))).toBe("$190");
    expect(cell(out, 20)).toContain('aria-label="20 de diciembre de 2026, disponible, $190"');
    expect(cell(out, 12)).toContain('aria-label="12 de diciembre de 2026, ocupado"');
  });

  it("con rango (ficha, ticket 08): los extremos y lo de en medio llevan la clase del estilo de «¿Cuándo?»; los nombres no cambian", () => {
    const out = html({ today: "2026-12-01", range: { arrival: "2026-12-20", departure: "2026-12-23" } });
    expect(cell(out, 20)).toMatch(/class="day range-end is-start"/);
    expect(cell(out, 20)).toContain('aria-pressed="true"');
    expect(cell(out, 21)).toMatch(/class="day in-range"/);
    expect(cell(out, 22)).toMatch(/class="day in-range"/);
    expect(cell(out, 23)).toMatch(/class="day range-end is-last"/);
    expect(cell(out, 24)).toMatch(/class="day"/);
    expect(cell(out, 20)).toContain('aria-label="20 de diciembre de 2026, disponible, ₡95\u00a0000"');
    // El ocupado de la ficha no dice su precio (el del propietario sí).
    expect(cell(html({ today: "2026-12-01", range: { arrival: null, departure: null } }), 12)).toContain('aria-label="12 de diciembre de 2026, ocupado"');
    // Un ocupado dentro del rango conserva su rayado (is-busy) debajo de la banda.
    expect(cell(html({ today: "2026-12-01", range: { arrival: "2026-12-10", departure: "2026-12-14" } }), 12)).toMatch(/class="day is-busy in-range"/);
  });

  it("con solo la llegada: una marca sola y sin banda", () => {
    const out = html({ today: "2026-12-01", range: { arrival: "2026-12-20", departure: null } });
    expect(cell(out, 20)).toMatch(/class="day range-end"/);
    expect(cell(out, 21)).toMatch(/class="day"/);
  });

  it("`canTap` apaga los días que no se pueden elegir (un ocupado como llegada) sin cambiar su nombre", () => {
    const out = html({ today: "2026-12-01", canTap: (d) => d !== "2026-12-12" });
    expect(cell(out, 12)).toMatch(/disabled=""/);
    expect(cell(out, 12)).toContain('aria-label="12 de diciembre de 2026, ocupado, ₡95\u00a0000"');
    expect(cell(out, 13)).not.toMatch(/disabled=""/);
  });

  it("atenuada (casa cerrada): clase is-dimmed y sin botones", () => {
    const out = html({ onSelect: undefined, dimmed: true });
    expect(out).toMatch(/class="month-grid is-dimmed"/);
    expect(out).not.toContain("<button");
  });

  it("fila de los días de la semana: L K M J V S D, oculta a los lectores de pantalla", () => {
    const out = renderToString(<WeekdayRow />);
    expect(out).toContain('aria-hidden="true"');
    expect(out.replace(/<[^>]+>/g, "")).toBe("LKMJVSD");
  });

  it("leyenda: Disponible · Ocupado, sin ★", () => {
    const out = renderToString(<MonthLegend />);
    expect(out).toMatch(/Disponible.*Ocupado/);
    expect(out).not.toContain("★");
  });
});
