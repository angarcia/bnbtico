// Proveedor real: Supabase Auth con código por WhatsApp (Twilio Verify, canal whatsapp) y perfil en `profiles`.
// Se activa cuando existen NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. Pendiente de probar con el proyecto real.
import { createServerClient } from "@supabase/ssr";
import type { Account, AuthProvider, CookieJar, Pending, Result, StartInput } from "./types";
import { readSigned, sign } from "@/lib/signed";

const PENDING = "bnbtico_pending";

export function createSupabaseAuth(
  jar: CookieJar & { all(): { name: string; value: string }[] },
  env: { url: string; anonKey: string; secret: string },
): AuthProvider {
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => jar.all(),
      setAll: (list) => list.forEach(({ name, value, options }) => jar.set(name, value, { maxAge: options?.maxAge })),
    },
  });
  const readPending = () => readSigned<Pending>(jar.get(PENDING), env.secret);

  async function profileFor(userId: string, phone: string): Promise<Account | null> {
    const { data } = await supabase.from("profiles").select("full_name, phone, phone_verified_at, is_owner, email, description").eq("id", userId).maybeSingle();
    if (!data) return null;
    return {
      id: userId,
      name: data.full_name,
      phone: data.phone ?? phone,
      phoneVerified: !!data.phone_verified_at,
      isOwner: !!data.is_owner,
      email: data.email ?? undefined,
      description: data.description ?? undefined,
    };
  }

  return {
    demo: false,
    async start(input: StartInput): Promise<Result> {
      const { error } = await supabase.auth.signInWithOtp({
        phone: input.phone,
        options: { channel: "whatsapp", shouldCreateUser: input.mode === "register" },
      });
      if (error) return { ok: false, error: input.mode === "login" && /signups not allowed/i.test(error.message) ? "No hay una cuenta con ese WhatsApp. Creá una cuenta." : "No pudimos enviar el código. Revisá el número e intentá de nuevo." };
      jar.set(PENDING, await sign({ mode: input.mode, phone: input.phone, name: input.mode === "register" ? input.name.trim() : undefined } satisfies Pending, env.secret), { maxAge: 600 });
      return { ok: true };
    },
    pending: readPending,
    async resend() {
      const p = await readPending();
      if (!p) return { ok: false, error: "No hay ningún número pendiente." };
      const { error } = await supabase.auth.signInWithOtp({ phone: p.phone, options: { channel: "whatsapp", shouldCreateUser: p.mode === "register" } });
      return error ? { ok: false, error: "No pudimos reenviar el código." } : { ok: true };
    },
    async cancel() {
      jar.delete(PENDING);
    },
    async verify(code: string): Promise<Result> {
      const p = await readPending();
      if (!p) return { ok: false, error: "No hay ningún código pendiente. Volvé a empezar." };
      const { data, error } = await supabase.auth.verifyOtp({ phone: p.phone, token: code.trim(), type: "sms" });
      if (error || !data.user) return { ok: false, error: "Ese código no es correcto o caducó." };
      const existing = await profileFor(data.user.id, p.phone);
      if (!existing) {
        const { error: insertError } = await supabase.from("profiles").insert({ id: data.user.id, full_name: p.name ?? "", phone: p.phone, phone_verified_at: new Date().toISOString() });
        if (insertError) return { ok: false, error: "No pudimos crear tu perfil. Escribile a bnbtico." };
      } else if (!existing.phoneVerified) {
        await supabase.from("profiles").update({ phone_verified_at: new Date().toISOString() }).eq("id", data.user.id);
      }
      jar.delete(PENDING);
      return { ok: true };
    },
    async current() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      return profileFor(data.user.id, data.user.phone ?? "");
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
