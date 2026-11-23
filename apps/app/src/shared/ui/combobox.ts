// Combobox con lista de sugerencias (historia 07, paso 4): lo común de «¿Dónde?» de la búsqueda (client/screens/buscar.tsx)
// y del buscador de lugares del asistente (client/publish/place-search.tsx). Ids de la lista y de cada opción, la opción
// marcada con las flechas (en bucle) y los atributos ARIA del campo. Qué hace Enter, Escape o elegir lo decide cada uno.
import { useId, useState, type RefObject } from "react";

export function useCombobox({ count, open, initial, listbox }: {
  /** Cuántas sugerencias hay ahora. */
  count: number;
  /** La lista está a la vista (aria-expanded). */
  open: boolean;
  /** Marcada al empezar: la primera (0) o ninguna (−1). */
  initial: 0 | -1;
  /** Con la lista, mover las flechas la desplaza para que la marcada se vea (sin mover la página). */
  listbox?: RefObject<HTMLElement | null>;
}) {
  const listId = useId();
  const [marked, setActive] = useState<number>(initial);
  const active = count === 0 ? -1 : Math.min(marked, count - 1);
  const optionId = (i: number) => `${listId}-${i}`;

  function move(step: 1 | -1) {
    if (!count) return;
    const next = (active + step + count) % count;
    setActive(next);
    const box = listbox?.current;
    const row = box?.children[next];
    if (!box || !row) return;
    const bounds = box.getBoundingClientRect();
    const item = row.getBoundingClientRect();
    if (item.top < bounds.top) box.scrollTop += item.top - bounds.top;
    else if (item.bottom > bounds.bottom) box.scrollTop += item.bottom - bounds.bottom;
  }

  return {
    listId,
    optionId,
    active,
    setActive,
    move,
    inputProps: {
      role: "combobox" as const,
      "aria-autocomplete": "list" as const,
      "aria-expanded": open,
      "aria-controls": listId,
      "aria-activedescendant": open && active >= 0 ? optionId(active) : undefined,
    },
  };
}
