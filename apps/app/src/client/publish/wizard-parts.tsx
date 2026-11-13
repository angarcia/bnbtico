// Piezas del paso 1 que comparten el asistente de publicar, la entrada sin cuenta (/publicar) y la edición de una casa
// publicada: las tarjetas de elección, «¿Qué es?», qué tener a mano y la etapa de la cabecera. Trozo propio y pequeño
// (wizard-parts-*), medido en «Entrada de publicar»: /publicar no descarga los campos del asistente.
import { useId, useState, type ReactNode } from "react";
import { KIND_HINTS, KIND_LABELS, LAST_STEP, STEPS, STEP_COUNT, stepPosition, wizardStage, type Kind, type Step } from "../../domain/listing";
import { I } from "../../shared/icons";

/** Una cabecera para la entrada, los pasos y la verificación; conserva su sitio mientras carga el borrador. */
export function WizardHeader({ title = "Publicar casa", step, lastInGroup, close, actions, missingSteps = [] }: { title?: string; step: Step | null; lastInGroup?: Step; close: ReactNode; actions?: ReactNode; missingSteps?: readonly Step[] }) {
  return (
    <div className="wizard-heading">
      <header className="header-flow publish-header">
        <h1>{title}</h1>
        {actions}
        {close}
      </header>
      {step ? (
        <>
          <div className="progress" aria-hidden="true">
            {/* En el resumen, lo obligatorio que falta conserva su tramo vacío. */}
            {STEPS.map((s) => (
              <span key={s} className={`${stepPosition(s) <= stepPosition(lastInGroup ?? step) && !(step === LAST_STEP && missingSteps.includes(s)) ? "on" : ""}${s > 1 && wizardStage(s).first === s ? " stage-start" : ""}`.trim() || undefined} />
            ))}
          </div>
          {lastInGroup ? (
            <span className="right stage-label">Pasos {stepPosition(step)} a {stepPosition(lastInGroup)} de {STEP_COUNT}</span>
          ) : <StageLabel step={step} />}
        </>
      ) : null}
    </div>
  );
}

/** Tarjetas de elección: casillas o radios con aspecto de tarjeta y aria-pressed. */
export function ChoiceCards({
  name,
  type,
  options,
  selected,
  onChange,
  compact = false,
}: {
  name: string;
  type: "checkbox" | "radio";
  options: { value: string; label: string; hint: string }[];
  selected: string[];
  /** Lo elegido tras cada toque (p. ej. el tipo de una casa publicada, que muestra el baño con «Habitación»). */
  onChange?: (current: string[]) => void;
  compact?: boolean;
}) {
  const [current, setCurrent] = useState<string[]>(selected);
  const [openHint, setOpenHint] = useState<string | null>(null);
  const hintId = useId();
  const toggle = (v: string) => {
    const next = type === "radio" ? [v] : current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    setCurrent(next);
    onChange?.(next);
  };
  return (
    <div className="grid-2">
      {options.map((o) => {
        const on = current.includes(o.value);
        const choice = (
          <label key={o.value} className="choice" aria-pressed={on}>
            <input type={type} name={name} value={o.value} checked={on} onChange={() => toggle(o.value)} className="sr-input" />
            <b>{o.label}</b>
            {!compact ? <span>{o.hint}</span> : null}
          </label>
        );
        if (!compact) return choice;
        const expanded = openHint === o.value;
        const id = `${hintId}-${o.value}`;
        return (
          <div key={o.value} className="compact-kind-option">
            <div className="row">
              {choice}
              <button type="button" className="icon-btn" aria-label={`Qué significa ${o.label}`} aria-expanded={expanded} aria-controls={id} onClick={() => setOpenHint(expanded ? null : o.value)}>
                <I.help size={20} />
              </button>
            </div>
            <p id={id} className="small muted" hidden={!expanded}>{o.hint}</p>
          </div>
        );
      })}
    </div>
  );
}

/** «¿Qué es?»: Alojamiento completo o Habitación (paso 1), en un campo `kind`. */
export function KindChoice({ kind, onChange, compact }: { kind: Kind | null; onChange?: (kind: "completo" | "habitacion") => void; compact?: boolean }) {
  return (
    <section className="stack publish-kind">
      <h2>¿Qué es?</h2>
      <ChoiceCards
        name="kind"
        type="radio"
        compact={compact}
        selected={kind === "habitacion" ? ["habitacion"] : kind ? ["completo"] : []}
        onChange={onChange ? ([value]) => onChange(value === "habitacion" ? "habitacion" : "completo") : undefined}
        options={[
          { value: "completo", label: KIND_LABELS.completo, hint: KIND_HINTS.completo },
          { value: "habitacion", label: KIND_LABELS.habitacion, hint: KIND_HINTS.habitacion },
        ]}
      />
    </section>
  );
}

/** Lo que pide el asistente (revisión UX C4; publicar v2: las fotos ya no son obligatorias para enviar). */
export function ReadyList() {
  return (
    <ul className="ready-list small">
      <li>Fotos horizontales, si ya las tiene</li>
      <li>El precio por noche</li>
      <li>Unos 10 minutos</li>
    </ul>
  );
}

/** Progreso por etapa: la primera solo muestra la cuenta; el nombre se conserva en la descripción accesible. */
export function StageLabel({ step }: { step: Step }) {
  const stage = wizardStage(step);
  // El último paso no es «Precio · 2 de 2» sino «Revisar y enviar» (revisión UX 2026-10-29, A9).
  if (step === LAST_STEP)
    return (
      <div className="right stage-label stage-summary" aria-label={`Revisar y enviar, último paso. Paso ${stepPosition(step)} de ${STEP_COUNT}.`}>
        <h2>Revisar y enviar</h2>
        <span>último paso</span>
      </div>
    );
  return (
    <span className="right stage-label" aria-label={`${stage.name}, ${stage.position} de ${stage.size}. Paso ${stepPosition(step)} de ${STEP_COUNT}.`}>
      {stage.index === 0 ? null : <b>{stage.name}</b>}
      <span>
        {stage.position} de {stage.size}
      </span>
    </span>
  );
}
