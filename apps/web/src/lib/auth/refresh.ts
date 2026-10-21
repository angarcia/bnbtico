// Refresco de la sesión de Supabase en el proxy (único sitio que puede escribir cookies en cada petición).
// Sin esto, los Server Components renuevan el token pero no pueden guardarlo y la sesión se pierde al caducar (~1 h).
// 2026-10-21: se probó getClaims (verificación local con las claves ES256 del proyecto) y pruebas.bnbtico.com dejó de responder
// en todas las peticiones; se vuelve a getUser hasta reproducir ES256 en local y entender el bloqueo (ver docs/decisiones.md).
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseEnv } from "./supabase-env";

type Cookie = { name: string; value: string; options?: CookieOptions };
type ClientFactory = (url: string, key: string, options: { cookies: { getAll(): { name: string; value: string }[]; setAll(list: Cookie[]): void } }) => {
  auth: { getUser(): Promise<unknown> };
};

export async function refreshSupabaseSession(
  request: NextRequest,
  response: NextResponse,
  env: { url?: string; anonKey?: string } | null = supabaseEnv(),
  factory: ClientFactory = createServerClient as unknown as ClientFactory,
): Promise<void> {
  if (!env?.url || !env.anonKey) return;
  const client = factory(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
        }
      },
    },
  });
  await client.auth.getUser();
}
