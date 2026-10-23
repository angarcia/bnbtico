// Datos SEO comunes. El dominio real es bnbtico.com; pruebas y local no se indexan.
export const SITE_URL = "https://bnbtico.com";
export const SITE_NAME = "bnbtico";
export const SITE_TITLE = "bnbtico · Casas y alojamientos en alquiler en el Caribe de Costa Rica";
export const SITE_DESCRIPTION = "Una nueva forma de descubrir y alquilar alojamientos en Costa Rica. Más cerca de lo local.";

export type Environment = "local" | "pruebas" | "production";

/** Solo producción se indexa y anuncia el sitemap. */
export function robotsTxt(environment: Environment): string {
  if (environment !== "production") return "User-agent: *\nDisallow: /\n";
  return `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

/** Origen de los enlaces para compartir: bnbtico.com en producción; en pruebas y local, el origen que sirve la página. */
export function shareBase(environment: Environment, origin: string | null): string {
  return environment === "production" || !origin ? SITE_URL : origin.replace(/\/$/, "");
}
