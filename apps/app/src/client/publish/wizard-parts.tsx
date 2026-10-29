// Piezas del paso 1 que comparten el asistente de publicar, la entrada sin cuenta (/publicar) y la edición de una casa
// publicada: las tarjetas de elección, «¿Qué es?», qué tener a mano y la etapa de la cabecera. Trozo propio y pequeño
// (wizard-parts-*), medido en «Entrada de publicar»: /publicar no descarga los campos del asistente.
import { useState } from "react";
import { KIND_HINTS, KIND_LABELS, STEP_COUNT, stepPosition, wizardStage, type Kind, type Step } from "../../domain/listing";

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
    <section className="stack">
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

/** La etapa en vez de «Paso n de 8» (revisión UX C4): tres tramos que se leen más cortos que ocho pasos. */
export function StageLabel({ step }: { step: Step }) {
  const stage = wizardStage(step);
  return (
    <span className="right stage-label" aria-label={`${stage.name}, ${stage.position} de ${stage.size}. Paso ${stepPosition(step)} de ${STEP_COUNT}.`}>
      <b>{stage.name}</b>
      <span>
        {stage.position} de {stage.size}
      </span>
    </span>
  );
}
