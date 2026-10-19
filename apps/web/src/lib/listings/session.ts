// Guardas de sesión para las pantallas de casas: propietario con sesión y Supabase, o admin.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { auth, type Account } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export interface OwnerSession {
  db: SupabaseClient;
  account: Account;
}

/** Sin Supabase → aviso en el panel; sin sesión → crear cuenta y volver a `nextPath`. */
export async function requireOwnerSession(nextPath: string): Promise<OwnerSession> {
  const db = await supabaseServer();
  if (!db) redirect("/propietario?sin-supabase=1");
  const account = await (await auth()).current();
  if (!account) redirect(`/cuenta?next=${encodeURIComponent(nextPath)}`);
  return { db, account };
}

/** Solo perfiles con `is_admin`; para cualquier otro, la ruta no existe. */
export async function requireAdmin(): Promise<OwnerSession> {
  const db = await supabaseServer();
  if (!db) notFound();
  const account = await (await auth()).current();
  if (!account?.isAdmin) notFound();
  return { db, account };
}
