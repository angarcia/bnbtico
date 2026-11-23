// Número de noches de Explorar (modo noches de las feature flags, diseño #59 aprobado el 2026-11-17): el contador de
// «¿Quiénes?», de 1 a 90, y los atajos «Fin de semana», «1 semana», «2 semanas» y «1 mes». Lo comparten la búsqueda del
// teléfono («¿Cuántas noches?») y el panel «Noches» de la búsqueda de escritorio.
import { NIGHTS_MAX } from "../domain/filters";
import { ChoiceChips } from "./ui/choice";
import { Stepper } from "./ui/stepper";

const QUICK: readonly { label: string; nights: number }[] = [
  { label: "Fin de semana", nights: 2 },
  { label: "1 semana", nights: 7 },
  { label: "2 semanas", nights: 14 },
  { label: "1 mes", nights: 30 },
];

export function NightsPicker({ nights, onChange }: { nights: number; onChange(nights: number): void }) {
  return (
    <>
      <div className="row between">
        <span className="stack gap-0">
          <b>Noches</b>
          <span className="small muted">De 1 a {NIGHTS_MAX}</span>
        </span>
        <Stepper unit="Una noche" value={nights} min={1} max={NIGHTS_MAX} empty={!nights} onChange={onChange} />
      </div>
      {/* Como «Qué necesitan»: rejilla de dos columnas y el check en un hueco fijo, para que marcar no mueva nada. */}
      <ChoiceChips
        as="button"
        placement="nights-quick"
        label="Atajos de noches"
        options={QUICK.map((q) => ({ value: String(q.nights), label: q.label }))}
        selected={[String(nights)]}
        onToggle={(v) => onChange(Number(v))}
      />
    </>
  );
}
