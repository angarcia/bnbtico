// Hueco que tapa el teclado del móvil. En Android (interactive-widget=resizes-content) la página encoge con el teclado y
// no hace falta nada. En iOS la página no cambia: solo la ventana visible (visualViewport) se hace más baja. Ese hueco se
// añade como relleno al pie del formulario para que el campo enfocado se pueda desplazar por encima del teclado.
const MIN_KEYBOARD = 100; // por debajo de esto son las barras del navegador al aparecer u ocultarse, no un teclado

export function keyboardInset({ innerHeight, viewportHeight, viewportOffsetTop }: { innerHeight: number; viewportHeight: number; viewportOffsetTop: number }): number {
  const inset = Math.round(innerHeight - viewportHeight - viewportOffsetTop);
  return inset >= MIN_KEYBOARD ? inset : 0;
}

/** Desplazamiento de la ventana que deja el campo centrado en la parte visible (la que queda encima del teclado).
 *  `elementTop` es respecto al borde superior de la ventana (getBoundingClientRect). */
export function scrollTopToCenter({ scrollY, elementTop, elementHeight, viewportHeight, viewportOffsetTop }: { scrollY: number; elementTop: number; elementHeight: number; viewportHeight: number; viewportOffsetTop: number }): number {
  const target = scrollY + elementTop - viewportOffsetTop - (viewportHeight - elementHeight) / 2;
  return Math.max(0, Math.round(target));
}
