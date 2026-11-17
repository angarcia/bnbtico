// El cursor de «Ver más casas» (issue #10): la clave de la última casa de una página en el orden de search_listings (el
// Caribe primero, las más nuevas, id). Solo lo usan los adaptadores; módulo aparte para no engordar trozos que no lo usan.
import type { PublicListing, SearchCursor } from "./listing";
import { CARIBE_PROVINCE } from "./zones";

/** El cursor que sigue a esta casa. */
export const cursorAfter = (l: Pick<PublicListing, "province" | "createdAt" | "id">): SearchCursor => ({
  caribe: l.province === CARIBE_PROVINCE,
  createdAt: l.createdAt,
  id: l.id,
});
