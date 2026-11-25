// Campos de formulario comunes (historia 07, paso 4; API en docs/componentes.md). Sin router ni consultas. El aspecto
// sale de shared/ui/componentes.css, bloque «Campos»: las pantallas no escriben las clases ni redefinen el aspecto.
// - `Field` pinta la etiqueta, la ayuda, el error y el contador, y da al control su `id`, `aria-describedby` (error,
//   ayuda y contador) y `aria-invalid`. El error va debajo del campo que falla.
// - `TextInput`, `TextArea` y `Select` son el campo base (el CSS de los elementos), con desactivado y solo lectura.
// - `AffixInput`: el campo con «₡» delante, en tres tamaños (publicar, Filtros, calendario).
// - `SearchInput`: el buscador con la lupa; `Checkbox`; `StickyActions`, la barra de pie fija con su espaciador.
import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { I } from "./icons";

/** Lo que `Field` da al control que pinta. */
export interface ControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export type FieldSize = "md" | "compact";
/** Contador o estado del texto a la derecha de la etiqueta («12 / 32», «Puede añadirla después»). */
export type FieldCount = { text: ReactNode; tone?: "muted" | "bad" };
const COUNT_TONE = { muted: " muted", bad: " counter-out" } as const;

export function Field({
  label,
  labelHidden = false,
  hint,
  hintTone = "muted",
  error,
  count,
  id,
  size = "md",
  describedBy,
  grow = false,
  children,
}: {
  label: ReactNode;
  /** La etiqueta solo para lectores de pantalla (el campo ya se entiende por su sitio). */
  labelHidden?: boolean;
  hint?: ReactNode;
  /** `warn`: la ayuda avisa en ocre y se anuncia al cambiar (p. ej. el precio al mes mal escrito). */
  hintTone?: "muted" | "warn";
  error?: string | null;
  count?: FieldCount;
  id?: string;
  /** `compact`: 48 px y etiqueta de 14, para las hojas. */
  size?: FieldSize;
  /** Otros textos que describen el campo (por su `id`), después de los del campo. */
  describedBy?: string;
  /** Llena el alto que queda (la descripción del asistente). */
  grow?: boolean;
  children: (control: ControlProps) => ReactNode;
}) {
  const auto = useId();
  const base = id ?? auto;
  const errorId = `${base}-error`;
  const hintId = `${base}-hint`;
  const countId = `${base}-count`;
  const described = [error ? errorId : null, hint ? hintId : null, count ? countId : null, describedBy ?? null].filter(Boolean).join(" ");
  const labelEl = (
    <label htmlFor={base} className={labelHidden ? "sr-only" : undefined}>
      {label}
    </label>
  );
  return (
    <div className={`field${size === "compact" ? " field-compact" : ""}${grow ? " grow-col" : ""}`}>
      {count ? (
        <div className="row between baseline">
          {labelEl}
          <span id={countId} className={`xs num${COUNT_TONE[count.tone ?? "muted"]}`} aria-live="polite">
            {count.text}
          </span>
        </div>
      ) : (
        labelEl
      )}
      {children({ id: base, ...(described ? { "aria-describedby": described } : {}), ...(error ? { "aria-invalid": true } : {}) })}
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <span id={hintId} className={hintTone === "warn" ? "field-hint is-warn" : "field-hint"} aria-live={hintTone === "warn" ? "polite" : undefined}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "size"> & { ref?: Ref<HTMLInputElement> };

/** Campo de texto base: 52 px (48 dentro de un `Field size="compact"`), letra de 18 px. */
export function TextInput(props: InputProps) {
  return <input {...props} />;
}

export function TextArea(props: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea {...props} />;
}

export function Select(props: Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & { ref?: Ref<HTMLSelectElement> }) {
  return <select {...props} />;
}

/** 56 px con la cifra a 24 (publicar y editar), 52 (Filtros) y 44 compacto (panel del calendario). */
export type AffixSize = "lg" | "md" | "sm";

/** Campo con un signo delante («₡», «$»). El signo no se lee; tocarlo enfoca el campo. */
export function AffixInput({ prefix, size, ...input }: InputProps & { prefix: string; size: AffixSize }) {
  return (
    <label className={`affix affix-${size}`} data-invalid={input["aria-invalid"] ? "true" : undefined}>
      <span className="affix-sign" aria-hidden="true">
        {prefix}
      </span>
      <input {...input} className="bare-input" />
    </label>
  );
}

/** `field`: buscador de una lista (admin); `combobox`: con sugerencias debajo (¿Dónde?, «Otra…»); `float`: sobre el mapa. */
export type SearchVariant = "field" | "combobox" | "float";

export function SearchInput({ variant, after, ...input }: InputProps & { variant: SearchVariant; after?: ReactNode }) {
  return (
    <div className={`search-input search-input-${variant}`}>
      <I.search size={20} />
      <input {...input} className="bare-input" />
      {after}
    </div>
  );
}

/** Casilla con su texto; la fila mide 44 px. */
export function Checkbox({ children, ...input }: Omit<InputProps, "type"> & { children: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" {...input} />
      {children}
    </label>
  );
}

/** Barra fija de pie con su espaciador (`normal`: 76 px; `review`: la columna de dos botones del admin; `none`: el
 *  formulario ya deja el sitio, como el asistente). */
export function StickyActions({ spacer = "normal", layout, children }: { spacer?: "normal" | "review" | "none"; layout?: "column"; children: ReactNode }) {
  return (
    <>
      {spacer === "none" ? null : <div className={spacer === "review" ? "sticky-spacer review-spacer" : "sticky-spacer"} aria-hidden="true" />}
      <div className={layout === "column" ? "sticky-actions review-actions" : "sticky-actions"}>{children}</div>
    </>
  );
}
