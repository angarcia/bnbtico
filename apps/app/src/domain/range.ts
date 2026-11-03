// El toque en el calendario de rango (llegada y salida). Aparte de ./search: lo usa también la hoja de contacto, que carga
// la ficha del servidor, y así la ficha no arrastra las reglas de la búsqueda (revisión UX 2026-10-29, N2).
// Módulo de dominio: sin imports de framework.

export interface RangeState { arrival: string | null; departure: string | null }

/** Un toque en un día del calendario: primero la llegada, luego la salida (posterior); un día igual o anterior a la
 *  llegada la reemplaza, y con el rango completo se empieza de nuevo. */
export function tapRange(s: RangeState, day: string): RangeState {
  if (s.arrival && !s.departure && day > s.arrival) return { arrival: s.arrival, departure: day };
  return { arrival: day, departure: null };
}
