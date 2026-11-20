// Pila de superficies modales (historia 07, paso 3): hojas, ventanas y pantallas completas comparten un solo estado de la
// página. Sin React, para poder probarla sola y para que la ficha del servidor la use igual que la SPA.
// - Mientras haya alguna abierta: `html.sheet-open` (sin scroll de fondo) y `#root` inerte; las de debajo de la de arriba,
//   también inertes. Todo se quita solo cuando la pila queda vacía.
// - Escape y la trampa de Tab actúan solo sobre la de arriba (un único oyente en `document`; si alguien dentro ya atendió la
//   tecla con preventDefault, no se hace nada).
// - Al cerrarse, el foco vuelve a quien la abrió después de quitar `inert` (en una microtarea, cuando la pila ya se asentó:
//   si se cierran dos a la vez, al que abrió la de más abajo). Solo si el foco se quedó sin dueño (en `body`): si la pantalla
//   ya enfocó otra cosa, se respeta.
// - Atrás (D9): las que lo piden añaden una entrada al historial (`3bstaysCapa`: cuántas hay abiertas). Atrás pide cerrar
//   la de arriba; si no se puede cerrar (ocupada, o pregunta «¿Descartar los cambios?»), la entrada se repone. Al cerrarse por
//   otra vía, la entrada se quita con history.back() si sigue arriba (si la app ya navegó, se deja).
export type CloseReason = "escape" | "backdrop" | "button" | "back";

export interface OverlayEntry {
  readonly el: HTMLElement;
  /** Pide cerrar; devuelve false si no se cierra (ocupada, no se cierra así, o pregunta antes). */
  request(reason: CloseReason): boolean;
  /** Añade una entrada al historial (Atrás la cierra). */
  readonly back: boolean;
  /** A quién devolver el foco al cerrar (por defecto, quien la abrió). */
  restore?(opener: HTMLElement | null): HTMLElement | null;
}

interface Open extends OverlayEntry {
  opener: HTMLElement | null;
  depth: number;
}

const KEY = "3bstaysCapa";
export const FOCUSABLE =
  'a[href],button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

const stack: Open[] = [];
let released: { entry: Open; index: number }[] = [];
let leaving = false;

const depthOf = (state: unknown): number => {
  const value = state && typeof state === "object" ? (state as Record<string, unknown>)[KEY] : undefined;
  return typeof value === "number" ? value : 0;
};
const historyDepth = () => stack.filter((e) => e.back).length;
// Con el `pushState` del prototipo: el router (TanStack) envuelve el de `window.history` y, al enterarse, volvía a cargar la
// ruta y subía la página al principio debajo de la hoja.
const pushEntry = (depth: number) => History.prototype.pushState.call(history, { ...(history.state ?? {}), [KEY]: depth }, "");

/** Abiertas ahora (para pruebas y para la capa del aviso). */
export const openOverlays = () => stack.length;

/** La página se va (p. ej. `location.assign` a WhatsApp): no se toca más el historial hasta volver. */
export function leavingPage() {
  leaving = true;
}

function sync() {
  const open = stack.length > 0;
  document.documentElement.classList.toggle("sheet-open", open);
  const root = document.getElementById("root");
  if (root) root.inert = open;
  stack.forEach((e, i) => (e.el.inert = i < stack.length - 1));
}

const usable = (el: HTMLElement | null): el is HTMLElement => !!el && el.isConnected && !el.matches(":disabled") && !el.closest("[inert]");

function restoreFocus() {
  const batch = released;
  released = [];
  const first = batch.sort((a, b) => a.index - b.index)[0];
  // Si queda alguna abierta por encima de donde estaba (se abrió otra entretanto), el foco es suyo.
  if (!first || stack.length > first.index) return;
  const bottom = first.entry;
  const active = document.activeElement;
  if (active && active !== document.body && active.isConnected) return;
  let to = bottom.restore ? bottom.restore(bottom.opener) : bottom.opener;
  if (!usable(to)) {
    to = document.querySelector<HTMLElement>("main h1");
    if (to && !to.hasAttribute("tabindex")) to.tabIndex = -1;
  }
  to?.focus({ preventScroll: true });
}

function focusables(el: HTMLElement) {
  return [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.tabIndex >= 0 && item.getClientRects().length > 0 && !item.closest("[inert]"));
}

function onKeyDown(e: KeyboardEvent) {
  const top = stack[stack.length - 1];
  if (!top || e.defaultPrevented) return;
  if (e.key === "Escape") {
    e.preventDefault();
    top.request("escape");
    return;
  }
  if (e.key !== "Tab") return;
  const items = focusables(top.el);
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!first || !last) {
    e.preventDefault();
    top.el.focus();
  } else if (!(active instanceof Node) || !top.el.contains(active)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && (active === first || active === top.el)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function onPopState(e: PopStateEvent) {
  const wanted = historyDepth();
  if (depthOf(e.state) >= wanted) return;
  const top = stack[stack.length - 1];
  if (top && !top.request("back")) {
    for (let d = depthOf(history.state) + 1; d <= historyDepth(); d++) pushEntry(d);
  }
}

function onPageShow() {
  leaving = false;
}

/** Abre una superficie; devuelve la función que la quita de la pila (al desmontarla). */
export function openOverlay(entry: OverlayEntry): () => void {
  if (!stack.length) {
    document.addEventListener("keydown", onKeyDown);
    addEventListener("popstate", onPopState);
    addEventListener("pageshow", onPageShow);
  }
  const active = document.activeElement;
  const open: Open = { ...entry, opener: active instanceof HTMLElement && active !== document.body ? active : null, depth: 0 };
  stack.push(open);
  if (entry.back && !leaving) {
    open.depth = historyDepth();
    if (depthOf(history.state) < open.depth) pushEntry(open.depth);
  }
  sync();
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    const index = stack.indexOf(open);
    if (index >= 0) stack.splice(index, 1);
    sync();
    if (!stack.length) {
      document.removeEventListener("keydown", onKeyDown);
      removeEventListener("popstate", onPopState);
      removeEventListener("pageshow", onPageShow);
    }
    if (!released.length) queueMicrotask(restoreFocus);
    released.push({ entry: open, index });
    if (open.depth) reconcileHistory();
  };
}

/** Quita las entradas del historial de las que ya se cerraron, si siguen arriba (si la app navegó entretanto, se dejan). En una
 *  microtarea: después de todas las que se cierran a la vez y de la navegación que el mismo toque hizo con el router. */
let reconciling = false;
function reconcileHistory() {
  if (reconciling) return;
  reconciling = true;
  queueMicrotask(() => {
    reconciling = false;
    const extra = depthOf(history.state) - historyDepth();
    if (!leaving && extra > 0) history.go(-extra);
  });
}
