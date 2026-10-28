// Reglas puras de la navegación: qué pestañas se ven, qué vista de Mis casas toca y qué aviso se muestra.
import type { Listing } from "./listing";
import { payButtonDue, type HouseSubscription } from "./subscription";

// La barra (tabsFor) y la regla de la zona del propietario van aparte, en ./tabs: las usa el JS inicial y así no arrastran
// las reglas de la suscripción que necesita noticeFor.
export * from "./tabs";

export function casasView(listingsCount: number): "single" | "list" | "none" {
  if (listingsCount <= 0) return "none";
  return listingsCount === 1 ? "single" : "list";
}

export type Notice = { kind: "payment" | "resume"; listingId: string };

/** Un solo aviso: pago pendiente (primero la «Pendiente de pago»), si no, seguir con el borrador o la casa con cambios. */
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
  const resume = listings.find((l) => l.status === "draft" || l.status === "changes");
  return resume ? { kind: "resume", listingId: resume.id } : null;
}

/** Actividad vacía: ninguna casa activa y ninguna consulta. */
export function activityEmpty(listings: readonly Pick<Listing, "status">[], inquiries: number): boolean {
  return inquiries === 0 && !listings.some((l) => l.status === "active");
}
