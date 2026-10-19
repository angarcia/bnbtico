// Cliente de Supabase para datos (casas, fotos, consultas) desde páginas y acciones del servidor, con la sesión
// del usuario en cookies. RLS es la única capa de permisos: aquí nunca se usa la clave de servicio.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/auth/supabase-env";

/** `null` cuando no hay Supabase configurado (modo demo de la cuenta): las pantallas de casas avisan y no consultan. */
export async function supabaseServer(): Promise<SupabaseClient | null> {
  const env = supabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
        } catch {
          /* lectura en un Server Component: el refresco lo hace proxy.ts */
        }
      },
    },
  });
}
