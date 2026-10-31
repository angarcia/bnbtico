// Reglas puras de la navegación: qué pestañas se ven, qué vista de Mis casas toca y qué aviso se muestra.
import { HOLD_LABELS } from "./admin-hold";
import { shortDate } from "./dates";
import type { ListingEdit } from "./edit";
import { editLabel } from "./edit-label";
import type { Listing } from "./listing";
import { payButtonDue, type HouseSubscription } from "./subscription";

// La barra (tabsFor) y la regla de la zona del propietario van aparte, en ./tabs: las usa el JS inicial y así no arrastran
// las reglas de la suscripción que necesita noticeFor.
export * from "./tabs";

/** Mis casas es siempre la lista, también con una sola casa. */
/** Orden de Mis casas por lo que pide algo al propietario (revisión UX 2026-10-29, A3): primero cambios pedidos, rechazadas,
 *  pendientes de pago, paradas y borradores; luego las activas; al final las que están en revisión (no hay nada que hacer).
 *  Dentro de cada grupo, el orden de la lista (la más nueva primero). */
const ACTION_RANK: Record<Listing["status"], number> = { changes: 0, rejected: 0, payment_due: 1, inactive: 1, draft: 2, active: 3, review: 4 };
export function byPendingAction<T extends Pick<Listing, "status">>(listings: readonly T[]): T[] {
  return listings
    .map((l, i) => ({ l, i }))
    .sort((a, b) => ACTION_RANK[a.l.status] - ACTION_RANK[b.l.status] || a.i - b.i)
    .map((x) => x.l);
}

export function casasView(listingsCount: number): "list" | "none" {
  return listingsCount <= 0 ? "none" : "list";
}

export type Notice = { kind: "payment"; listingId: string };

/** El único aviso de arriba es el del pago (primero la «Pendiente de pago»); borradores y cambios pedidos van en su tarjeta. */
export function noticeFor(
  listings: readonly Pick<Listing, "id" | "status">[],
  subscriptions: { today: string; houses: readonly { listingId: string; sub: HouseSubscription }[] } | null,
): Notice | null {
  if (subscriptions) {
    const ids = new Set(listings.map((l) => l.id));
    const due = subscriptions.houses.filter((h) => ids.has(h.listingId) && payButtonDue(h.sub, subscriptions.today));
    const first = due.find((h) => h.sub.status === "payment_due") ?? due[0];
    if (first) return { kind: "payment", listingId: first.listingId };
  }
  return null;
}

export type CardLabelClass = "state-ok" | "state-review" | "state-draft" | "state-pay" | "state-off" | "state-bad";
export interface CardLabel {
  text: string;
  cls: CardLabelClass;
}

const STATUS_CARD_LABELS: Record<Listing["status"], CardLabel> = {
  payment_due: { text: "Pendiente de pago", cls: "state-pay" },
  inactive: { text: "Inactiva", cls: "state-off" },
  active: { text: "Activa", cls: "state-ok" },
  review: { text: "En revisión", cls: "state-review" },
  draft: { text: "Borrador", cls: "state-draft" },
  changes: { text: "Cambios pedidos", cls: "state-review" },
  rejected: { text: "Rechazada", cls: "state-bad" },
};

/** Una sola etiqueta sobre la foto. Prioridad: bnbtico (Pausada, Bloqueada) > pago (Pendiente de pago, Inactiva) > edición > Cerrada > estado. */
export function cardLabel(l: Pick<Listing, "status" | "available" | "reopenAt"> & { adminHold?: Listing["adminHold"] }, edit: Pick<ListingEdit, "status"> | null = null): CardLabel {
  if (l.adminHold) return HOLD_LABELS[l.adminHold.kind];
  if (l.status === "payment_due" || l.status === "inactive") return STATUS_CARD_LABELS[l.status];
  const e = editLabel(edit);
  if (e) return { text: e.label, cls: e.badge };
  if (l.status === "active" && !l.available) {
    const d = l.reopenAt ? shortDate(l.reopenAt) : null;
    return { text: d ? `Cerrada hasta el ${d}` : "Cerrada", cls: "state-off" };
  }
  return STATUS_CARD_LABELS[l.status];
}
