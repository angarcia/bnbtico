/** Calendario de solo lectura del mes actual (hora de Costa Rica), sin cifras por día: el precio base va en la nota.
 *  En la fase 4 los días con precio distinto o no disponibles llevarán su marca. */
const DOWS = ["L", "K", "M", "J", "V", "S", "D"];

function todayInCostaRica(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", year: "numeric", month: "numeric" }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month") - 1 };
}

export function ReadonlyCalendar({ note }: { note: string }) {
  const { year, month } = todayInCostaRica();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // lunes = 0
  const title = new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  return (
    <div className="card stack">
      <b style={{ textTransform: "capitalize" }}>{title}</b>
      <div className="cal">
        {DOWS.map((d) => (
          <div key={d} className="dow">{d}</div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`e${i}`} className="d empty" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => (
          <div key={i + 1} className="d num">{i + 1}</div>
        ))}
      </div>
      <p className="xs muted">{note}</p>
    </div>
  );
}
