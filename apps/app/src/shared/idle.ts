// Trabajo que puede esperar a que el navegador quede libre: precargar trozos que probablemente se usen después.
import { useEffect } from "react";

/** Safari no tiene requestIdleCallback: allí se espera un poco tras el primer pintado. */
export function whenIdle(work: () => void, timeout = 3000): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(() => work(), { timeout });
  else setTimeout(work, 1500);
}

/** Justo después del primer pintado (un fotograma y una tarea): para lo que se ve, como el mapa de Explorar en Safari. */
export function afterPaint(work: () => void): void {
  requestAnimationFrame(() => setTimeout(work, 0));
}

/** Precarga un trozo diferido en reposo al montar quien lo abrirá (una hoja, un panel); si falla, se volverá a pedir al
 *  abrirlo. `load` es una función de módulo (estable). */
export function usePreloadWhenIdle(load: () => Promise<unknown>): void {
  useEffect(() => {
    whenIdle(() => void load().catch(() => {}));
  }, []);
}
