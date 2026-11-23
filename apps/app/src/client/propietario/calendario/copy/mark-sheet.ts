// La hoja «Marcar una reserva» (trozo diferido mark-sheet-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const title = "Marcar una reserva";
export const hint = "Marque de una vez las noches de una reserva larga como ocupadas. Elija la llegada y la salida. La noche de la salida queda libre.";
export const checking = "Comprobando disponibilidad…";
export const continueLast = "Continuar con el último calendario";
export const retry = "Intentar de nuevo";
export const pick = ({ arrival }: { arrival: boolean }) => (arrival ? "Ahora elija la salida" : "Elija la llegada");
export const submit = "Marcar como ocupado";
export const cancel = "Cancelar";
