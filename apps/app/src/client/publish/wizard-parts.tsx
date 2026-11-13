// Piezas del paso 1 que comparten el asistente de publicar, la entrada sin cuenta (/publicar) y la edición de una casa
// publicada: las tarjetas de elección, «¿Qué es?», qué tener a mano y la etapa de la cabecera. Trozo propio y pequeño
// (wizard-parts-*), medido en «Entrada de publicar»: /publicar no descarga los campos del asistente.
import { useState, type ReactNode } from "react";
import { KIND_HINTS, KIND_LABELS, LAST_STEP, STEPS, STEP_COUNT, stepPosition, wizardStage, type Kind, type Step } from "../../domain/listing";

/** Una cabecera para la entrada, los pasos y la verificación; conserva su sitio mientras carga el borrador. */
export function WizardHeader({ title = "Publicar casa", step, close, missingSteps = [] }: { title?: string; step: Step | null; close: ReactNode; missingSteps?: readonly Step[] }) {
  return (
    <div className="wizard-heading">
      <header className="header-flow publish-header">
        <h1>{title}</h1>
        {close}
      </header>
      {step ? (
        <>
          <div className="progress" aria-hidden="true">
            {/* En el resumen, lo obligatorio que falta conserva su tramo vacío. */}
            {STEPS.map((s) => (
              <span key={s} className={`${stepPosition(s) <= stepPosition(step) && !(step === LAST_STEP && missingSteps.includes(s)) ? "on" : ""}${s > 1 && wizardStage(s).first === s ? " stage-start" : ""}`.trim() || undefined} />
            ))}
          </div>
          <StageLabel step={step} />
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
}: {
  name: string;
  type: "checkbox" | "radio";
  options: { value: string; label: string; hint: string }[];
  selected: string[];
  /** Lo elegido tras cada toque (p. ej. el tipo de una casa publicada, que muestra el baño con «Habitación»). */
  onChange?: (current: string[]) => void;
}) {
  const [current, setCurrent] = useState<string[]>(selected);
  const toggle = (v: string) => {
    const next = type === "radio" ? [v] : current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    setCurrent(next);
    onChange?.(next);
  };
  return (
    <div className="grid-2">
      {options.map((o) => {
        const on = current.includes(o.value);
        return (
          <label key={o.value} className="choice" aria-pressed={on}>
            <input type={type} name={name} value={o.value} checked={on} onChange={() => toggle(o.value)} className="sr-input" />
            <b>{o.label}</b>
            <span>{o.hint}</span>
          </label>
        );
      })}
    </div>
  );
}

/** «¿Qué es?»: Alojamiento completo o Habitación (paso 1), en un campo `kind`. */
export function KindChoice({ kind }: { kind: Kind | null }) {
  return (
    <section className="stack publish-kind">
      <h2>¿Qué es?</h2>
      <ChoiceCards
        name="kind"
        type="radio"
        selected={kind === "habitacion" ? ["habitacion"] : kind ? ["completo"] : []}
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
