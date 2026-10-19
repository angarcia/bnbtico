// Datos SEO comunes. El dominio real es bnbtico.com; pruebas y local no se indexan.
import type { MetadataRoute } from "next";
import { appEnabled } from "./stage";

export const SITE_URL = "https://bnbtico.com";
export const SITE_NAME = "bnbtico";
export const SITE_TITLE = "bnbtico · Casas y alojamientos en alquiler en el Caribe de Costa Rica";
export const SITE_DESCRIPTION = "Una nueva forma de descubrir y alquilar alojamientos en Costa Rica. Más cerca de lo local.";

/** Solo bnbtico.com (producción sin NEXT_PUBLIC_STAGE) se indexa. */
export function robotsFor(env: { NEXT_PUBLIC_STAGE?: string; NODE_ENV?: string }): MetadataRoute.Robots {
  if (appEnabled(env)) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_URL}/sitemap.xml` };
}
