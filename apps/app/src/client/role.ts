// Modo de la interfaz (cliente o propietario): estado del navegador más la marca `is_owner` del perfil (al ingresar,
// quien ya tiene casa aprobada entra en modo propietario). Sin sesión, siempre cliente.
import { useSyncExternalStore } from "react";
import { useSession } from "./session";

export type Role = "guest" | "owner";
const KEY = "bnbtico-role";
const listeners = new Set<() => void>();

/** El modo guardado en el dispositivo (sin mirar la sesión). */
export function storedRole(): Role {
  try {
    return localStorage.getItem(KEY) === "owner" ? "owner" : "guest";
  } catch {
    return "guest";
  }
}

export function setRole(role: Role): void {
  try {
    if (role === "owner") localStorage.setItem(KEY, "owner");
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useRole(): Role {
  const stored = useSyncExternalStore(subscribe, storedRole, () => "guest" as Role);
  const { status } = useSession();
  return status !== "signed-out" && stored === "owner" ? "owner" : "guest";
}
