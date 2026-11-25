// Registro del service worker y aviso de versión nueva. Se descarga después de cargar la página (main.tsx).

type Listener = () => void;

/** Rutas donde nunca se recarga: el asistente de publicar (se perdería lo que se está escribiendo). */
export const isWizardPath = (pathname: string) => pathname === "/propietario/publicar" || pathname.startsWith("/propietario/publicar/") || pathname.startsWith("/publicar/nueva/");

let waiting: ServiceWorker | null = null;
const listeners = new Set<Listener>();

function setWaiting(worker: ServiceWorker | null) {
  waiting = worker;
  for (const l of listeners) l();
}

/** ¿Hay una versión nueva instalada esperando? (para useSyncExternalStore) */
export const updateWaiting = () => waiting !== null;

export function onUpdateChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Pide activar la versión que espera y recarga esta pestaña (solo la que lo pidió) cuando ya está activada del todo: con
 *  `controllerchange` recargaba dos veces (al activarse y al reclamar la pestaña) y la primera podía salir aún de la vieja. */
function activate(worker: ServiceWorker, message: "skip-waiting" | "skip-waiting-if-alone") {
  worker.addEventListener("statechange", () => {
    if (worker.state === "activated") location.reload();
  });
  worker.postMessage(message);
}

/** «Actualizar»: activa la versión nueva y recarga esta pestaña. */
export function applyUpdate() {
  if (waiting) activate(waiting, "skip-waiting");
}

export async function registerServiceWorker(): Promise<void> {
  const sw = navigator.serviceWorker;
  const reg = await sw.register("/sw.js", { scope: "/" }).catch(() => null);
  if (!reg) return;
  // Solo es «nueva» si ya había una versión controlando la página; la primera instalación no avisa.
  const watch = (worker: ServiceWorker) =>
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && sw.controller) setWaiting(worker);
    });
  // Al abrir o recargar la app con una versión nueva ya esperando (llegó en una visita anterior), se aplica sola: recargar
  // no basta para que el navegador la active y la vieja seguía días (2026-11-25). Solo si es la única pestaña (lo decide
  // el SW) y fuera del asistente; si no, el aviso de siempre.
  if (reg.waiting && sw.controller) {
    if (!isWizardPath(location.pathname)) activate(reg.waiting, "skip-waiting-if-alone");
    setWaiting(reg.waiting);
  }
  if (reg.installing) watch(reg.installing);
  reg.addEventListener("updatefound", () => reg.installing && watch(reg.installing));
  // Al volver a la app (o a la pestaña) mira si hay despliegue nuevo.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
  });
}
