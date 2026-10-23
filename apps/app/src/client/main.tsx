// Entrada: un módulo pequeño que solo decide qué cargar. El CSS va aquí para que Vite lo enlace en el HTML (bloquea el
// render, sin parpadeo sobre el HTML del servidor); React y las pantallas van en trozos que se importan después.
import { installErrorBeacon, track } from "../shared/beacon";
import { SSR_DATA_ID, type SsrData } from "../shared/ssr-data";
import "../styles/global.css";

installErrorBeacon();
const landingPath = location.pathname;

const root = document.getElementById("root")!;
const embedded = document.getElementById(SSR_DATA_ID)?.textContent;

/** Tope de espera por la portada: con una red muy lenta la ficha no se queda sin hidratar. */
const HERO_WAIT_MS = 3000;

/**
 * Ejecuta `work` cuando la portada de la ficha (la foto con fetchpriority alta, que es el LCP) ya cargó o falló. En
 * Slow 4G el JS que hidrata (~88 KB gz) bajaba a la vez que la portada y se quedaba con la mitad del ancho de banda
 * (ticket 12). Los módulos corren tras analizar el documento: la imagen ya existe aquí.
 */
function afterHero(work: () => void) {
  const hero = document.querySelector<HTMLImageElement>('img[fetchpriority="high"]');
  if (!hero || hero.complete) return work();
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    work();
  };
  hero.addEventListener("load", start, { once: true });
  hero.addEventListener("error", start, { once: true });
  setTimeout(start, HERO_WAIT_MS);
}

if (embedded) {
  track("page_view");
  const data = JSON.parse(embedded) as SsrData;
  afterHero(() => void import("./hydrate-listing").then((m) => m.hydrate(root, data)));
} else {
  import("./start-shell").then((m) => m.startShell(root));
}

// Lo que no hace falta para pintar va cuando la página ya cargó: Web Vitals y, solo en el build, el service worker.
function afterLoad(work: () => void) {
  if (document.readyState === "complete") work();
  else addEventListener("load", work, { once: true });
}
afterLoad(() => void import("./vitals").then((m) => m.startVitals(landingPath)));
if (import.meta.env.PROD && "serviceWorker" in navigator) afterLoad(() => void import("./sw-register").then((m) => m.registerServiceWorker()));
