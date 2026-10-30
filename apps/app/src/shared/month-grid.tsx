// Rejilla de un mes (pantalla 17 del diseño v1): lunes primero, un día por casilla con su precio («95k»), ocupados en
// terracota claro con rayas y «Ocupado», y ★ en los de precio distinto al base. Dos tamaños: «compact» (la ficha, con su
// cabecera L K M J V S D) y «tall» (el calendario del propietario: casillas altas con «₡95k», sin las semanas ya pasadas
// enteras; la pantalla pinta una sola `WeekdayRow` fija arriba para todos los meses). Con `onSelect` los días son botones
// (calendario del propietario); sin él es una rejilla de solo lectura (la ficha pública, ticket 05). Solo React y el
// dominio: la ficha la carga en su propio trozo, sin router, Query ni supabase.
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
  /** Qué cifra lleva cada casilla: todas (propietario y ficha), solo las ★ o ninguna (solo mensual). */
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
  /** «tall»: casillas altas, sin cabecera propia y precio con ₡ («₡95k»). Por defecto «compact». */
  size?: "compact" | "tall";
}

/** El «₡» de las casillas va aparte: en pantallas estrechas (menos de 360 px) se oculta y queda «95 mil»; el precio base
 *  con su «₡» está debajo de la rejilla. */
const CUR = <span className="day-cur">₡</span>;

/** La fila «L K M J V S D». */
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

export function MonthGrid({ month, today, days, base, prices, currency = "CRC", fx = FX_INITIAL.crcPerUsd, selected = [], onSelect, dimmed, label, size = "compact" }: MonthGridProps) {
  const tall = size === "tall";
  // En la alta, las semanas ya pasadas enteras no se pintan: la de hoy, con sus días anteriores atenuados, es la primera.
  const all = monthGrid(month, today).weeks;
  const weeks = tall ? all.filter((week) => week.some((g) => g && !g.past)) : all;
  const year = month.slice(0, 4);
  const interactive = !!onSelect && !dimmed;
  // Con cifra en todos los días (propietario y ficha), «₡95 mil»; solo en los ★, «95 mil».
  const withCur = tall || prices === "all";
  return (
    <div className={`month-grid${tall ? " is-tall" : ""}${dimmed ? " is-dimmed" : ""}`} role={interactive ? "group" : "grid"} aria-label={label}>
      {tall ? null : <WeekdayRow />}
      {weeks.map((week, w) => (
        <div key={w} className="month-week" role={interactive ? undefined : "row"}>
          {week.map((g, i) => {
            if (!g) return <span key={`b${i}`} className="day-blank" aria-hidden="true" />;
            const s = effectiveDay(days, base, g.day);
            const showPrice = s.priceCrc !== null && (prices === "all" || (prices === "special" && s.special));
            const mark = s.special && prices !== "none" ? " ★" : "";
            const off = g.past || g.beyond;
            // Un día pasado (o fuera de la ventana) es solo su número: sin ocupado ni precio (revisión UX A4).
            const cls = off ? "day is-past" : `day${s.available ? "" : " is-busy"}`;
            const name = [
              `${longDate(g.day)} de ${year}`,
              s.available ? "disponible" : "ocupado",
              // Un día ocupado de la ficha (solo lectura) no dice su precio, que no enseña; en el calendario del propietario, sí.
              ((prices === "all" && (interactive || s.available)) || mark) && s.priceCrc !== null ? formatMoney(s.priceCrc, currency, fx) : null,
              mark ? "precio distinto" : null,
            ]
              .filter(Boolean)
              .join(", ");
            const body = (
              <>
                <b>{off ? `${g.date}` : `${g.date}${mark}`}</b>
                <span className="day-sub">{off ? "" : !s.available ? "Ocupado" : showPrice ? <>{withCur && currency === "CRC" && CUR}{compactPrice(s.priceCrc!, currency, fx)}</> : ""}</span>
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
