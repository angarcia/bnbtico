// Punto único de acceso a la autenticación desde el servidor (páginas y acciones).
import "server-only";
import { cookies } from "next/headers";
import { createDemoAuth } from "./demo";
import { sessionSecret } from "./secret";
import { createSupabaseAuth } from "./supabase";
import { supabaseEnv } from "./supabase-env";
import type { AuthProvider, CookieJar } from "./types";

async function jar(): Promise<CookieJar & { all(): { name: string; value: string }[] }> {
  const store = await cookies();
  const base = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  return {
    get: (name) => store.get(name)?.value ?? null,
    set: (name, value, options) => {
      try {
        store.set(name, value, { ...base, maxAge: options?.maxAge });
      } catch {
        /* lectura en un Server Component: no se puede escribir, se ignora */
      }
    },
    delete: (name) => {
      try {
        store.delete(name);
      } catch {
        /* idem */
      }
    },
    all: () => store.getAll().map((c) => ({ name: c.name, value: c.value })),
  };
}

export async function auth(): Promise<AuthProvider> {
  const j = await jar();
  const env = supabaseEnv();
  if (env) return createSupabaseAuth(j, { ...env, secret: sessionSecret() });
  return createDemoAuth(j, sessionSecret());
}

export type { Account, Role } from "./types";
