// Rejilla de un mes (pantalla 17 del diseño v1): lunes primero, un día por casilla con su precio («95k»), ocupados en
// terracota claro y ★ en los de precio distinto al base. Con `onSelect` los días son botones (calendario del propietario);
// sin él es una rejilla de solo lectura (la ficha pública, ticket 05). Solo React y el dominio: la ficha la carga en su
// propio trozo, sin router, Query ni supabase.
import { compactPrice, effectiveDay, monthGrid, type CalendarDays } from "../domain/calendar";
import type { Currency } from "../domain/currency";
import { longDate } from "../domain/dates";
import { FX_INITIAL } from "../domain/fx";
import { formatMoney } from "../domain/money";

const WEEKDAYS = ["L", "K", "M", "J", "V", "S", "D"];

export interface MonthGridProps {
  /** `YYYY-MM`. */
  month: string;
  /** Hoy en Costa Rica: lo anterior se atenúa y no se edita. */
  today: string;
  days: CalendarDays;
  /** Precio por noche de la casa; null = solo mensual. */
  base: number | null;
  /** Qué cifra lleva cada casilla: todas (propietario), solo las ★ (ficha) o ninguna. */
  prices: "all" | "special" | "none";
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

export function MonthGrid({ month, today, days, base, prices, currency = "CRC", fx = FX_INITIAL.crcPerUsd, selected = [], onSelect, dimmed, label }: MonthGridProps) {
  const { weeks } = monthGrid(month, today);
  const year = month.slice(0, 4);
  const interactive = !!onSelect && !dimmed;
  return (
    <div className={`month-grid${dimmed ? " is-dimmed" : ""}`} role={interactive ? "group" : "grid"} aria-label={label}>
      <div className="month-week month-head" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d} className="wd">
            {d}
          </span>
        ))}
      </div>
      {weeks.map((week, w) => (
        <div key={w} className="month-week" role={interactive ? undefined : "row"}>
          {week.map((g, i) => {
            if (!g) return <span key={`b${i}`} className="day-blank" aria-hidden="true" />;
            const s = effectiveDay(days, base, g.day);
            const showPrice = s.priceCrc !== null && (prices === "all" || (prices === "special" && s.special));
            const mark = s.special && prices !== "none" ? " ★" : "";
            const off = g.past || g.beyond;
            const cls = `day${s.available ? "" : " is-busy"}${off ? " is-past" : ""}`;
            const name = [
              `${longDate(g.day)} de ${year}`,
              s.available ? "disponible" : "ocupado",
              (prices === "all" || mark) && s.priceCrc !== null ? formatMoney(s.priceCrc, currency, fx) : null,
              mark ? "precio distinto" : null,
            ]
              .filter(Boolean)
              .join(", ");
            const body = (
              <>
                <b>{`${g.date}${mark}`}</b>
                <span className="day-sub">{!s.available ? "ocupado" : showPrice ? compactPrice(s.priceCrc!, currency, fx) : ""}</span>
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

export function MonthLegend({ special }: { special: boolean }) {
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
      {special ? <span>★ Precio distinto</span> : null}
    </div>
  );
}
