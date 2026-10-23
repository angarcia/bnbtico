// Estado de la sesión para el router y las pantallas, sin supabase-js en el JS inicial. Si no hay sesión guardada en el
// dispositivo se sabe al instante («sin sesión») y supabase-js no se descarga; si la hay, el estado es «cargando» hasta
// que supabase-js la lee (y la refresca si caducó). Después lo mantiene al día `onSessionChange`.
import { useSyncExternalStore } from "react";
import type { AuthApi, MfaApi, PendingOtp, Session } from "../domain/api";
import { pendingOtpStore, SESSION_STORAGE_KEY, webStore } from "../data/storage";

export type SessionStatus = "loading" | "signed-in" | "signed-out";
export interface SessionState {
  status: SessionStatus;
  session: Session | null;
}

function storedSession(): boolean {
  try {
    return !!localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return false;
  }
}

let state: SessionState = { status: typeof window !== "undefined" && storedSession() ? "loading" : "signed-out", session: null };
const listeners = new Set<() => void>();
const signedOutHandlers = new Set<() => void>();
let api: Promise<AuthApi & MfaApi> | null = null;

function update(session: Session | null) {
  const wasIn = state.status === "signed-in";
  if (session && state.session?.userId === session.userId && state.session.aal === session.aal) return;
  if (!session && state.status === "signed-out") return;
  state = session ? { status: "signed-in", session } : { status: "signed-out", session: null };
  listeners.forEach((l) => l());
  if (wasIn && !session) signedOutHandlers.forEach((h) => h());
}

/** La cuenta (carga supabase-js la primera vez). */
export function authApi(): Promise<AuthApi & MfaApi> {
  return (api ??= import("./supabase-data").then(async (m) => {
    const a = m.authApi();
    a.onSessionChange(update);
    update(await a.session());
    return a;
  }));
}

/** Sesión actual para las guardas del router: sin sesión guardada responde sin descargar nada. */
export async function currentSession(): Promise<Session | null> {
  if (state.status === "signed-out" && !api) return null;
  await authApi();
  return state.session;
}

export function sessionState(): SessionState {
  return state;
}

/** Se llama al cerrar sesión (aquí o porque el servidor la dio por terminada): limpiar caché privada, modo cliente. */
export function onSignedOut(handler: () => void): () => void {
  signedOutHandlers.add(handler);
  return () => void signedOutHandlers.delete(handler);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const SIGNED_OUT: SessionState = { status: "signed-out", session: null };

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, sessionState, () => SIGNED_OUT);
}

/** Número pendiente de verificar (sessionStorage, diez minutos), legible sin supabase-js. */
export function pendingOtp(): PendingOtp | null {
  return pendingOtpStore(webStore("session"), Date.now).read();
}

if (state.status === "loading") void authApi();
