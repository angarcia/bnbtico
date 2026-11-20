// Contador −/+ común (historia 07, paso 4; API en docs/componentes.md): publicar, editar, Filtros, la búsqueda, el número
// de noches, la hoja de contacto y Explorar en escritorio. Botones de 44 × 44, un solo desactivado y un nombre accesible
// único («Una persona menos», «Un dormitorio más»). `CounterRow` es su fila con la etiqueta y el icono.
import type { ReactNode } from "react";

/** Lo que cuenta, en singular con su artículo: da el nombre de los botones («Una persona menos»). */
export type StepperUnit = "Una persona" | "Un dormitorio" | "Un baño" | "Una noche";

/** Un campo para escribir la cifra entre los botones (hoja de contacto). */
export interface StepperInput {
  id: string;
  name: string;
  placeholder: string;
  /** El texto tal cual: quien lo usa decide qué número es (vacío = sin indicar). */
  onInput(text: string): void;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

export function Stepper({
  unit,
  value,
  min,
  max,
  onChange,
  display,
  valueLabel,
  input,
  icon,
  empty = false,
  describedBy,
}: {
  unit: StepperUnit;
  /** La cifra de la que parten − y +; `display` la sustituye a la vista («–» sin indicar, «2+»). */
  value: number;
  min: number;
  max: number;
  onChange(n: number): void;
  display?: ReactNode;
  /** Nombre de la cifra para lectores de pantalla («3 personas», «Sin indicar»). */
  valueLabel?: string;
  /** Con campo editable: el valor del campo (vacío = sin indicar). */
  input?: StepperInput & { value: number | null };
  /** Icono decorativo entre «−» y la cifra (capacidad del asistente en escritorio). */
  icon?: ReactNode;
  /** Sin indicar: un «–» en gris en lugar de la cifra. */
  empty?: boolean;
  /** El error del contador (por su `id`), en los dos botones. */
  describedBy?: string;
}) {
  return (
    <span className="stepper">
      <button type="button" aria-label={`${unit} menos`} aria-describedby={describedBy} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      {icon ? (
        <span className="counter-value-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {input ? (
        <input
          id={input.id}
          className="stepper-input"
          type="number"
          name={input.name}
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          placeholder={input.placeholder}
          value={input.value ?? ""}
          aria-invalid={input["aria-invalid"]}
          aria-describedby={input["aria-describedby"]}
          onChange={(e) => input.onInput(e.target.value)}
        />
      ) : (
        <b className={empty ? "num is-empty" : "num"} aria-live="polite" aria-label={valueLabel}>
          {empty ? "–" : (display ?? value)}
        </b>
      )}
      <button type="button" aria-label={`${unit} más`} aria-describedby={describedBy} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  );
}

/** Fila de contador: etiqueta (con icono delante, o junto a la cifra con `iconByValue`) y el contador. */
export function CounterRow({
  label,
  icon,
  iconByValue = false,
  ...stepper
}: { label: string; icon?: ReactNode; iconByValue?: boolean } & Omit<Parameters<typeof Stepper>[0], "icon">) {
  return (
    <div className="counter">
      <span className="strong counter-label">
        {!iconByValue && icon}
        {label}
      </span>
      <Stepper {...stepper} icon={iconByValue ? icon : undefined} />
    </div>
  );
}
