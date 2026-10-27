// Modo de la interfaz (cliente, propietario o admin): estado del navegador más la sesión. Es una sola regla para la barra
// inferior y para Cuenta en todas las pantallas (B12c):
// - Sin sesión, siempre cliente.
// - Propietario: al ingresar con casa aprobada (`is_owner`), al abrir la zona /propietario o con «Publicar mi casa».
// - Admin: al abrir la zona /admin, que exige el segundo código; solo vale con la sesión en aal2 (si baja a aal1, cliente).
// - «Buscar una casa» vuelve a cliente.
import { useSyncExternalStore } from "react";
import type { Session } from "../domain/api";
import { useSession, type SessionStatus } from "./session";

export type Role = "guest" | "owner" | "admin";
export type Zone = "owner" | "admin" | null;
const KEY = "bnbtico-role";
const listeners = new Set<() => void>();

/** El modo guardado en el dispositivo (sin mirar la sesión). */
export function storedRole(): Role {
  try {
    const v = localStorage.getItem(KEY);
    return v === "owner" || v === "admin" ? v : "guest";
  } catch {
    return "guest";
  }
}

export function setRole(role: Role): void {
  if (role === storedRole()) return;
  try {
    if (role === "guest") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, role);
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** El modo que vale con esta sesión. Mientras se lee la sesión guardada, el guardado (la barra no salta al abrir). */
export function effectiveRole(stored: Role, s: { status: SessionStatus; aal: Session["aal"] | null }): Role {
  if (s.status === "signed-out") return "guest";
  if (stored === "admin" && s.status === "signed-in" && s.aal !== "aal2") return "guest";
  return stored;
}

/** La barra: las zonas mandan desde el primer pintado; fuera de ellas, el modo. */
export function barRole(zone: Zone, role: Role): Role {
  return zone ?? role;
}

export function useRole(): Role {
  const stored = useSyncExternalStore(subscribe, storedRole, () => "guest" as Role);
  const { status, session } = useSession();
  return effectiveRole(stored, { status, aal: session?.aal ?? null });
}
