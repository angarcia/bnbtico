// Las fechas de la estancia (llegada y salida), una sola fuente en la pestaña: `sessionStorage["3bstays-fechas"]`, la clave
// que escribe Explorar con las de su búsqueda (ronda de Ana 2 nov, ticket 08). La leen y la escriben el calendario y la barra
// de la ficha y la hoja de contacto; el aviso en memoria hace que unos y otros se enteren al momento. Lo pasado o mal formado
// se descarta como siempre (`readSearchDates`).
// SSR: la ficha se pinta en el worker y se cachea en el borde, sin pestaña. `useStayDates` da null en el servidor y durante la
// hidratación, y las fechas guardadas justo después (useSyncExternalStore): el HTML no depende de ellas.
import { useSyncExternalStore } from "react";
import { webStore, type KeyValueStore } from "../data/storage";
import { DATES_FILTER_KEY, readSearchDates, searchDatesValue, type SearchDates } from "../domain/contact-return";
import { costaRicaToday } from "../domain/dates";

export function createStayDates(getStore: () => KeyValueStore, now: () => number = Date.now) {
  const listeners = new Set<() => void>();
  let last: { raw: string | null; today: string; value: SearchDates | null } | null = null;
  return {
    /** Las fechas guardadas, o null. El mismo objeto mientras no cambien la clave ni el día. */
    read(): SearchDates | null {
      const raw = getStore().getItem(DATES_FILTER_KEY);
      const today = costaRicaToday(now());
      if (!last || last.raw !== raw || last.today !== today) last = { raw, today, value: readSearchDates(raw, today) };
      return last.value;
    },
    /** Guarda las fechas (null las quita) y avisa. */
    write(dates: SearchDates | null): void {
      const raw = searchDatesValue(dates && { from: dates.arrival, to: dates.departure });
      if (raw) getStore().setItem(DATES_FILTER_KEY, raw);
      else getStore().removeItem(DATES_FILTER_KEY);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

let store: KeyValueStore | undefined;
export const stayDates = createStayDates(() => (store ??= webStore("session")));

/** Las fechas de la pestaña: null en el servidor y al hidratar; las guardadas después, y al momento cuando cambian. */
export const useStayDates = (): SearchDates | null => useSyncExternalStore(stayDates.subscribe, stayDates.read, () => null);
