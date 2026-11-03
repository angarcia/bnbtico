// Calendario de «¿Cuándo?» (pantalla v2 03): los meses apilados de hoy a hoy + 365, lunes primero. Llegada y salida con la
// banda entre las dos (el modo mensual «Desde» se fue el 2026-11-02). Sobre `monthGrid()` del
// dominio, no sobre `MonthGrid` (precios y semántica del propietario). Lo usan la pantalla de buscar y la hoja de contacto
// (revisión UX 2026-10-29, N2): solo React y el dominio, para la ficha del servidor.
import { calendarMonths, monthGrid } from "../domain/calendar";
import { addDays, longDateWithYear } from "../domain/dates";
import { STAY_MAX_DAYS } from "../domain/filters";
import { canTapDay, tapRangeFree, type BusyDay, type RangeState } from "../domain/range";

const FREE: BusyDay = () => false;

const WEEKDAYS = ["L", "K", "M", "J", "V", "S", "D"];

/** `busy`: los días ocupados de la casa (la hoja de contacto, ticket 08 de la ronda del 2 nov): no se puede llegar en uno, y un
 *  rango con una noche ocupada se rechaza con `onReject` (la salida sí puede caer en el primer ocupado). Sin él, la búsqueda
 *  de Explorar: todos los días valen. Los días llegan por props: este módulo no sabe de Query ni de calendarios de casas. */
export function RangeCalendar(props: { today: string; value: RangeState; onChange(v: RangeState): void; busy?: BusyDay; onReject?(): void }) {
  const { today } = props;
  const busy = props.busy ?? FREE;
  const lastDay = addDays(today, STAY_MAX_DAYS);
  const start = props.value.arrival;
  const end = props.value.departure;
  // Hoy + 365 solo vale como salida: sin una llegada pendiente antes, no se puede elegir.
  const departurePending = !!start && !end;
  const tap = (day: string) => {
    const r = tapRangeFree(props.value, day, busy);
    if (r.rejected) props.onReject?.();
    else props.onChange(r.state);
  };
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
                  <button key={g.day} type="button" className={cls} aria-label={longDateWithYear(g.day) ?? g.day} aria-pressed={isEnd} disabled={g.day < today || g.day > lastDay || (g.day === lastDay && !departurePending) || !canTapDay(props.value, g.day, busy)} onClick={() => tap(g.day)}>
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
