// El error de un campo del formulario de una casa (historia 07, paso 4): el asistente (step-form.tsx) y «Editar un dato»
// (screens/editar.tsx) lo ponen en este contexto y cada campo de fields.tsx lo pinta debajo de sí (`Field error`).
import { createContext, useContext } from "react";
import type { FieldProblem, ListingFieldName } from "../../domain/field-errors";

export const FieldErrorContext = createContext<FieldProblem | null>(null);

/** El mensaje si el error es de ese campo. */
export function useFieldError(field: ListingFieldName): string | null {
  const problem = useContext(FieldErrorContext);
  return problem?.field === field ? problem.message : null;
}
