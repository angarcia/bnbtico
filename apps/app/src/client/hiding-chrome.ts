import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { watchChromeScroll } from "../shared/chrome-scroll";

// El escondido común vive en shared/chrome-scroll.ts (sin router: la ficha del servidor también lo usa, tarjetas flotantes,
// tanda 2); aquí, el de las pestañas, un solo sitio (TabsFrame).
export { CHROME_THRESHOLD, chromeAway, ignoreChromeScroll, showChrome } from "../shared/chrome-scroll";

export function useHidingChrome() {
  // Cada pantalla empieza con todo a la vista (y su desplazamiento propio): la ruta es la dependencia.
  const path = useLocation({ select: (l) => l.pathname });
  useEffect(() => watchChromeScroll(), [path]);
}
