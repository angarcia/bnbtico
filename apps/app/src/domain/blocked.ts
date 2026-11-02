// Motivo de la página 410 de una ficha bloqueada (fase 5). Aparte de subscription.ts: lo pintan el worker y la ficha
// hidratada, y así el resto de las reglas de la suscripción no entra en el JS de la ficha ni en el inicial.
export type BlockedReason = "stopped" | "payment" | "other";

/** Motivo de la página 410 de una ficha que ya no está activa. */
export function blockedReason(reason: BlockedReason | null): string {
  switch (reason) {
    case "stopped":
      return "El anfitrión paró la suscripción de este anuncio, así que el enlace ya no muestra la ficha ni permite contactarlo desde bnbtico.";
    case "payment":
      return "Este anuncio está fuera del catálogo hasta que el anfitrión regularice su suscripción.";
    default:
      return "Este anuncio no está disponible en este momento.";
  }
}
