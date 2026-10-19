// Acceso con la clave de servicio de Supabase LOCAL, solo para preparar y leer datos en Playwright.
// La app nunca usa esta clave. Sin SUPABASE_SERVICE_ROLE_KEY las pruebas de casas se saltan.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function hasSupabase(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Borra todas las casas (y en cascada fotos, consultas…) para que cada ejecución empiece limpia. */
export async function resetListings() {
  const { error } = await serviceClient().from("listings").delete().not("id", "is", null);
  if (error) throw error;
}

/** Marca como admin el perfil de ese teléfono (E.164). Requiere que la cuenta exista. */
export async function makeAdmin(phone: string) {
  const { error } = await serviceClient().rpc("seed_admin", { p_phone: phone });
  if (error) throw error;
}

export async function publicIdOf(title: string): Promise<string> {
  const { data, error } = await serviceClient().from("listings").select("public_id").eq("title", title).order("created_at", { ascending: false }).limit(1).single();
  if (error) throw error;
  return data.public_id as string;
}
