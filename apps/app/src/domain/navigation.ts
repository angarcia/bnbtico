// Reglas puras de la navegación: qué pestañas se ven, qué vista de Mis casas toca y qué aviso se muestra.
import { shortDate } from "./dates";
import type { ListingEdit } from "./edit";
import { editStatusLabel, holdLabel, statusLabel, type StatusLabel } from "./status-label";
import type { Listing } from "./listing";
import { payButtonDue, type HouseSubscription } from "./subscription";

// La barra (tabsFor) y la regla de la zona del propietario van aparte, en ./tabs: las usa el JS inicial y así no arrastran
// las reglas de la suscripción que necesita noticeFor.
export * from "./tabs";

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

/** La pestaña de las casas: con una sola (borrador incluido), su gestión directamente; con dos o más, la lista (revisión de
 *  la app 2026-11-17, historia 01; antes era siempre la lista). */
export function casasView(listingsCount: number): "list" | "detail" | "none" {
  return listingsCount <= 0 ? "none" : listingsCount === 1 ? "detail" : "list";
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

/** Una sola etiqueta sobre la foto. Prioridad: 3bstays (Pausada, Bloqueada) > pago (Pendiente de pago, Inactiva) > edición > Pausada (por el anfitrión, «Pausar la casa») > estado. */
export function cardLabel(l: Pick<Listing, "status" | "available" | "reopenAt"> & { adminHold?: Listing["adminHold"] }, edit: Pick<ListingEdit, "status"> | null = null): StatusLabel {
  if (l.adminHold) return holdLabel(l.adminHold.kind, "photo");
  if (l.status === "payment_due" || l.status === "inactive") return statusLabel(l.status);
  if (edit) return editStatusLabel(edit.status, "card");
  if (l.status === "active" && !l.available) {
    const d = l.reopenAt ? shortDate(l.reopenAt) : null;
    return { text: d ? `Pausada hasta el ${d}` : "Pausada", tone: "off" };
  }
  return statusLabel(l.status);
}
