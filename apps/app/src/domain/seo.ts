// Datos SEO comunes. El dominio real es 3bstays.com; pruebas y local no se indexan.
export const SITE_URL = "https://3bstays.com";
export const SITE_NAME = "3bstays";
export const SITE_TITLE = "3bstays · Casas y alojamientos en alquiler en el Caribe de Costa Rica";
export const SITE_DESCRIPTION = "Una nueva forma de descubrir y alquilar alojamientos en Costa Rica. Más cerca de lo local.";

export type Environment = "local" | "pruebas" | "production";

/** Solo producción se indexa y anuncia el sitemap. */
export function robotsTxt(environment: Environment): string {
  if (environment !== "production") return "User-agent: *\nDisallow: /\n";
  return `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

/** Origen de los enlaces para compartir: 3bstays.com en producción; en pruebas y local, el origen que sirve la página. */
export function shareBase(environment: Environment, origin: string | null): string {
  return environment === "production" || !origin ? SITE_URL : origin.replace(/\/$/, "");
}

/**
 * Producción antes del lanzamiento: 3bstays.com sirve solo la portada (con robots y sitemap). Se levanta con la variable
 * LAUNCHED="true" del entorno `production` en wrangler.jsonc (ver docs/corte-fase-r.md). Pruebas y local, siempre la app.
 */
export function landingOnly(env: { ENVIRONMENT: Environment; LAUNCHED?: string }): boolean {
  return env.ENVIRONMENT === "production" && env.LAUNCHED !== "true";
}
