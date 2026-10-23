// Transiciones entre pantallas con View Transitions. Solo Explorar ↔ ficha: la foto de la tarjeta se convierte en la del
// hero y vuelve. El resto de navegaciones (pestañas, filtros, flujos) son instantáneas: se repiten mucho.
// El router (defaultViewTransition) pregunta en cada navegación; sin tipos de transición (navegadores viejos) no se pide
// ninguna, porque el router haría entonces un fundido de toda la página en cada cambio de ruta.

const PHOTO = "listing-photo";
const isListing = (path: string) => path.startsWith("/casa/");

export function transitionTypes({ fromLocation, toLocation }: { fromLocation?: { pathname: string }; toLocation: { pathname: string } }): string[] | false {
  if (!fromLocation || matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (fromLocation.pathname === "/explorar" && isListing(toLocation.pathname)) return ["listing-open"];
  if (isListing(fromLocation.pathname) && toLocation.pathname === "/explorar") return ["listing-close"];
  return false;
}

export const viewTransitions = () =>
  typeof CSS !== "undefined" && CSS.supports?.("selector(:active-view-transition-type(a))") ? { types: transitionTypes } : false;

// El nombre compartido va solo en la foto de la tarjeta que se abrió (los nombres deben ser únicos en la página). Se pone
// por CSSOM (element.style), que la CSP permite; nunca como atributo style en el HTML.
let opened: string | null = null;

/** Al tocar una tarjeta: su foto pasa a ser la que se convierte en el hero de la ficha. */
export function openingCard(photo: HTMLElement | null, publicId: string) {
  document.querySelectorAll<HTMLElement>(".listing-card .photo").forEach((el) => (el.style.viewTransitionName = ""));
  if (photo) photo.style.viewTransitionName = PHOTO;
  opened = publicId;
}

/** Al volver a Explorar, la tarjeta de la casa que se abrió recupera el nombre para recibir la foto del hero. */
export const cardPhotoRef = (publicId: string) => (el: HTMLElement | null) => {
  if (el && publicId === opened) el.style.viewTransitionName = PHOTO;
};
