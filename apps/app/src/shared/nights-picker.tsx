// Número de noches de Explorar (modo noches de las feature flags, diseño #59 aprobado el 2026-11-17): el contador de
// «¿Quiénes?», de 1 a 90, y los atajos «Fin de semana», «1 semana», «2 semanas» y «1 mes». Lo comparten la búsqueda del
// teléfono («¿Cuántas noches?») y el panel «Noches» de la búsqueda de escritorio.
import { NIGHTS_MAX } from "../domain/filters";
import { ChoiceChips } from "./ui/choice";
import { Stepper } from "./ui/stepper";
import * as CALENDAR_COPY from "../domain/calendar-copy";

const QUICK: readonly { label: string; nights: number }[] = [
  { label: CALENDAR_COPY.weekend, nights: 2 },
  { label: CALENDAR_COPY.oneWeek, nights: 7 },
  { label: CALENDAR_COPY.twoWeeks, nights: 14 },
  { label: CALENDAR_COPY.oneMonth, nights: 30 },
];

export function NightsPicker({ nights, onChange }: { nights: number; onChange(nights: number): void }) {
  return (
    <>
      <div className="row between">
        <span className="stack gap-0">
          <b>{CALENDAR_COPY.nights}</b>
          <span className="small muted">{CALENDAR_COPY.nightsRange({ max: NIGHTS_MAX })}</span>
        </span>
        <Stepper unit="nights" value={nights} min={1} max={NIGHTS_MAX} empty={!nights} onChange={onChange} />
      </div>
      {/* Como «Qué necesitan»: rejilla de dos columnas y el check en un hueco fijo, para que marcar no mueva nada. */}
      <ChoiceChips
        as="button"
        placement="nights-quick"
        label={CALENDAR_COPY.nightsShortcuts}
        options={QUICK.map((q) => ({ value: String(q.nights), label: q.label }))}
        selected={[String(nights)]}
        onToggle={(v) => onChange(Number(v))}
      />
    </>
  );
}
