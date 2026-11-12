// Qué hace el service worker con cada petición. Sin APIs del navegador: lo usan el SW, el build y las pruebas.

export type Strategy = "precache" | "shell" | "page" | "photo" | "tile" | "network";

export interface SwRequest {
  url: string;
  method: string;
  mode: string;
}

/** Datos con sesión o escrituras: nunca se cachean (además, todo lo que no es GET va a la red). */
const NEVER = ["/rest/v1/", "/auth/v1/", "/storage/v1/upload", "/functions/v1/"];
/** Rutas que responde el worker de Cloudflare: una navegación a ellas no debe recibir el shell. */
const SERVER = /^\/(robots\.txt|sitemap\.xml|_purge\/|sw\.js|_pago-falso\/)/;
const PUBLIC_PHOTO = /\/storage\/v1\/(object|render\/image)\/public\//;

export const SHELL_URL = "/";

export function strategyFor(req: SwRequest, origin: string, precached: ReadonlySet<string>): Strategy {
  if (req.method !== "GET") return "network";
  const url = new URL(req.url);
  if (NEVER.some((p) => url.pathname.includes(p))) return "network";
  if (url.origin === origin) {
    if (req.mode === "navigate") {
      // Ficha y portada: HTML del servidor, fresco (buscadores y enlaces de WhatsApp). El resto es la SPA.
      if (url.pathname === "/" || url.pathname.startsWith("/casa/")) return "page";
      if (SERVER.test(url.pathname) || /\.[a-z0-9]+$/i.test(url.pathname)) return "network";
      return "shell";
    }
    return precached.has(url.pathname) ? "precache" : "network";
  }
  if (url.hostname === "tile.openstreetmap.org") return "tile";
  if (PUBLIC_PHOTO.test(url.pathname)) return "photo";
  return "network";
}

const PRECACHE_EXT = /\.(js|css|woff2|png|ico|svg|webmanifest)$/;

/** Lista de precache a partir de los ficheros del build (con hash) y de `public/`. */
export function precacheList(bundleFiles: readonly string[], publicFiles: readonly string[]): string[] {
  // La portada estática (portada.html y portada/) no es de la app: no se precachea.
  const files = [...bundleFiles, ...publicFiles].filter((f) => PRECACHE_EXT.test(f) && !f.startsWith(".") && !f.includes("/.") && f !== "sw.js" && !f.startsWith("portada"));
  return [SHELL_URL, ...[...new Set(files)].sort().map((f) => `/${f}`)];
}
