// El toque en el calendario de rango (llegada y salida). Aparte de ./search: lo usa también la hoja de contacto, que carga
// la ficha del servidor, y así la ficha no arrastra las reglas de la búsqueda (revisión UX 2026-10-29, N2).
// Módulo de dominio: sin imports de framework.
import { addDays } from "./dates";

export interface RangeState { arrival: string | null; departure: string | null }

/** Un toque en un día del calendario: primero la llegada, luego la salida (posterior); un día igual o anterior a la
 *  llegada la reemplaza, y con el rango completo se empieza de nuevo. */
export function tapRange(s: RangeState, day: string): RangeState {
  if (s.arrival && !s.departure && day > s.arrival) return { arrival: s.arrival, departure: day };
  return { arrival: day, departure: null };
}

// ---------- Con días ocupados (calendario de la ficha y hoja de contacto, ticket 08 de la ronda del 2 nov) ----------

/** Lo que se avisa cuando el rango pedido tiene una noche ocupada. */
export const RANGE_BUSY_MESSAGE = "Hay noches ocupadas entre esas fechas.";

/** ¿Está ocupado ese día? Un día ocupado es una noche ocupada: la que empieza ese día. */
export type BusyDay = (day: string) => boolean;

/** ¿Se puede tocar ese día ahora? Un día ocupado no sirve de llegada; con la llegada ya elegida, uno posterior sí se toca (la
 *  salida puede caer en el primer día ocupado: la noche de ese día no se duerme). */
export function canTapDay(s: RangeState, day: string, busy: BusyDay): boolean {
  if (!busy(day)) return true;
  return !!s.arrival && !s.departure && day > s.arrival;
}

/** Un toque con días ocupados: como `tapRange`, salvo que un rango con alguna noche ocupada no vale (`rejected`, y la llegada
 *  se queda) y un día que no se puede tocar no cambia nada. */
export function tapRangeFree(s: RangeState, day: string, busy: BusyDay): { state: RangeState; rejected: boolean } {
  if (!canTapDay(s, day, busy)) return { state: s, rejected: false };
  if (s.arrival && !s.departure && day > s.arrival) {
    for (let d = s.arrival; d < day; d = addDays(d, 1)) if (busy(d)) return { state: s, rejected: true };
  }
  return { state: tapRange(s, day), rejected: false };
}
