// El panel de los días elegidos (trozo diferido panel-dias-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const price = "Precio por noche";
export const mixed = "Varios precios";
export const selected = "Días seleccionados";
export const cancel = "Cancelar";
export const manual = "Bloqueo manual";
export const availability = "Disponibilidad";
export const basePrice = ({ price }: { price: string }) => `Usar el precio base (${price})`;
export const save = "Guardar cambios";
