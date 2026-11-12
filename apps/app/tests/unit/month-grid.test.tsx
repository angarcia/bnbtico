// Rejilla del mes (src/shared/month-grid.tsx): la del calendario del propietario (botones) y la de la ficha (solo lectura,
// ticket 05). Se comprueba el HTML que pinta: el mismo en el worker y en el navegador.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalendarDay } from "../../src/domain/calendar";
import { MonthGrid, MonthLegend, WeekdayRow } from "../../src/shared/month-grid";
import { I } from "../../src/shared/icons";
import { AirbnbLegend, countCalendarOrigins } from "../../src/client/airbnb-calendar-row";

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
  it("cuenta por separado ambos orígenes, incluyendo coincidencias y días sin fila", () => {
    const rows = days([
      { day: "2026-12-12", available: false, specialPriceCrc: null, imported: true, manualAvailable: true },
      { day: "2026-12-13", available: false, specialPriceCrc: 75000, imported: true, manualAvailable: false },
      { day: "2026-12-14", available: false, specialPriceCrc: null },
    ]);
    expect(countCalendarOrigins(rows, ["2026-12-12", "2026-12-13", "2026-12-14", "2026-12-15"])).toEqual({ importedCount: 2, manualCount: 2 });
    expect(countCalendarOrigins(rows, [])).toEqual({ importedCount: 0, manualCount: 0 });
  });
  it("distingue Airbnb con icono y leyenda privados, conservando el precio y el origen accesible", () => {
    const imported = days([{ day: "2026-12-12", available: false, specialPriceCrc: 75000, imported: true, manualAvailable: false }]);
    const out = html({ days: imported, importedIcon: <I.link size={16} /> });
    expect(cell(out, 12)).toContain('class="day-imported"');
    expect(cell(out, 12)).toContain("bloqueo manual y Airbnb");
    expect(sub(cell(out, 12))).toBe("75\u00a0000");
    expect(cell(out, 13)).not.toContain("day-imported");
    expect(renderToString(<AirbnbLegend days={[...imported.values()]} />)).toContain("Bloqueado por Airbnb");
    expect(renderToString(<AirbnbLegend days={[]} />)).not.toContain("Airbnb");
    expect(renderToString(<MonthLegend />)).not.toContain("Airbnb");
    for (const props of [{ onSelect: undefined }, { range: { arrival: null, departure: null } }]) {
      const publicGrid = html({ days: imported, ...props });
      expect(publicGrid).not.toContain("day-imported");
      expect(publicGrid).not.toContain("Airbnb");
      expect(sub(cell(publicGrid, 12))).toBe("");
    }
  });

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

  // Ficha (ronda de Ana 2 nov, ticket 08): se eligen llegada y salida; cada día es un botón con su fecha completa.
  it("ficha con rango: botones con la fecha completa, extremos y banda de «¿Cuándo?», y los días que no se pueden tocar desactivados", () => {
    const out = html({ range: { arrival: "2026-12-20", departure: "2026-12-23" }, canTap: (day) => day !== "2026-12-12" });
    expect(out).toContain('role="group"');
    expect(cell(out, 20)).toMatch(/^<button/);
    expect(cell(out, 20)).toMatch(/class="day range-end is-start"/);
    expect(cell(out, 21)).toMatch(/class="day in-range"/);
    expect(cell(out, 22)).toMatch(/class="day in-range"/);
    expect(cell(out, 23)).toMatch(/class="day range-end is-last"/);
    expect(cell(out, 24)).toMatch(/class="day"/);
    expect(cell(out, 20)).toContain('aria-pressed="true"');
    expect(cell(out, 23)).toContain('aria-pressed="true"');
    expect(cell(out, 21)).toContain('aria-pressed="false"');
    // El nombre empieza por la fecha completa, como en la hoja; un ocupado no dice el precio, que no enseña.
    expect(cell(out, 21)).toContain('aria-label="21 de diciembre de 2026, disponible, ₡95\u00a0000"');
    expect(cell(out, 12)).toContain('aria-label="12 de diciembre de 2026, ocupado"');
    expect(cell(out, 12)).toMatch(/disabled=""/);
    expect(cell(out, 13)).not.toMatch(/disabled=""/);
    expect(cell(out, 9)).toMatch(/disabled=""/);
  });

  it("ficha con solo la llegada: el extremo sin banda", () => {
    const out = html({ range: { arrival: "2026-12-20", departure: null } });
    expect(cell(out, 20)).toMatch(/class="day range-end"/);
    expect(cell(out, 21)).toMatch(/class="day"/);
  });

  it("ficha con rango vacío: ningún extremo ni banda", () => {
    const out = html({ range: { arrival: null, departure: null } });
    expect(out).not.toMatch(/range-end|in-range/);
    expect(out).not.toContain('aria-pressed="true"');
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
