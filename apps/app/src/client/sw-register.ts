// Registro del service worker y aviso de versión nueva. Se descarga después de cargar la página (main.tsx).

type Listener = () => void;

let waiting: ServiceWorker | null = null;
let accepted = false;
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

/** «Actualizar»: activa la versión nueva y recarga esta pestaña (solo la que lo pidió). */
export function applyUpdate() {
  if (!waiting) return;
  accepted = true;
  waiting.postMessage("skip-waiting");
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
  if (reg.waiting && sw.controller) setWaiting(reg.waiting);
  if (reg.installing) watch(reg.installing);
  reg.addEventListener("updatefound", () => reg.installing && watch(reg.installing));
  sw.addEventListener("controllerchange", () => {
    if (accepted) location.reload();
  });
  // Al volver a la app (o a la pestaña) mira si hay despliegue nuevo.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
  });
}
