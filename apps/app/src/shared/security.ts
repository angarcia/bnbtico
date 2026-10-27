// Cabeceras de seguridad (condiciones aceptadas el 2026-10-21). Una sola fuente: el worker las pone en el HTML que genera
// (ficha y páginas de estado) y el build las escribe en dist/client/_headers para el shell y lo que sirve ASSETS.
// Sin importaciones: lo usa también vite.config.ts.

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
export const TILES_ORIGIN = "https://tile.openstreetmap.org";
/** Sugerencias de zonas del asistente (Photon de Komoot, ticket 22): solo `fetch` desde el shell. */
export const PHOTON_ORIGIN = "https://photon.komoot.io";

export interface CspOptions {
  /** URL del proyecto de Supabase del entorno (PostgREST, Auth y Storage salen del mismo origen). */
  supabaseUrl?: string;
  /**
   * Turnstile (pantallas de ingresar y del código) necesita su script y su iframe de challenges.cloudflare.com: es la
   * única excepción de terceros y solo va en el shell; la ficha SSR no la lleva.
   */
  turnstile: boolean;
  /** Photon (sugerencias de zona del paso 2 del asistente): solo en el shell. */
  photon?: boolean;
}

function originOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * script-src 'self' sin inline (el JSON de la ficha va en <script type="application/json">: es dato, no se ejecuta).
 * style-src 'self' sin 'unsafe-inline': no hay atributos style en el HTML (lo vigila tests/unit/architecture.test.ts);
 * Leaflet y Turnstile cambian estilos por CSSOM (element.style), que la CSP no bloquea.
 */
export function contentSecurityPolicy(o: CspOptions): string {
  const supabase = originOf(o.supabaseUrl);
  const extra = (...values: (string | null | false)[]) => values.filter((v): v is string => !!v);
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", ...extra(o.turnstile && TURNSTILE_ORIGIN)]],
    ["style-src", ["'self'"]],
    ["img-src", ["'self'", "data:", "blob:", ...extra(supabase, TILES_ORIGIN)]],
    ["font-src", ["'self'"]],
    // El service worker pide teselas y fotos con fetch: también cuenta como conexión.
    ["connect-src", ["'self'", ...extra(supabase, TILES_ORIGIN, o.photon === true && PHOTON_ORIGIN)]],
    ["frame-src", o.turnstile ? [TURNSTILE_ORIGIN] : ["'none'"]],
    ["worker-src", ["'self'"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

/** Cabeceras que acompañan a todo documento HTML. */
export function securityHeaders(o: CspOptions): Record<string, string> {
  return {
    "content-security-policy": contentSecurityPolicy(o),
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    // Geolocalización solo para «Usar mi ubicación» del asistente (mismo origen).
    "permissions-policy": "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)",
  };
}

/** Bloque de _headers (Workers Static Assets) para todo lo que sirve ASSETS, también el shell de la SPA. */
export function staticHeadersBlock(o: CspOptions): string {
  const lines = Object.entries(securityHeaders(o)).map(([k, v]) => `  ${k}: ${v}`);
  return ["# Generado en el build (src/shared/security.ts): CSP y cabeceras de seguridad del shell y los estáticos.", "/*", ...lines, ""].join("\n");
}
