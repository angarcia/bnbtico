// Un solo texto y un solo tono por estado (historia 07, paso 5): lo leen las etiquetas de estado (<StatusTag>, shared/
// structure.tsx) de Mis casas, el detalle, la suscripción y el admin. Solo texto y tono, sin clases CSS: el aspecto de cada
// tono lo decide el componente. Módulo de dominio: sin imports de framework.
import type { HoldKind } from "./admin-hold";
import type { EditStatus } from "./edit-label";
import type { ListingStatus } from "./listing";

/** Tonos de una etiqueta. Los de estado (ok…bad) y tres de marca que no son estados: `neutral` (arena), `new` (ocre, «Nueva»)
 *  y `admin`. `changes`: un dato con cambios pedidos (terracota en la fila de un dato; como `review` en las demás). */
export type StatusTone = "ok" | "pay" | "review" | "changes" | "draft" | "off" | "bad" | "neutral" | "new" | "admin";

export interface StatusLabel {
  text: string;
  tone: StatusTone;
}

/** Un solo texto por estado en toda la app: el propietario, la cola, la revisión y la lista «Casas» del admin (decisión de
 *  Ana del 2026-11-20: «Casas» dice «Borrador» y «Pendiente de pago», como el resto). */
export const STATUS_TEXTS: Record<ListingStatus, StatusLabel> = {
  draft: { text: "Borrador", tone: "draft" },
  review: { text: "En revisión", tone: "review" },
  changes: { text: "Cambios pedidos", tone: "review" },
  rejected: { text: "Rechazada", tone: "bad" },
  payment_due: { text: "Pendiente de pago", tone: "pay" },
  active: { text: "Activa", tone: "ok" },
  inactive: { text: "Inactiva", tone: "off" },
};

export function statusLabel(status: ListingStatus): StatusLabel {
  return STATUS_TEXTS[status];
}

/** La retención del admin. `photo`: sobre la foto, en Mis casas («Pausada por 3bstays»); `row`: en una fila (la lista
 *  «Casas» del admin y la suscripción), corta. */
const HOLD: Record<"photo" | "row", Record<HoldKind, StatusLabel>> = {
  photo: { paused: { text: "Pausada por 3bstays", tone: "review" }, blocked: { text: "Bloqueada por 3bstays", tone: "bad" } },
  row: { paused: { text: "Pausada", tone: "review" }, blocked: { text: "Bloqueada", tone: "bad" } },
};

export function holdLabel(kind: HoldKind, where: "photo" | "row"): StatusLabel {
  return HOLD[where][kind];
}

/** La edición de una casa publicada: en la tarjeta (`card`, el resumen) y en la fila de cada dato (`field`). */
const EDIT: Record<"card" | "field", Record<EditStatus, StatusLabel>> = {
  card: { review: { text: "Cambios en revisión", tone: "review" }, changes: { text: "Cambios pedidos", tone: "review" } },
  field: { review: { text: "En revisión", tone: "review" }, changes: { text: "Cambios pedidos", tone: "changes" } },
};

export function editStatusLabel(status: EditStatus, where: "card" | "field"): StatusLabel {
  return EDIT[where][status];
}
