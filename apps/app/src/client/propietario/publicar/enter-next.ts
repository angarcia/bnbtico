// «Siguiente» en el teclado del móvil: en un formulario con `total` campos de texto ordenados, Enter en el campo `i`
// enfoca el siguiente; en el último no hay siguiente y el formulario se envía (el teclado muestra «Listo»).

export function nextFieldIndex(total: number, i: number): number | null {
  if (i < 0 || i >= total - 1) return null;
  return i + 1;
}

export function enterKeyHintFor(total: number, i: number): "next" | "done" {
  return nextFieldIndex(total, i) === null ? "done" : "next";
}
