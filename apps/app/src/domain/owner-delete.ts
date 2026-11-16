// «Eliminar casa» del anfitrión (historia 28): en qué estados puede y con qué mensajes. Las reglas las aplica la RPC
// delete_own_listing; aquí van sus mensajes (iguales en la base, el adaptador y el fake) y lo que la pantalla necesita para
// ofrecer la acción. Fuera de can.ts para no engordar el JS inicial (can.ts va en él).
import type { Listing } from "./listing";

export const OWNER_DELETE_MESSAGES = {
  notFound: "No encontramos ese anuncio.",
  inReview: "Esta casa está en revisión. Espere nuestra respuesta o escríbanos por WhatsApp si quiere retirarla.",
  draft: "Este borrador no se elimina: descártelo con «Descartar borrador».",
  blocked: "Esta casa está bloqueada por 3bstays. Escríbanos por WhatsApp.",
} as const;

/** Por qué el anfitrión no puede eliminar una casa suya (null si puede). En revisión espera la decisión; una bloqueada no
 *  borra la evidencia; un borrador nunca revisado se descarta (borrado de verdad); una rechazada ya no la ve. */
export function deleteRefusal(l: Pick<Listing, "status" | "reviewedAt"> & { adminHold?: Listing["adminHold"] }): string | null {
  if (l.status === "rejected") return OWNER_DELETE_MESSAGES.notFound;
  if (l.adminHold?.kind === "blocked") return OWNER_DELETE_MESSAGES.blocked;
  if (l.status === "review") return OWNER_DELETE_MESSAGES.inReview;
  if (l.status === "draft" && l.reviewedAt === null) return OWNER_DELETE_MESSAGES.draft;
  return null;
}

export const canDelete = (l: Parameters<typeof deleteRefusal>[0]): boolean => deleteRefusal(l) === null;
