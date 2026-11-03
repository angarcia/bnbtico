// Las fechas de la estancia (llegada y salida), una sola fuente en la pestaña: `sessionStorage["bnbtico-fechas"]`, la clave
// que escribe Explorar (ticket 08 de la ronda del 2 nov). La leen y la escriben la ficha (calendario y barra de precio) y la
// hoja de contacto; el aviso en memoria hace que unas y otras se enteren al momento. Descarta lo pasado o mal formado como
// Explorar (`readSearchDates`).
// SSR: el servidor no tiene pestaña, así que `useStayDates` pinta null en el servidor y durante la hidratación y lee la clave
// después (useSyncExternalStore): el HTML de la ficha, que se cachea en el borde, no depende de las fechas.
import { useSyncExternalStore } from "react";
import { webStore, type KeyValueStore } from "../data/storage";
import { DATES_FILTER_KEY, readSearchDates, searchDatesValue, type SearchDates } from "../domain/contact-return";
import { costaRicaToday } from "../domain/dates";

export function createStayDates(getStore: () => KeyValueStore, now: () => number = Date.now) {
  const listeners = new Set<() => void>();
  let cached: { raw: string | null; today: string; value: SearchDates | null } | null = null;
  return {
    /** Las fechas guardadas, o null. El mismo objeto mientras la clave y el día no cambien. */
    read(): SearchDates | null {
      const raw = getStore().getItem(DATES_FILTER_KEY);
      const today = costaRicaToday(now());
      if (!cached || cached.raw !== raw || cached.today !== today) cached = { raw, today, value: readSearchDates(raw, today) };
      return cached.value;
    },
    /** Guarda las fechas (null = quitarlas) y avisa. */
    write(value: SearchDates | null): void {
      const raw = searchDatesValue(value && { from: value.arrival, to: value.departure });
      if (raw) getStore().setItem(DATES_FILTER_KEY, raw);
      else getStore().removeItem(DATES_FILTER_KEY);
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

let store: KeyValueStore | undefined;
export const stayDates = createStayDates(() => (store ??= webStore("session")));

/** Las fechas de la pestaña: null en el servidor y al hidratar, las guardadas después. */
export const useStayDates = (): SearchDates | null => useSyncExternalStore(stayDates.subscribe, stayDates.read, () => null);
