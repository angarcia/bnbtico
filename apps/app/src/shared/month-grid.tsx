// Rejilla de un mes (pantalla 17 del diseño v1; formato de la revisión UX 2026-10-29, C4 y N4): lunes primero, casillas altas
// con el número arriba y el precio completo debajo («38 000», sin «₡» ni redondeo), fondo verde tonal; ocupados en terracota
// con rayas y solo el número; días pasados tachados y más claros; el precio especial sin marca (solo se ve la cifra
// distinta). La misma en el calendario del propietario (botones, `onSelect`) y en la ficha (solo lectura). La fila
// L K M J V S D va aparte (`WeekdayRow`): el propietario pinta una fija arriba para todos los meses. Solo React y el
// dominio: la ficha la carga en su propio trozo, sin router, Query ni supabase.
import { dayPrice, effectiveDay, monthGrid, type CalendarDays } from "../domain/calendar";
import type { Currency } from "../domain/currency";
import { longDate } from "../domain/dates";
import { FX_INITIAL } from "../domain/fx";
import { formatMoney } from "../domain/money";

const WEEKDAYS = ["L", "K", "M", "J", "V", "S", "D"];

export interface MonthGridProps {
  /** `YYYY-MM`. */
  month: string;
  /** Hoy en Costa Rica: lo anterior se tacha y no se edita. */
  today: string;
  days: CalendarDays;
  /** Precio por noche de la casa; null = solo mensual (sin cifras). */
  base: number | null;
  currency?: Currency;
  /** Colones por dólar (tipo vigente); solo cuenta en dólares. */
  fx?: number;
  selected?: readonly string[];
  /** Con él, cada día es un botón; sin él, solo lectura. */
  onSelect?: (day: string) => void;
  /** Casa cerrada a consultas: se ve, atenuada, sin tocar. */
  dimmed?: boolean;
  /** Nombre accesible de la rejilla («Diciembre 2026»). */
  label: string;
}

/** La fila «L K M J V S D», en la misma rejilla y con el mismo margen que las casillas. */
export function WeekdayRow({ className }: { className?: string }) {
  return (
    <div className={`month-week month-head${className ? ` ${className}` : ""}`} aria-hidden="true">
      {WEEKDAYS.map((d) => (
        <span key={d} className="wd">
          {d}
        </span>
      ))}
    </div>
  );
}

export function MonthGrid({ month, today, days, base, currency = "CRC", fx = FX_INITIAL.crcPerUsd, selected = [], onSelect, dimmed, label }: MonthGridProps) {
  const { weeks } = monthGrid(month, today);
  const year = month.slice(0, 4);
  const interactive = !!onSelect && !dimmed;
  return (
    <div className={`month-grid${dimmed ? " is-dimmed" : ""}`} role={interactive ? "group" : "grid"} aria-label={label}>
      {weeks.map((week, w) => (
        <div key={w} className="month-week" role={interactive ? undefined : "row"}>
          {week.map((g, i) => {
            if (!g) return <span key={`b${i}`} className="day-blank" aria-hidden="true" />;
            const s = effectiveDay(days, base, g.day);
            const off = g.past || g.beyond;
            // Ocupado: solo el número. Pasado: tachado y más claro, con su precio.
            const price = s.available && s.priceCrc !== null ? dayPrice(s.priceCrc, currency, fx) : "";
            const cls = `day${off ? " is-past" : s.available ? "" : " is-busy"}`;
            const name = [
              `${longDate(g.day)} de ${year}`,
              off ? null : s.available ? "disponible" : "ocupado",
              // Un día ocupado de la ficha (solo lectura) no dice su precio, que no enseña; en el calendario del propietario, sí.
              !off && (interactive || s.available) && s.priceCrc !== null ? formatMoney(s.priceCrc, currency, fx) : null,
              !off && s.special ? "precio distinto" : null,
            ]
              .filter(Boolean)
              .join(", ");
            const body = (
              <>
                <b>{g.date}</b>
                <span className={`day-sub${price.replace(/\D/g, "").length >= 6 ? " is-long" : ""}`}>{price}</span>
              </>
            );
            return interactive ? (
              <button key={g.day} type="button" className={cls} aria-label={name} aria-pressed={selected.includes(g.day)} disabled={off} onClick={() => onSelect(g.day)}>
                {body}
              </button>
            ) : (
              <div key={g.day} className={cls} role="gridcell" aria-label={name}>
                {body}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function MonthLegend() {
  return (
    <div className="month-legend">
      <span>
        <i className="swatch" aria-hidden="true" />
        Disponible
      </span>
      <span>
        <i className="swatch is-busy" aria-hidden="true" />
        Ocupado
      </span>
    </div>
  );
}
