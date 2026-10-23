// Trabajo que puede esperar a que el navegador quede libre: precargar trozos que probablemente se usen después.

/** Safari no tiene requestIdleCallback: allí se espera un poco tras el primer pintado. */
export function whenIdle(work: () => void, timeout = 3000): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(() => work(), { timeout });
  else setTimeout(work, 1500);
}
