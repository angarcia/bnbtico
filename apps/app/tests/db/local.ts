// Supabase local para las pruebas de base: URL y claves salen de `supabase status` (o de variables si ya están puestas).
import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/domain/database.types";
import { totp } from "../contract/totp";

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

/** Contenedor de la base de este proyecto local (`project_id` de supabase/config.toml): otra copia del repo puede tener
 *  el suyo arrancado a la vez con otro project_id y otros puertos. */
function dbContainer(): string {
  const id = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(`${repoRoot}supabase/config.toml`, "utf8"))?.[1] ?? "bnbtico";
  return `supabase_db_${id}`;
}

/**
 * SQL directo como `postgres` en el contenedor de Supabase local (no hay psql en el equipo). Para lo que no expone la API:
 * Vault, la cola de pg_net, el secreto TOTP del segundo factor.
 */
export function sql(query: string): string {
  return execFileSync("docker", ["exec", "-i", dbContainer(), "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tAq"], {
    input: query,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

/** Como `sql`, pero sin bloquear: cada llamada es una conexión propia (para probar dos sesiones a la vez). */
export function sqlAsync(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("docker", ["exec", "-i", dbContainer(), "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tAq"], { encoding: "utf8" }, (error, stdout, stderr) =>
      error ? reject(new Error(`${error.message}\n${stderr}`)) : resolve(stdout.trim()),
    );
    child.stdin!.end(query);
  });
}

/**
 * Sube una sesión aal1 a aal2 con el factor TOTP de la cuenta, como haría la app de autenticación. Reutiliza el factor
 * verificado (su secreto se lee de auth.mfa_factors: puede haberlo inscrito otro proceso, p. ej. Playwright por la
 * interfaz) o inscribe uno.
 */
export async function stepUp(client: SupabaseClient<Database>): Promise<void> {
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  let factorId = factors.data.totp.find((f) => f.status === "verified")?.id;
  let secret = factorId ? totpSecretOf(factorId) : "";
  if (!factorId) {
    for (const f of factors.data.all) if (f.status === "unverified") await client.auth.mfa.unenroll({ factorId: f.id });
    const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "3bstays admin" });
    if (enrolled.error) throw enrolled.error;
    factorId = enrolled.data.id;
    secret = enrolled.data.totp.secret;
  }
  const verified = await client.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) });
  if (verified.error) throw verified.error;
}

/** El secreto TOTP de un factor (en local GoTrue lo guarda sin cifrar). */
export function totpSecretOf(factorId: string): string {
  return sql(`select secret from auth.mfa_factors where id = '${factorId.replace(/[^0-9a-f-]/g, "")}'`);
}

/** Sesión del admin de prueba con el segundo factor (aal2), marcado como admin con seed_admin. */
export async function signInAdmin(): Promise<SupabaseClient<Database>> {
  const client = await signIn("admin");
  await serviceClient().rpc("seed_admin", { p_phone: TEST_PHONES.admin });
  await stepUp(client);
  return client;
}
