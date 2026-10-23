// Transiciones entre pantallas con View Transitions. Solo Explorar ↔ ficha: la foto de la tarjeta se convierte en la del
// hero y vuelve. El resto de navegaciones (pestañas, filtros, flujos) son instantáneas: se repiten mucho.
// El router (defaultViewTransition) pregunta en cada navegación; sin tipos de transición (navegadores viejos) no se pide
// ninguna, porque el router haría entonces un fundido de toda la página en cada cambio de ruta.

const PHOTO = "listing-photo";
const isListing = (path: string) => path.startsWith("/casa/");

type Loc = { pathname: string };
interface LocationChange {
  fromLocation?: Loc;
  toLocation: Loc;
}
export type TransitionType = "listing-open" | "listing-close";

export function transitionTypes({ fromLocation, toLocation }: LocationChange, reducedMotion: boolean): TransitionType[] | false {
  if (!fromLocation || reducedMotion) return false;
  if (fromLocation.pathname === "/explorar" && isListing(toLocation.pathname)) return ["listing-open"];
  if (isListing(fromLocation.pathname) && toLocation.pathname === "/explorar") return ["listing-close"];
  return false;
}

// El nombre compartido va solo en la foto de una tarjeta (los nombres deben ser únicos en la página). Se pone por CSSOM
// (element.style), que la CSP permite; nunca como atributo style en el HTML.
function nameCard(href: string) {
  document.querySelectorAll<HTMLElement>(".listing-card .photo").forEach((el) => (el.style.viewTransitionName = ""));
  for (const card of document.querySelectorAll<HTMLAnchorElement>("a.listing-card")) {
    if (card.getAttribute("href") !== href) continue;
    const photo = card.querySelector<HTMLElement>(".photo");
    if (photo) photo.style.viewTransitionName = PHOTO;
    return;
  }
}

// Ficha de la que se está volviendo: su tarjeta aún no existe cuando el router pide la transición. Vale solo para esa
// vuelta: se olvida al pintarla (afterRender) o en la siguiente navegación.
let closing: string | null = null;

export function viewTransitions() {
  if (typeof CSS === "undefined" || !CSS.supports?.("selector(:active-view-transition-type(a))")) return false;
  return {
    types: (change: LocationChange) => {
      closing = null;
      const types = transitionTypes(change, matchMedia("(prefers-reduced-motion: reduce)").matches);
      // Al abrir, Explorar sigue en pantalla: el estado viejo se captura justo después de esta llamada.
      if (types && types[0] === "listing-open") nameCard(change.toLocation.pathname);
      if (types && types[0] === "listing-close") closing = change.fromLocation!.pathname;
      return types;
    },
  };
}

/** Router `onRendered`: corre dentro de la actualización de la transición, con Explorar ya en el DOM y antes de capturar
 *  el estado nuevo. La tarjeta de la casa de la que se vuelve recibe la foto del hero. */
export function afterRender({ fromLocation }: { fromLocation?: Loc }) {
  if (closing && fromLocation?.pathname === closing) nameCard(closing);
  closing = null;
}

/** Dirección de entrada de una pantalla del asistente: desde la derecha al avanzar, desde la izquierda al volver. */
export function stepEnter(previous: number | null, step: number | null): "forward" | "back" | undefined {
  if (previous === null || step === null || previous === step) return undefined;
  return step > previous ? "forward" : "back";
}

/** Las tarjetas que sustituyen a los esqueletos aparecen con un fundido; en la primera carga, una tras otra. Si las casas
 *  ya estaban en la caché (pantalla visitada, nunca esperó), salen al instante. */
export function revealClass({ loading, waited, firstFilters }: { loading: boolean; waited: boolean; firstFilters: boolean }): string {
  if (loading || !waited) return "";
  return firstFilters ? " reveal stagger" : " reveal";
}
