// Adaptadores de almacenamiento del dispositivo. La sesión de Supabase va detrás de `SessionStorageAdapter` para que la
// app en tiendas (Capacitor) pueda cambiar localStorage por el llavero sin tocar el resto; el número pendiente usa el
// almacenamiento de la pestaña (sessionStorage). Sin supabase-js: lo importa también el JS inicial.
import { parsePending } from "../domain/account";
import type { PendingOtp } from "../domain/api";

/** Forma que acepta supabase-js en `auth.storage` (puede ser asíncrona, como el llavero de Capacitor). */
export interface SessionStorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface KeyValueStore extends SessionStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Clave de la sesión de Supabase en el almacenamiento. Saber si existe permite pintar sin esperar a supabase-js. */
export const SESSION_STORAGE_KEY = "bnbtico-auth";
export const PENDING_OTP_KEY = "bnbtico-otp";

/** ¿Hay una sesión guardada en el dispositivo? Se sabe al instante, sin supabase-js (puede haber caducado: eso lo dice él). */
export function hasStoredSession(): boolean {
  try {
    return !!globalThis.localStorage?.getItem(SESSION_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** localStorage o sessionStorage; si el navegador lo bloquea (modo privado antiguo), memoria para esta visita. */
export function webStore(kind: "local" | "session"): KeyValueStore {
  try {
    const s = kind === "local" ? globalThis.localStorage : globalThis.sessionStorage;
    const probe = "bnbtico-probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return {
      getItem: (k) => s.getItem(k),
      setItem: (k, v) => {
        try {
          s.setItem(k, v);
        } catch {
          /* cuota llena: se pierde solo esta escritura */
        }
      },
      removeItem: (k) => s.removeItem(k),
    };
  } catch {
    return memoryStore();
  }
}

/** Número pendiente de verificar: diez minutos desde el último envío. */
export function pendingOtpStore(store: KeyValueStore, now: () => number) {
  return {
    read: (): PendingOtp | null => parsePending(store.getItem(PENDING_OTP_KEY), now()),
    write: (p: Omit<PendingOtp, "sentAt">): void => store.setItem(PENDING_OTP_KEY, JSON.stringify({ ...p, sentAt: now() })),
    clear: (): void => store.removeItem(PENDING_OTP_KEY),
  };
}
