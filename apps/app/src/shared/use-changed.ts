import { useState } from "react";

/** true desde que `value` cambió por primera vez respecto al montaje. Sirve para animar un cambio de contenido (`.swap-in`,
 *  contador del hero) sin animar la primera vez que se pinta. */
export function useChanged<T>(value: T): boolean {
  const [initial] = useState(value);
  const [changed, setChanged] = useState(false);
  if (!changed && !Object.is(value, initial)) setChanged(true);
  return changed || !Object.is(value, initial);
}
