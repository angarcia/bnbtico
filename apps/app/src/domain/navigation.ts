// Reglas puras de la navegación: qué pestañas se ven, qué vista de Mis casas toca y qué aviso se muestra.
import type { Listing } from "./listing";
import { payButtonDue, type HouseSubscription } from "./subscription";

export type TabPath =
  | "/explorar"
  | "/favoritos"
  | "/propietario/casas"
  | "/propietario/calendario"
  | "/propietario/actividad"
  | "/admin"
  | "/admin/casas"
  | "/admin/usuarios"
  | "/cuenta";
export type TabIcon = "search" | "heart" | "house" | "calendar" | "chat" | "inbox" | "pin" | "users" | "user";
export interface Tab {
  to: TabPath;
  label: string;
  icon: TabIcon;
  exact: boolean;
  badge?: "inquiries" | "review";
}

/** Nunca más de cinco pestañas abajo. */
export const MAX_TABS = 5;

const CLIENT_TABS = [
  { to: "/explorar", label: "Explorar", icon: "search", exact: false },
  { to: "/favoritos", label: "Favoritos", icon: "heart", exact: false },
] as const satisfies readonly Tab[];

const OWNER_TABS = [
  ...CLIENT_TABS,
  { to: "/propietario/casas", label: "Mis casas", icon: "house", exact: false },
  { to: "/propietario/calendario", label: "Calendario", icon: "calendar", exact: false },
  { to: "/propietario/actividad", label: "Actividad", icon: "chat", exact: false, badge: "inquiries" },
] as const satisfies readonly Tab[];

const ADMIN_TABS = [
  { to: "/admin", label: "Anuncios", icon: "inbox", exact: true, badge: "review" },
  { to: "/admin/casas", label: "Casas", icon: "pin", exact: false },
  { to: "/admin/usuarios", label: "Usuarios", icon: "users", exact: false },
  { to: "/cuenta", label: "Cuenta", icon: "user", exact: false },
] as const satisfies readonly Tab[];

/** Admin → su barra; sin sesión o sin casas (o sin leer aún la lista) → cliente; con casas → propietario. */
export function tabsFor(input: { session: boolean; isAdmin: boolean; listingsCount: number | undefined }): Tab[] {
  if (input.isAdmin) return [...ADMIN_TABS];
  if (!input.session) return [...CLIENT_TABS];
  if (input.listingsCount !== undefined && input.listingsCount > 0) return [...OWNER_TABS];
  return [...CLIENT_TABS];
}

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

/** La zona del propietario sin casas lleva a Explorar, pero solo con la lista leída y sin lectura en curso. */
export function ownerZoneRedirect(listingsCount: number | undefined, fetching: boolean): boolean {
  return listingsCount === 0 && !fetching;
}

/** Actividad vacía: ninguna casa activa y ninguna consulta. */
export function activityEmpty(listings: readonly Pick<Listing, "status">[], inquiries: number): boolean {
  return inquiries === 0 && !listings.some((l) => l.status === "active");
}
