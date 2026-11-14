// Rejilla de un mes (pantalla 17 del diseño v1; formato de la revisión UX 2026-10-29, C4 y N4): lunes primero, casillas altas
// con el número arriba y el precio completo debajo, fondo verde tonal; ocupados en terracota
// con rayas y solo el número; días pasados tachados y más claros; el precio especial sin marca (solo se ve la cifra
// distinta). La misma en el calendario del propietario (botones, `onSelect`) y en la ficha (botones con `range`: se eligen
// llegada y salida, ronda de Ana 2 nov, ticket 08; las reglas del toque son de domain/range.ts y las pone la ficha). La fila
// L K M J V S D va aparte (`WeekdayRow`): el propietario pinta una fija arriba para todos los meses. Solo React y el
// dominio: la ficha la carga en su propio trozo, sin router, Query ni supabase.
import { dayPrice, effectiveDay, monthGrid, type CalendarDays } from "../domain/calendar";
import type { Currency } from "../domain/currency";
import { longDateWithYear } from "../domain/dates";
import { FX_INITIAL } from "../domain/fx";
import { formatMoney } from "../domain/money";
import type { ReactNode } from "react";

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
  showCurrencySymbol?: boolean;
  /** Colones por dólar (tipo vigente); solo cuenta en dólares. */
  fx?: number;
  selected?: readonly string[];
  /** La estancia elegida en la ficha: extremos y banda con el estilo de «¿Cuándo?» (`range-end`, `in-range`, `is-start`,
   *  `is-last`), los extremos con `aria-pressed` y sin decir el precio de los ocupados, que no se enseña. */
  range?: { arrival: string | null; departure: string | null };
  /** Los días donde devuelve false no se tocan (un ocupado como llegada); sin él, todos los del mes. */
  canTap?: (day: string) => boolean;
  /** Con él, cada día es un botón; sin él, solo lectura. */
  onSelect?: (day: string) => void;
  /** Casa cerrada a consultas: se ve, atenuada, sin tocar. */
  dimmed?: boolean;
  /** Solo calendario privado: origen de los bloqueos importados. */
  importedIcon?: ReactNode;
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

export function MonthGrid({ month, today, days, base, currency = "CRC", showCurrencySymbol, fx = FX_INITIAL.crcPerUsd, selected = [], range, canTap, onSelect, dimmed, importedIcon, label }: MonthGridProps) {
  const { weeks } = monthGrid(month, today);
  const start = range?.arrival ?? null;
  const end = range?.departure ?? null;
  const interactive = !!onSelect && !dimmed;
  return (
    <div className={`month-grid${dimmed ? " is-dimmed" : ""}`} role={interactive ? "group" : "grid"} aria-label={label}>
      {weeks.map((week, w) => (
        <div key={w} className="month-week" role={interactive ? undefined : "row"}>
          {week.map((g, i) => {
            if (!g) return <span key={`b${i}`} className="day-blank" aria-hidden="true" />;
            const s = effectiveDay(days, base, g.day);
            const off = g.past || g.beyond;
            // Ocupado: solo número, salvo importados privados con precio y marca de origen.
            const imported = !!importedIcon && !range && !off && s.imported;
            const formatPrice = showCurrencySymbol ? formatMoney : dayPrice;
            const price = (s.available || imported) && s.priceCrc !== null ? formatPrice(s.priceCrc, currency, fx) : "";
            const isEnd = !off && (g.day === start || g.day === end);
            const inside = !off && !!start && !!end && g.day > start && g.day < end;
            const band = isEnd && start && end ? (g.day === start ? " is-start" : " is-last") : "";
            const cls = `day${off ? " is-past" : s.available ? "" : " is-busy"}${!off && s.special ? " is-special" : ""}${isEnd ? " range-end" : ""}${inside ? " in-range" : ""}${band}`;
            const name = [
              longDateWithYear(g.day),
              off ? null : s.available ? "disponible" : "ocupado",
              !off && (interactive || importedIcon) && !range && s.imported ? s.manualAvailable === false ? "bloqueo manual y Airbnb" : "ocupado por Airbnb" : null,
              // Un día ocupado de la ficha no dice su precio, que no enseña; en el calendario del propietario, sí.
              !off && ((interactive && !range) || s.available || imported) && s.priceCrc !== null ? formatMoney(s.priceCrc, currency, fx) : null,
              !off && s.special ? "precio distinto" : null,
            ]
              .filter(Boolean)
              .join(", ");
            const body = (
              <>
                <b>{g.date}</b>
                <span className={`day-sub${price.replace(/\D/g, "").length >= 6 ? " is-long" : ""}`}>{price}</span>
                {imported ? <span className="day-imported" aria-hidden="true">{importedIcon}</span> : null}
              </>
            );
            return interactive ? (
              <button key={g.day} type="button" className={cls} aria-label={name} aria-pressed={range ? isEnd : selected.includes(g.day)} disabled={off || (canTap ? !canTap(g.day) : false)} onClick={() => onSelect(g.day)}>
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

export function MonthLegend({ extra }: { extra?: ReactNode }) {
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
      {extra}
    </div>
  );
}
