// Proveedor real: Supabase Auth con código por WhatsApp (Twilio Verify, canal whatsapp) y perfil en `profiles`.
// El perfil lo crea un trigger en auth.users (ver supabase/migrations/0001_init.sql) con el nombre que mandamos como metadato.
// Se activa cuando existen NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. Pendiente de probar con el proyecto real.
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSigned, sign } from "@/lib/signed";
import { cooldownError } from "./cooldown";
import type { Account, AuthProvider, CookieJar, Pending, Result, StartInput } from "./types";

const PENDING = "bnbtico_pending";

export function createSupabaseAuth(
  jar: CookieJar & { all(): { name: string; value: string }[] },
  env: { url: string; anonKey: string; secret: string },
  deps: { client?: SupabaseClient; now?: () => number } = {},
): AuthProvider {
  const now = deps.now ?? Date.now;
  const supabase =
    deps.client ??
    createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll: () => jar.all(),
        setAll: (list) => list.forEach(({ name, value, options }) => jar.set(name, value, { maxAge: options?.maxAge })),
      },
    });
  const readPending = () => readSigned<Pending>(jar.get(PENDING), env.secret);
  const writePending = async (p: Omit<Pending, "sentAt">) => jar.set(PENDING, await sign({ ...p, sentAt: now() } satisfies Pending, env.secret), { maxAge: 600 });

  async function sendCode(p: Omit<Pending, "sentAt">): Promise<Result> {
    const { error } = await supabase.auth.signInWithOtp({
      phone: p.phone,
      options: { channel: "whatsapp", shouldCreateUser: p.mode === "register", data: p.mode === "register" ? { full_name: p.name } : undefined },
    });
    if (error) {
      if (p.mode === "login" && /signups not allowed/i.test(error.message)) return { ok: false, error: "No hay una cuenta con ese WhatsApp. Cree una cuenta." };
      const seconds = /after (\d+) seconds/i.exec(error.message)?.[1];
      if (seconds || error.code === "over_sms_send_rate_limit") return { ok: false, error: `Espere ${seconds ?? 60} segundos antes de pedir otro código.` };
      return { ok: false, error: "No pudimos enviar el código. Revise el número e intente de nuevo." };
    }
    await writePending(p);
    return { ok: true };
  }

  async function profileFor(userId: string, phone: string): Promise<Account | null> {
    const { data } = await supabase.from("profiles").select("full_name, phone, phone_verified_at, is_owner, is_admin, email, description").eq("id", userId).maybeSingle();
    if (!data) return null;
    return {
      id: userId,
      name: data.full_name,
      phone: data.phone ?? phone,
      phoneVerified: !!data.phone_verified_at,
      isOwner: !!data.is_owner,
      isAdmin: !!data.is_admin,
      email: data.email ?? undefined,
      description: data.description ?? undefined,
    };
  }

  return {
    demo: false,
    async start(input: StartInput): Promise<Result> {
      const previous = await readPending();
      const wait = previous?.phone === input.phone ? cooldownError(previous.sentAt, now()) : null;
      if (wait) return { ok: false, error: wait };
      return sendCode({ mode: input.mode, phone: input.phone, name: input.mode === "register" ? input.name.trim() : undefined });
    },
    pending: readPending,
    async resend() {
      const p = await readPending();
      if (!p) return { ok: false, error: "No hay ningún número pendiente." };
      const wait = cooldownError(p.sentAt, now());
      if (wait) return { ok: false, error: wait };
      return sendCode({ mode: p.mode, phone: p.phone, name: p.name });
    },
    async cancel() {
      jar.delete(PENDING);
    },
    async verify(code: string): Promise<Result> {
      const p = await readPending();
      if (!p) return { ok: false, error: "No hay ningún código pendiente. Vuelva a empezar." };
      const { data, error } = await supabase.auth.verifyOtp({ phone: p.phone, token: code.trim(), type: "sms" });
      if (error || !data.user) return { ok: false, error: "Ese código no es correcto o caducó." };
      const profile = await profileFor(data.user.id, p.phone);
      if (!profile) {
        await supabase.auth.signOut();
        return { ok: false, error: "No pudimos crear su perfil. Escríbale a bnbtico por WhatsApp." };
      }
      jar.delete(PENDING);
      return { ok: true };
    },
    async current() {
      // getUser (una llamada a Supabase). getClaims sin red queda pendiente: en pruebas bloqueó el proxy (2026-10-21).
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      return profileFor(data.user.id, data.user.phone ? "+" + data.user.phone : "");
    },
    async updateProfile(patch): Promise<Result> {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return { ok: false, error: "No hay sesión." };
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.full_name = patch.name.trim();
      if (patch.email !== undefined) row.email = patch.email || null;
      if (patch.description !== undefined) row.description = patch.description || null;
      if (patch.isOwner !== undefined) row.is_owner = patch.isOwner;
      const { error } = await supabase.from("profiles").update(row).eq("id", data.user.id);
      return error ? { ok: false, error: "No pudimos guardar los cambios." } : { ok: true };
    },
    async logout() {
      await supabase.auth.signOut();
      jar.delete(PENDING);
    },
  };
}
