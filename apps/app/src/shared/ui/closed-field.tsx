// El campo cerrado que abre algo (historia 07, paso 5; diseño v1, 27 y 45): la búsqueda plegada, el selector de casa o de zona
// y las fechas de la hoja de contacto. Sin estado ni router.
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { I } from "./icons";

type ClosedFieldProps = {
  /** `search`: una sección de la búsqueda plegada (¿Dónde?, ¿Cuándo?); `picker`: el selector de casa o de zona; `date`: una
   *  fecha de la hoja de contacto. */
  kind: "search" | "picker" | "date";
  label?: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  /** Solo `search`: la sección abierta; el mismo botón pasa a ser su título (conserva el foco). */
  open?: boolean;
  /** Solo `date`: sin fecha elegida, en gris. */
  empty?: boolean;
  ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "value">;

/** Un campo cerrado que abre algo (diseño v1: los tres con el mismo borde y radio). */
export function ClosedField({ kind, label, value, icon, open = false, empty = false, type = "button", ...rest }: ClosedFieldProps) {
  if (kind === "picker")
    return (
      <button {...rest} type={type} className="picker-pill">
        {icon}
        <span className="picker-name">{value}</span>
        <span className="picker-arrow"><I.chevronDown size={18} /></span>
      </button>
    );
  if (kind === "date")
    return (
      <button {...rest} type={type} className={`date-box${empty ? " is-empty" : ""}`}>
        <span className="date-box-label">{label}</span>
        <b className="num">{value}</b>
      </button>
    );
  return (
    <button {...rest} type={type} className={open ? "search-card-title" : "search-fold"}>
      <span>{label}</span>
      {open ? null : <><b className="num">{value}</b><I.chevronDown size={18} /></>}
    </button>
  );
}
