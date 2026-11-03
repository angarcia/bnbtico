// Balizas de primera parte (ticket 11): eventos y errores van al worker (POST /events, /errors) con sendBeacon, que
// sobrevive a cerrar la pestaña o a salir hacia WhatsApp. Sin cookies ni identificadores: ruta, build y, en el worker, país.
// Se puede importar desde el worker (la ficha SSR): no toca `window` hasta que se llama.
import type { BeaconKind } from "../domain/telemetry";

export const BUILD_ID = typeof __BUILD_ID__ === "undefined" ? "dev" : __BUILD_ID__;
const MAX_ERRORS_PER_PAGE = 5;

export function sendBeacon(kind: BeaconKind, payload: Record<string, unknown>, path = location.pathname): void {
  if (typeof navigator === "undefined") return;
  const body = JSON.stringify({ ...payload, path, build: BUILD_ID });
  try {
    if (navigator.sendBeacon?.(`/${kind}`, new Blob([body], { type: "text/plain" }))) return;
  } catch {
    // sendBeacon puede lanzar con cuerpos raros: se intenta con fetch.
  }
  void fetch(`/${kind}`, { method: "POST", body, keepalive: true }).catch(() => undefined);
}

export type EventName = "page_view" | "listing_view" | "whatsapp_tap" | "inquiry_created" | "wizard_step" | "search_help_tap" | "monthly_filter_tap" | "search_submit" | "explore_map_open" | "map_marker_tap" | "publish_verify";

export function track(name: EventName, listing?: string): void {
  if (typeof window === "undefined") return;
  sendBeacon("events", listing ? { name, listing } : { name });
}

/** «Buscar» en la búsqueda de Explorar: solo qué se indicó (zona, fechas, personas), nunca los valores. */
export function trackSearch(flags: { zona: boolean; fechas: boolean; personas: boolean }): void {
  if (typeof window === "undefined") return;
  const names = (["zona", "fechas", "personas"] as const).filter((k) => flags[k]);
  sendBeacon("events", names.length ? { name: "search_submit", flags: names } : { name: "search_submit" });
}

let sent = 0;
const report = (payload: Record<string, unknown>) => {
  if (sent++ >= MAX_ERRORS_PER_PAGE) return;
  sendBeacon("errors", { ...payload, userAgent: navigator.userAgent });
};

/** Un error que la app captura (p. ej. un límite de errores de React) y que aun así debe llegar a /errors; comparte el
 * tope de cinco por carga de página con los no capturados. */
export function reportError(error: unknown): void {
  const e = error as { message?: unknown; stack?: unknown } | undefined;
  report({ kind: "error", message: typeof e?.message === "string" ? e.message : String(error), stack: typeof e?.stack === "string" ? e.stack : undefined });
}

/** Errores no capturados y promesas rechazadas sin manejar, con ruta y build; como mucho cinco por carga de página. */
export function installErrorBeacon(): void {
  addEventListener("error", (e) => {
    const error = e.error as { stack?: unknown } | undefined;
    report({
      kind: "error",
      message: String(e.message || "Error"),
      stack: typeof error?.stack === "string" ? error.stack : undefined,
      source: e.filename || undefined,
      line: e.lineno || undefined,
      col: e.colno || undefined,
    });
  });
  addEventListener("unhandledrejection", (e) => {
    const reason = e.reason as { message?: unknown; stack?: unknown } | undefined;
    report({
      kind: "rejection",
      message: typeof reason?.message === "string" ? reason.message : String(reason),
      stack: typeof reason?.stack === "string" ? reason.stack : undefined,
    });
  });
}
