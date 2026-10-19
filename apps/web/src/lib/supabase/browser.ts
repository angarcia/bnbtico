// Cliente de Supabase en el navegador: solo para subir fotos a Storage con la sesión del usuario.
// Las lecturas y escrituras de datos van por el servidor (src/lib/supabase/server.ts).
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase no está configurado en este entorno.");
  client = createBrowserClient(new URL(url).origin, anonKey);
  return client;
}
