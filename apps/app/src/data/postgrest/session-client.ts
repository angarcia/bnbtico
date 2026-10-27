// Cliente de supabase-js del navegador: una sola instancia con la sesión del usuario guardada detrás de un adaptador de
// almacenamiento (localStorage hoy; el llavero de Capacitor después) y refresco automático del token. Sirve las lecturas
// públicas, la cuenta y las casas del propietario. supabase-js no pone cookies.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../domain/database.types";
import { SESSION_STORAGE_KEY, type KeyValueStore, type SessionStorageAdapter } from "../storage";
import { createPostgrestAdmin } from "./admin";
import { createPostgrestAuth, type OtpChannel } from "./auth";
import { createPostgrestOwnerBilling } from "./billing";
import { createPostgrestCalendar } from "./calendar";
import { createPostgrestFavorites, createPostgrestInquiries } from "./inquiries";
import { keepaliveFetch } from "./keepalive-fetch";
import { createPostgrestListings } from "./listings";
import { createPostgrestOwnerListings, type QuickWrite } from "./owner";
import { createPostgrestPhotos } from "./photos";

export interface DeviceStores {
  session: SessionStorageAdapter;
  pending: KeyValueStore;
}

export function createSessionClient(supabaseUrl: string, anonKey: string, storage: SessionStorageAdapter) {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: { storage, storageKey: SESSION_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    // Escrituras con keepalive: un paso del asistente guardado justo antes de cerrar la app no se pierde.
    global: { fetch: keepaliveFetch() },
  });
}

/** Margen con el que un token guardado aún sirve para una escritura sin esperas. */
const QUICK_MARGIN_MS = 10_000;

/**
 * La sesión guardada, leída sin esperar: solo si el almacenamiento responde al momento (localStorage; el llavero de
 * Capacitor es asíncrono) y el token vence dentro de más de 10 s. supabase-js renueva el token por su cuenta antes de
 * que venza y lo vuelve a guardar; si ya venció (la app vuelve de un rato en segundo plano), `null` y la escritura toma
 * el camino normal, que espera a la renovación. La base sigue comprobando el token, el dueño y el estado.
 */
export function storedSession(storage: SessionStorageAdapter, now: number): { accessToken: string; userId: string } | null {
  const raw = storage.getItem(SESSION_STORAGE_KEY);
  if (typeof raw !== "string") return null;
  try {
    const s = JSON.parse(raw) as { access_token?: unknown; expires_at?: unknown; user?: { id?: unknown } };
    if (typeof s.access_token !== "string" || typeof s.expires_at !== "number" || typeof s.user?.id !== "string") return null;
    return s.expires_at * 1000 > now + QUICK_MARGIN_MS ? { accessToken: s.access_token, userId: s.user.id } : null;
  } catch {
    return null;
  }
}

/** Escrituras que no esperan a supabase-js: un segundo cliente sin sesión (el token va en la cabecera de cada petición). */
export function quickWriter(supabaseUrl: string, anonKey: string, storage: SessionStorageAdapter, now: () => number = Date.now): QuickWrite {
  let writer: SupabaseClient<Database> | null = null;
  return () => {
    const session = storedSession(storage, now());
    if (!session) return null;
    writer ??= createClient<Database>(supabaseUrl, anonKey, { accessToken: async () => null, global: { fetch: keepaliveFetch() } });
    return { db: writer, ...session };
  };
}

export function createBrowserData(supabaseUrl: string, anonKey: string, stores: DeviceStores, opts: { channel?: OtpChannel } = {}) {
  const db = createSessionClient(supabaseUrl, anonKey, stores.session);
  return {
    auth: createPostgrestAuth(db, { pending: stores.pending, channel: opts.channel }),
    listings: createPostgrestListings(db, { supabaseUrl }),
    owner: createPostgrestOwnerListings(db, { supabaseUrl, quickWrite: quickWriter(supabaseUrl, anonKey, stores.session) }),
    photos: createPostgrestPhotos(db, { supabaseUrl }),
    admin: createPostgrestAdmin(db, { supabaseUrl }),
    inquiries: createPostgrestInquiries(db),
    favorites: createPostgrestFavorites(db),
    calendar: createPostgrestCalendar(db),
    billing: createPostgrestOwnerBilling(db),
    /** El JWT de la sesión (renovado si hacía falta) para las rutas del worker que lo reenvían a PostgREST (POST /api/pago/sesion). */
    accessToken: async (): Promise<string | null> => (await db.auth.getSession()).data.session?.access_token ?? null,
  };
}
