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

// ---------- Con días ocupados: el calendario de la ficha y el de la hoja de contacto (ronda de Ana 2 nov, ticket 08) ----------

/** El aviso de un rango con alguna noche ocupada. */
export const RANGE_BUSY_MESSAGE = "Hay noches ocupadas entre esas fechas.";

/** ¿Está ocupado ese día? Un día ocupado es su noche: la que empieza ese día. */
export type BusyDay = (day: string) => boolean;

/** ¿Se puede tocar ese día? Un ocupado no vale de llegada; con la llegada elegida, uno posterior sí (la salida puede caer en
 *  el primer día ocupado: su noche no se duerme). */
export function canTapDay(s: RangeState, day: string, busy: BusyDay): boolean {
  if (!busy(day)) return true;
  return !!s.arrival && !s.departure && day > s.arrival;
}

/** Un toque con días ocupados: como `tapRange`, salvo que un rango con alguna noche ocupada no vale (`rejected`; la llegada
 *  se queda) y un día que no se puede tocar no cambia nada. */
export function tapRangeFree(s: RangeState, day: string, busy: BusyDay): { state: RangeState; rejected: boolean } {
  if (!canTapDay(s, day, busy)) return { state: s, rejected: false };
  if (s.arrival && !s.departure && day > s.arrival) {
    for (let night = s.arrival; night < day; night = addDays(night, 1)) if (busy(night)) return { state: s, rejected: true };
  }
  return { state: tapRange(s, day), rejected: false };
}
