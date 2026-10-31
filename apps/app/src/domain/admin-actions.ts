// Pausar, bloquear y eliminar una casa desde el admin (spec .scratch/admin-casas-acciones): los mensajes (iguales en la base,
// el adaptador y el fake), lo que el navegador puede comprobar antes de llamar a las RPCs y cómo se cuenta al propietario.
// Aparte de admin-hold.ts, que es lo único que necesita el JS inicial.
import type { HoldKind } from "./admin-hold";

export const HOLD_REASON_MAX = 2000;

/** Mensajes de las RPCs admin_pause/resume/block/unblock/delete_listing y de las guardas del propietario. */
export const ADMIN_HOLD_MESSAGES = {
  reasonRequired: "Escriba el motivo (hasta 2000 caracteres).",
  reasonTooLong: `El motivo puede tener como mucho ${HOLD_REASON_MAX} caracteres.`,
  notPublished: "Solo se puede pausar o bloquear una casa publicada.",
  alreadyPaused: "Esta casa ya está pausada.",
  alreadyBlocked: "Esta casa ya está bloqueada.",
  blockedFirst: "Esta casa está bloqueada: desbloquéela antes de pausarla.",
  notPaused: "Esta casa no está pausada.",
  notBlocked: "Esta casa no está bloqueada.",
  confirmCode: "Escriba el código de la casa (CT-####) para confirmar.",
  /** Lo que ve el propietario al tocar una casa bloqueada (la base lo repite en cada acción suya). */
  ownerBlocked: "Esta casa está bloqueada por bnbtico. Escríbanos por WhatsApp.",
} as const;

/** Lo que se puede rechazar sin preguntar a la base. La base recorta a 2000; aquí se avisa antes de perder texto. */
export function holdReasonRefusal(reason: string): string | null {
  const text = reason.trim();
  if (text === "") return ADMIN_HOLD_MESSAGES.reasonRequired;
  if (text.length > HOLD_REASON_MAX) return ADMIN_HOLD_MESSAGES.reasonTooLong;
  return null;
}

/** El código `CT-####` escrito tiene que ser el de la casa (sin mayúsculas ni espacios de más). */
export const deleteConfirmMatches = (publicId: string, typed: string) => typed.trim().toUpperCase() === publicId;

/** Lo que dice el propietario de su casa retenida en el detalle: el título del aviso y lo que sigue. */
export const HOLD_COPY: Record<HoldKind, { title: string; body: string }> = {
  paused: {
    title: "Pausada por bnbtico",
    body: "Su casa no aparece en Explorar y el enlace de su ficha no funciona por ahora. Puede seguir editándola; cuando todo esté en orden, la reanudamos nosotros.",
  },
  blocked: {
    title: "Bloqueada por bnbtico",
    body: "Su casa no aparece en Explorar, el enlace de su ficha no funciona y no se puede editar. Mientras esté bloqueada no se cobra su suscripción.",
  },
};

