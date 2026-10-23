// Cliente de supabase-js del navegador: una sola instancia con la sesión del usuario guardada detrás de un adaptador de
// almacenamiento (localStorage hoy; el llavero de Capacitor después) y refresco automático del token. Sirve las lecturas
// públicas, la cuenta y las casas del propietario. supabase-js no pone cookies.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../domain/database.types";
import { SESSION_STORAGE_KEY, type KeyValueStore, type SessionStorageAdapter } from "../storage";
import { createPostgrestAuth, type OtpChannel } from "./auth";
import { keepaliveFetch } from "./keepalive-fetch";
import { createPostgrestListings } from "./listings";
import { createPostgrestOwnerListings } from "./owner";
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

export function createBrowserData(supabaseUrl: string, anonKey: string, stores: DeviceStores, opts: { channel?: OtpChannel } = {}) {
  const db = createSessionClient(supabaseUrl, anonKey, stores.session);
  return {
    auth: createPostgrestAuth(db, { pending: stores.pending, channel: opts.channel }),
    listings: createPostgrestListings(db, { supabaseUrl }),
    owner: createPostgrestOwnerListings(db, { supabaseUrl }),
    photos: createPostgrestPhotos(db, { supabaseUrl }),
  };
}
