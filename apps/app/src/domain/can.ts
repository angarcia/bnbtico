// Qué puede hacer el propietario con una casa según su estado. Refleja las reglas de SQL (trigger listings_protect,
// política listings_owner_delete y RPCs submit_listing y set_listing_available); la base sigue siendo quien decide.
import type { Listing, ListingStatus } from "./listing";

/** `available`: «Cerrar la casa hasta…» del Calendario; `share`: el enlace público solo funciona con la casa activa. */
export type ListingAction = "edit" | "discard" | "submit" | "reopen" | "available" | "share";

export function can(l: Pick<Listing, "status" | "reviewedAt">, action: ListingAction): boolean {
  switch (action) {
    case "edit":
    case "submit":
      return l.status === "draft" || l.status === "changes";
    case "discard":
      return l.status === "draft" && l.reviewedAt === null;
    case "reopen":
      // Una casa publicada ya no vuelve a borrador: se edita desde su ficha (editar-casa).
      return l.status === "changes" || l.status === "rejected";
    case "available":
    case "share":
      return l.status === "active";
  }
}

/** Estados de una casa publicada: los clientes la ven (o la vieron) y se cambia con la edición, no con el asistente. */
export const PUBLISHED_STATUSES: readonly ListingStatus[] = ["active", "payment_due", "inactive"];

export function isPublished(l: Pick<Listing, "status" | "firstPublishedAt">): boolean {
  return PUBLISHED_STATUSES.includes(l.status) && l.firstPublishedAt !== null;
}

/** Por qué no se puede descartar una casa (la política listings_owner_delete solo deja borrar un borrador nunca revisado,
 *  y la base no dice por qué: borra cero filas). null si se puede. */
export function discardRefusal(l: Pick<Listing, "status" | "reviewedAt"> | null): string | null {
  if (!l) return "No encontramos ese anuncio.";
  if (l.status !== "draft") return "Solo se pueden descartar borradores sin enviar.";
  if (l.reviewedAt !== null) return "Esta casa ya estuvo publicada: no se puede descartar. Puede editarla y volver a enviarla.";
  return null;
}
