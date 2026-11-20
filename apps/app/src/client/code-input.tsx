// Código de 6 dígitos (historia 07, paso 4): el de Ingresar (screens/cuenta-codigo.tsx) y el segundo código del admin
// (screens/admin-codigo.tsx). Seis casillas que pintan lo escrito en un solo campo casi invisible encima, con el teclado
// numérico y el autocompletado del código que llega por mensaje. El error va debajo y queda enlazado al campo.
import { Field } from "../shared/field";

export function CodeInput({ id, value, onChange, error }: { id: string; value: string; onChange(code: string): void; error: string | null }) {
  return (
    <Field id={id} label="Código de 6 dígitos" error={error}>
      {(control) => (
        <div className="code-field">
          <div className="code-boxes" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={i < value.length ? "filled" : i === value.length ? "active" : ""}>
                {value[i] ?? ""}
              </span>
            ))}
          </div>
          <input
            {...control}
            className="bare-input code-input"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            autoFocus
            value={value}
            onChange={(e) => onChange(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
      )}
    </Field>
  );
}
