// Supabase local para las pruebas de base: URL y claves salen de `supabase status` (o de variables si ya están puestas).
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/domain/database.types";

const repoRoot = new URL("../../../../", import.meta.url).pathname;

let cached: { url: string; anonKey: string; serviceKey: string } | null = null;

export function localSupabase() {
  if (cached) return cached;
  let env: Record<string, string> = {};
  if (!process.env.SUPABASE_URL) {
    const out = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    env = Object.fromEntries(out.split("\n").map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l)).filter((m) => m !== null).map((m) => [m[1]!, m[2]!]));
  }
  cached = {
    url: process.env.SUPABASE_URL ?? env.API_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY ?? env.ANON_KEY!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SERVICE_ROLE_KEY!,
  };
  return cached;
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const anonClient = (): SupabaseClient<Database> => createClient<Database>(localSupabase().url, localSupabase().anonKey, opts);
export const serviceClient = (): SupabaseClient<Database> => createClient<Database>(localSupabase().url, localSupabase().serviceKey, opts);

/** Números de prueba con código 123456 (supabase/config.toml). */
export const TEST_PHONES = { owner: "+50687770001", other: "+50688881234", admin: "+50688990001" } as const;
export const TEST_NAMES = { owner: "Yorleny Prueba", other: "Ana Prueba", admin: "Admin Prueba" } as const;

/** Sesión de un número de prueba. Supabase limita a un código por segundo y número: espera y reintenta. */
export async function signIn(who: keyof typeof TEST_PHONES): Promise<SupabaseClient<Database>> {
  const client = anonClient();
  const phone = TEST_PHONES[who];
  for (let attempt = 0; attempt < 5; attempt++) {
    const sent = await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: true, data: { full_name: TEST_NAMES[who] } } });
    if (!sent.error) break;
    if (!/only request this after/i.test(sent.error.message) || attempt === 4) throw sent.error;
    await new Promise((r) => setTimeout(r, 1200));
  }
  const verified = await client.auth.verifyOtp({ phone, token: "123456", type: "sms" });
  if (verified.error) throw verified.error;
  return client;
}
