// Lee las variables de Supabase y normaliza la URL al origen del proyecto (`https://<ref>.supabase.co`).
// Si alguien pega la URL de REST (`…/rest/v1`) o deja una barra final, la app sigue funcionando.
export function supabaseEnv(
  env: { NEXT_PUBLIC_SUPABASE_URL?: string; NEXT_PUBLIC_SUPABASE_ANON_KEY?: string; AUTH_PROVIDER?: string } = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    AUTH_PROVIDER: process.env.AUTH_PROVIDER,
  },
): { url: string; anonKey: string } | null {
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !anonKey || env.AUTH_PROVIDER === "demo") return null;
  try {
    return { url: new URL(env.NEXT_PUBLIC_SUPABASE_URL.trim()).origin, anonKey };
  } catch {
    return null;
  }
}
