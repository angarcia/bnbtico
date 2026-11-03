// Calendario de «¿Cuándo?» (pantalla v2 03): los meses apilados de hoy a hoy + 365, lunes primero. Por noches, llegada y
// salida con la banda entre las dos; con el mensual, un solo día («Desde»), hasta hoy + 335. Sobre `monthGrid()` del
// dominio, no sobre `MonthGrid` (precios y semántica del propietario). Lo usan la pantalla de buscar y la hoja de contacto
// (revisión UX 2026-10-29, N2): solo React y el dominio, para la ficha del servidor.
import { calendarMonths, monthGrid } from "../domain/calendar";
import { addDays, longDateWithYear } from "../domain/dates";
import { MONTHLY_FROM_MAX_DAYS, STAY_MAX_DAYS } from "../domain/filters";
import { tapRange, type RangeState } from "../domain/range";

const WEEKDAYS = ["L", "K", "M", "J", "V", "S", "D"];

type RangeProps = { today: string; mode: "range"; value: RangeState; onChange(v: RangeState): void };
type FromProps = { today: string; mode: "from"; value: string | null; onChange(v: string): void };

export function RangeCalendar(props: RangeProps | FromProps) {
  const { today } = props;
  const lastDay = addDays(today, props.mode === "from" ? MONTHLY_FROM_MAX_DAYS : STAY_MAX_DAYS);
  const start = props.mode === "from" ? props.value : props.value.arrival;
  const end = props.mode === "from" ? null : props.value.departure;
  // Hoy + 365 solo vale como salida (por noches): sin una llegada pendiente antes, no se puede elegir.
  const departurePending = props.mode === "from" || (!!start && !end);
  const tap = (day: string) => (props.mode === "from" ? props.onChange(day) : props.onChange(tapRange(props.value, day)));
  return (
    <div className="range-calendar">
      <div className="range-weekdays" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      {calendarMonths(today).map((month) => {
        const grid = monthGrid(month, today);
        return (
          <section key={month} className="range-month">
            <h3 className="range-title">{grid.title}</h3>
            <div className="range-grid">
              {grid.weeks.flat().map((g, i) => {
                if (!g) return <span key={`b${i}`} aria-hidden="true" />;
                const isEnd = g.day === start || g.day === end;
                const inside = !!start && !!end && g.day > start && g.day < end;
                const cls = `range-day${isEnd ? " range-end" : ""}${inside ? " in-range" : ""}${start && end && g.day === start ? " is-start" : ""}${start && end && g.day === end ? " is-last" : ""}`;
                return (
                  <button key={g.day} type="button" className={cls} aria-label={longDateWithYear(g.day) ?? g.day} aria-pressed={isEnd} disabled={g.day < today || g.day > lastDay || (g.day === lastDay && !departurePending)} onClick={() => tap(g.day)}>
                    <b>{g.date}</b>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
