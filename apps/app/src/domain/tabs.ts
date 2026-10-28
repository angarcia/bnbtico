// Reglas puras de la barra inferior y de la zona del propietario (parte de domain/navigation.ts, que las reexporta). En
// un módulo propio porque van en el JS inicial: sin dependencias.
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

/** La zona del propietario sin casas lleva a Explorar, pero solo con la lista leída y sin lectura en curso. */
export function ownerZoneRedirect(listingsCount: number | undefined, fetching: boolean): boolean {
  return listingsCount === 0 && !fetching;
}
