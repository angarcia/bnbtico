// Sesión de un número de prueba contra Supabase local. Si otro archivo acaba de pedir código para el mismo número
// (Supabase limita a uno por segundo), espera y reintenta.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export async function signIn(url: string, anonKey: string, phone: string, name: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, opts);
  for (let attempt = 0; attempt < 5; attempt++) {
    const sent = await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: true, data: { full_name: name } } });
    if (!sent.error) break;
    if (!/only request this after/i.test(sent.error.message) || attempt === 4) throw sent.error;
    await new Promise((r) => setTimeout(r, 1200));
  }
  const verified = await client.auth.verifyOtp({ phone, token: "123456", type: "sms" });
  if (verified.error) throw verified.error;
  return client;
}
