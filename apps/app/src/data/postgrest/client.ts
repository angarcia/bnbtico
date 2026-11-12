// Cliente de supabase-js para lecturas sin sesión (anon key): el worker y el navegador en páginas públicas.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../domain/database.types";
import { createPostgrestListings } from "./listings";

export function createAnonListings(supabaseUrl: string, anonKey: string) {
  const db = createClient<Database>(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return createPostgrestListings(db, { supabaseUrl });
}
