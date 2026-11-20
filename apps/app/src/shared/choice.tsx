// Elecciones comunes (historia 07, paso 4; API en docs/componentes.md). Sin router ni consultas.
// - `ChoiceChips`: chips de elección con el ✓ en un hueco fijo (marcar no mueve el texto). Con `as="input"` (por defecto)
//   son casillas o radios nativos dentro de un `<label>` (formularios sin controlar, FormData); el estado lo da el input y
//   el aspecto sale de `:has(input:checked)`, con foco visible. Con `as="button"`, botones con `aria-pressed` para lo que
//   guarda su estado en la URL (Filtros, Explorar, los atajos de noches).
// - `Segmented`: dos o tres opciones de una sola elección en una pista (₡ | $, Disponible | Ocupado, No | Sí), 44 px.
import type { ReactNode } from "react";
import { I } from "./icons";

export interface ChipOption<V extends string> {
  value: V;
  /** Lo que se ve (icono y texto). */
  label: ReactNode;
  /** Nombre accesible si el texto visible es corto («Cargador EV» → «Cargador eléctrico»). */
  name?: string;
}

/** `grid`: dos columnas (características, atajos de noches); `kind`: tres columnas con el icono encima (tipo de Filtros). */
export type ChipLayout = "grid" | "kind";
/** Clases de colocación que ya existían: no cambian el aspecto del chip. */
export type ChipPlacement = "nights-quick" | "desktop-feature-filters";

const check = (on: boolean) => (
  <span className="feature-check" aria-hidden="true">
    {on ? <I.check size={14} /> : null}
  </span>
);

type Common<V extends string> = {
  options: readonly ChipOption<V>[];
  selected: readonly V[];
  onToggle(value: V): void;
  layout?: ChipLayout;
  placement?: ChipPlacement;
  /** Nombre del grupo (`role="group"`). */
  label?: string;
  /** Chips flotantes sobre el mapa (Explorar en escritorio). */
  float?: boolean;
};

export function ChoiceChips<V extends string>(
  props: Common<V> & ({ as?: "input"; type: "checkbox" | "radio"; name: string } | { as: "button" }),
) {
  const { options, selected, onToggle, layout = "grid", placement, label, float = false } = props;
  const chip = `chip${float ? " float-card" : ""}`;
  return (
    <div className={`${layout === "kind" ? "kind-filter" : "feature-choices"}${placement ? ` ${placement}` : ""}`} role={label ? "group" : undefined} aria-label={label}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        if (props.as === "button")
          return (
            <button key={o.value} type="button" className={chip} aria-label={o.name} aria-pressed={on} onClick={() => onToggle(o.value)}>
              {o.label}
              {check(on)}
            </button>
          );
        return (
          <label key={o.value} className={chip}>
            <input type={props.type} name={props.name} value={o.value} aria-label={o.name} checked={on} onChange={() => onToggle(o.value)} className="sr-input" />
            {o.label}
            {check(on)}
          </label>
        );
      })}
    </div>
  );
}

export interface SegmentOption<V extends string> {
  value: V;
  label: ReactNode;
  /** Nombre accesible si el texto visible no basta («₡» → «Colones»). */
  name?: string;
}

/** Clases de colocación y de fondo que ya existían (barra de Explorar, cabecera de escritorio, calendario, contacto). */
export type SegmentedPlacement = "calendar-local-currency" | "desktop-currency" | "contact-stay" | "bathroom-options";

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  name,
  fill = false,
  float = false,
  currency = false,
  placement,
}: {
  options: readonly SegmentOption<V>[];
  /** La elegida; `null`: ninguna (p. ej. días con disponibilidad distinta). */
  value: V | null;
  onChange(value: V): void;
  /** Nombre del grupo; o `labelledBy`, el `id` de una etiqueta visible. */
  label?: string;
  labelledBy?: string;
  /** En un formulario sin controlar: el valor va en un campo oculto con este nombre. */
  name?: string;
  /** A todo el ancho, con las opciones repartidas. */
  fill?: boolean;
  /** Tarjeta flotante sobre el mapa (barra de Explorar en el teléfono). */
  float?: boolean;
  /** El selector de moneda (`currency-switch`: sus medidas en la barra de Explorar y en la de escritorio). */
  currency?: boolean;
  placement?: SegmentedPlacement;
}) {
  return (
    <div className={`seg${fill ? " seg-fill" : ""}${currency ? " currency-switch" : ""}${float ? " float-card" : ""}${placement ? ` ${placement}` : ""}`} role="group" aria-label={label} aria-labelledby={labelledBy}>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} aria-label={o.name} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
