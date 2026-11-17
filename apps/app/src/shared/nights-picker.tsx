// Número de noches de Explorar (modo noches de las feature flags, diseño #59 aprobado el 2026-11-17): el contador de
// «¿Quiénes?», de 1 a 90, y los atajos «Fin de semana», «1 semana», «2 semanas» y «1 mes». Lo comparten la búsqueda del
// teléfono («¿Cuántas noches?») y el panel «Noches» de la búsqueda de escritorio.
import { NIGHTS_MAX } from "../domain/filters";
import { I } from "./icons";

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
        <span className="people-stepper">
          <button type="button" aria-label="Una noche menos" disabled={nights <= 1} onClick={() => onChange(nights - 1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
          <b className={nights ? "num" : "num is-empty"} aria-live="polite">
            {nights || "–"}
          </b>
          <button type="button" aria-label="Una noche más" disabled={nights >= NIGHTS_MAX} onClick={() => onChange(nights + 1)}>
            <I.plus size={20} />
          </button>
        </span>
      </div>
      <div className="nights-quick" role="group" aria-label="Atajos de noches">
        {QUICK.map((q) => (
          <button key={q.nights} type="button" className="chip" aria-pressed={nights === q.nights} onClick={() => onChange(q.nights)}>
            {q.label}
          </button>
        ))}
      </div>
    </>
  );
}
