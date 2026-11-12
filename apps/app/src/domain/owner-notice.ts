// Aviso por WhatsApp al propietario de lo que decidió el admin (revisión de una casa nueva, pausar, bloquear). 3bstays no lo
// manda solo: el admin toca «Avisar a <nombre> por WhatsApp» y se abre wa.me con este texto ya escrito, en usted.
import type { ListingStatus } from "./listing";
import { waUrl } from "./whatsapp";

export type OwnerNoticeKind = "approve" | "changes" | "reject" | "paused" | "blocked";

export interface OwnerNoticeInput {
  kind: OwnerNoticeKind;
  /** Nombre completo del propietario (se usa el primero). */
  ownerName: string;
  title: string;
  publicId: string;
  /** `location.origin`: el enlace para compartir lleva el dominio de donde está abierta la app. */
  origin: string;
  /** La nota del admin (pedir cambios, rechazar) o el motivo (pausar, bloquear). */
  note: string;
}

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? "";

/** La nota sin el punto final: el texto de alrededor ya lleva el suyo. */
const clean = (note: string) => note.trim().replace(/[.\s]+$/, "");

export function ownerNotice(i: OwnerNoticeInput): string {
  const hi = `Hola, ${firstName(i.ownerName)}. Le escribimos de 3bstays:`;
  const house = `su casa «${i.title}»`;
  switch (i.kind) {
    case "approve":
      return `${hi} ${house} ya está aprobada y publicada. Este es su enlace para compartir con sus clientes: ${i.origin.replace(/\/$/, "")}/casa/${i.publicId}. Gracias por publicar con nosotros.`;
    case "changes":
      return `${hi} revisamos ${house} y necesitamos un cambio antes de publicarla: ${clean(i.note)}. Puede corregirla desde Mis casas → «Corregir y reenviar».`;
    case "reject":
      return `${hi} revisamos ${house} y no podemos publicarla: ${clean(i.note)}. Si tiene dudas, respóndanos a este mensaje.`;
    case "paused":
      return `${hi} ${house} está pausada en 3bstays: ${clean(i.note)}. Puede seguir editándola desde Mis casas; cuando todo esté en orden, la reanudamos.`;
    case "blocked":
      return `${hi} ${house} está bloqueada en 3bstays: ${clean(i.note)}. Si tiene dudas, respóndanos a este mensaje.`;
  }
}

/** El enlace wa.me al WhatsApp del propietario (E.164) con el aviso escrito. */
export const ownerNoticeUrl = (phone: string, input: OwnerNoticeInput) => waUrl(phone, ownerNotice(input));

/** Qué aviso corresponde a una casa ya decidida (para mandarlo después, desde su detalle); null si no hay decisión que contar. */
export function decidedNoticeKind(status: ListingStatus): "approve" | "changes" | "reject" | null {
  return status === "active" || status === "payment_due" || status === "inactive" ? "approve" : status === "changes" ? "changes" : status === "rejected" ? "reject" : null;
}
