import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

/** Las piezas flotantes que se esconden (la barra de abajo, la cabecera de Explorar, la de Favoritos, «Mapa») salen al
 *  desplazarse hacia delante y vuelven al desplazarse hacia atrás o arriba del todo (revisión UX C4, como Airbnb; tarjetas
 *  flotantes, tanda 1: un mecanismo común). Un umbral de 8 px para que no parpadee. Aquí solo se pone o quita
 *  `html.chrome-away`; cada pieza lleva `.chrome-hide` y su desplazamiento (`--away`) en CSS, que también deja a la vista la
 *  que tiene el foco y, con movimiento reducido, solo la funde. Un solo sitio (TabsFrame). */
export const CHROME_THRESHOLD = 8;

/** Qué hace un desplazamiento: `true` esconde, `false` muestra, `null` lo deja como está (movimiento menor al umbral). */
export function chromeAway(y: number, last: number): boolean | null {
  if (y <= 0) return false;
  if (Math.abs(y - last) < CHROME_THRESHOLD) return null;
  return y > last;
}

/** Hasta cuándo no cuenta el desplazamiento: el que hace la pantalla al llevar el mes pedido arriba no es del dedo. */
let ignoreScrollUntil = 0;
export const ignoreChromeScroll = (ms: number) => (ignoreScrollUntil = Math.max(ignoreScrollUntil, performance.now() + ms));
export const showChrome = () => document.documentElement.classList.remove("chrome-away");

export function useHidingChrome() {
  // Cada pantalla empieza con todo a la vista (y su desplazamiento propio): la ruta es la dependencia.
  const path = useLocation({ select: (l) => l.pathname });
  useEffect(() => {
    const root = document.documentElement;
    let last = scrollY;
    // El router restaura el desplazamiento de la pantalla al pintarla: eso tampoco es del dedo. Hasta dos fotogramas
    // después de montar (no un tiempo fijo: en un teléfono lento un gesto de verdad caería dentro).
    let settling = true;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => (settling = false)));
    const onScroll = () => {
      // Con el mapa o una hoja abiertos la página no es la que se desplaza: ni se toca.
      const skip = settling || performance.now() < ignoreScrollUntil || root.matches(".map-open,.sheet-open");
      const away = skip ? null : chromeAway(scrollY, last);
      if (away !== null) root.classList.toggle("chrome-away", away);
      if (skip || away !== null) last = scrollY;
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      showChrome();
    };
  }, [path]);
}
