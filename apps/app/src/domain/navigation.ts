// Reglas puras de la navegación: qué pestañas se ven, qué vista de Mis casas toca y qué aviso se muestra.
import { shortDate } from "./dates";
import type { Listing } from "./listing";
import { payButtonDue, type HouseSubscription } from "./subscription";

// La barra (tabsFor) y la regla de la zona del propietario van aparte, en ./tabs: las usa el JS inicial y así no arrastran
// las reglas de la suscripción que necesita noticeFor.
export * from "./tabs";

/** Mis casas es siempre la lista, también con una sola casa. */
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

/** Edición en curso de una casa publicada (la rellena el plan D; aquí siempre null). */
export type EditState = "unsent" | "review" | "changes" | null;
export type CardLabelClass = "state-ok" | "state-review" | "state-draft" | "state-pay" | "state-off" | "state-bad";
export interface CardLabel {
  text: string;
  cls: CardLabelClass;
}

const EDIT_LABELS: Record<Exclude<EditState, null>, CardLabel> = {
  unsent: { text: "Edición sin enviar", cls: "state-draft" },
  review: { text: "Edición en revisión", cls: "state-review" },
  changes: { text: "Cambios pedidos en la edición", cls: "state-review" },
};

const STATUS_CARD_LABELS: Record<Listing["status"], CardLabel> = {
  payment_due: { text: "Pendiente de pago", cls: "state-pay" },
  inactive: { text: "Inactiva", cls: "state-off" },
  active: { text: "Activa", cls: "state-ok" },
  review: { text: "En revisión", cls: "state-review" },
  draft: { text: "Borrador", cls: "state-draft" },
  changes: { text: "Cambios pedidos", cls: "state-review" },
  rejected: { text: "Rechazada", cls: "state-bad" },
};

/** Una sola etiqueta sobre la foto. Prioridad: pago (Pendiente de pago, Inactiva) > edición > Cerrada > estado. */
export function cardLabel(l: Pick<Listing, "status" | "available" | "reopenAt">, edit: EditState = null): CardLabel {
  if (l.status === "payment_due" || l.status === "inactive") return STATUS_CARD_LABELS[l.status];
  if (edit) return EDIT_LABELS[edit];
  if (l.status === "active" && !l.available) {
    const d = l.reopenAt ? shortDate(l.reopenAt) : null;
    return { text: d ? `Cerrada hasta el ${d}` : "Cerrada", cls: "state-off" };
  }
  return STATUS_CARD_LABELS[l.status];
}

/** Actividad vacía: ninguna casa activa y ninguna consulta. */
export function activityEmpty(listings: readonly Pick<Listing, "status">[], inquiries: number): boolean {
  return inquiries === 0 && !listings.some((l) => l.status === "active");
}
