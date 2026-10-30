import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

/** La barra de pestañas sale por abajo al desplazarse hacia delante y vuelve al desplazarse hacia atrás o arriba del todo
 *  (revisión UX C4, como Airbnb; ronda de Ana 2026-10-30: en todas las pantallas con barra). Un umbral de 8 px para que no
 *  parpadee; la animación y su ausencia con movimiento reducido, en CSS (`html.tabbar-away`). Un solo sitio (TabsFrame). */
export const TABBAR_THRESHOLD = 8;

/** Qué hace un desplazamiento: `true` esconde, `false` muestra, `null` lo deja como está (movimiento menor al umbral). */
export function tabBarAway(y: number, last: number): boolean | null {
  if (y <= 0) return false;
  if (Math.abs(y - last) < TABBAR_THRESHOLD) return null;
  return y > last;
}

/** Hasta cuándo no cuenta el desplazamiento: el que hace la pantalla al llevar el mes pedido arriba no es del dedo. */
let ignoreScrollUntil = 0;
export const ignoreTabBarScroll = (ms: number) => (ignoreScrollUntil = Math.max(ignoreScrollUntil, performance.now() + ms));
export const showTabBar = () => document.documentElement.classList.remove("tabbar-away");

export function useHidingTabBar() {
  // Cada pantalla empieza con la barra a la vista (y su desplazamiento propio): la ruta es la dependencia.
  const path = useLocation({ select: (l) => l.pathname });
  useEffect(() => {
    const root = document.documentElement;
    let last = scrollY;
    // El router restaura el desplazamiento de la pantalla al pintarla: eso tampoco es del dedo. Hasta dos fotogramas
    // después de montar (no un tiempo fijo: en un teléfono lento un gesto de verdad caería dentro).
    let settling = true;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => (settling = false)));
    const onScroll = () => {
      // Con el mapa o una hoja abiertos la página no es la que se desplaza: ni se toca la barra.
      const skip = settling || performance.now() < ignoreScrollUntil || root.matches(".map-open,.sheet-open");
      const away = skip ? null : tabBarAway(scrollY, last);
      if (away !== null) root.classList.toggle("tabbar-away", away);
      if (skip || away !== null) last = scrollY;
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      showTabBar();
    };
  }, [path]);
}
