// Adaptador de AuthApi sobre Supabase Auth (GoTrue) y la tabla profiles. El código llega por WhatsApp (Twilio Verify,
// canal whatsapp; en local, el proveedor de relleno con los números de prueba también lo acepta). El perfil lo crea un
// trigger en auth.users con el nombre que va como metadato. La sesión la guarda supabase-js en el almacenamiento que
// recibió el cliente (ver session-client.ts).
import type { Session as SupabaseSession, SupabaseClient } from "@supabase/supabase-js";
import { cooldownError, validateProfilePatch, validateStart } from "../../domain/account";
import type { Account, AuthApi, PendingOtp, Session } from "../../domain/api";
import type { Database } from "../../domain/database.types";
import { DomainError, toDomainError } from "../../domain/errors";
import { pendingOtpStore, type KeyValueStore } from "../storage";

const PROFILE_COLUMNS = "id, full_name, phone, phone_verified_at, email, description, is_owner, is_admin";
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "phone" | "phone_verified_at" | "email" | "description" | "is_owner" | "is_admin">;

export type OtpChannel = "whatsapp" | "sms";

const toAccount = (r: ProfileRow): Account => ({
  id: r.id,
  name: r.full_name,
  phone: r.phone,
  phoneVerified: !!r.phone_verified_at,
  email: r.email ?? null,
  description: r.description ?? null,
  isOwner: !!r.is_owner,
  isAdmin: !!r.is_admin,
});

/** El nivel (aal1/aal2) va en el JWT; se lee sin red. */
function aalOf(accessToken: string): Session["aal"] {
  try {
    const payload = accessToken.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(payload)) as { aal?: string }).aal === "aal2" ? "aal2" : "aal1";
  } catch {
    return "aal1";
  }
}

const toSession = (s: SupabaseSession): Session => ({ userId: s.user.id, aal: aalOf(s.access_token) });
const NO_SESSION = () => new DomainError("Su sesión venció. Ingrese de nuevo.", "session");

export function createPostgrestAuth(db: SupabaseClient<Database>, deps: { pending: KeyValueStore; now?: () => number; channel?: OtpChannel }): AuthApi {
  const now = deps.now ?? Date.now;
  const channel = deps.channel ?? "whatsapp";
  const pending = pendingOtpStore(deps.pending, now);

  async function send(p: Omit<PendingOtp, "sentAt">) {
    const { error } = await db.auth.signInWithOtp({
      phone: p.phone,
      options: { channel, shouldCreateUser: p.mode === "register", data: p.mode === "register" ? { full_name: p.name } : undefined },
    });
    if (error) throw toDomainError(error);
    pending.write(p);
  }

  async function currentSession(): Promise<SupabaseSession | null> {
    // getSession lee el almacenamiento (y refresca el token si caducó); no valida contra el servidor en cada llamada.
    const { data } = await db.auth.getSession();
    return data.session;
  }

  async function readProfile(userId: string): Promise<Account | null> {
    const { data, error } = await db.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
    if (error) throw toDomainError(error);
    return data ? toAccount(data) : null;
  }

  return {
    async start(input) {
      const v = validateStart(input);
      const previous = pending.read();
      const wait = previous?.phone === v.phone ? cooldownError(previous.sentAt, now()) : null;
      if (wait) throw wait;
      await send(v.mode === "register" ? { mode: "register", name: v.name, phone: v.phone } : { mode: "login", phone: v.phone });
    },
    pending: () => pending.read(),
    async resend() {
      const p = pending.read();
      if (!p) throw new DomainError("No hay ningún número pendiente. Vuelva a empezar.", "validation");
      const wait = cooldownError(p.sentAt, now());
      if (wait) throw wait;
      const { sentAt: _sentAt, ...rest } = p;
      await send(rest);
    },
    cancel: () => pending.clear(),
    async verify(code) {
      const p = pending.read();
      if (!p) throw new DomainError("No hay ningún código pendiente. Vuelva a empezar.", "validation");
      const token = code.replace(/\D/g, "");
      if (token.length !== 6) throw new DomainError("El código tiene 6 dígitos.", "validation");
      // GoTrue verifica con type «sms» los códigos de teléfono, también los que llegan por WhatsApp.
      const { data, error } = await db.auth.verifyOtp({ phone: p.phone, token, type: "sms" });
      if (error || !data.user) throw toDomainError(error ?? { code: "otp_expired" });
      const account = await readProfile(data.user.id);
      if (!account) {
        await db.auth.signOut({ scope: "local" });
        throw new DomainError("No pudimos crear su perfil. Escríbale a bnbtico por WhatsApp.", "unknown");
      }
      pending.clear();
      return account;
    },
    async session() {
      const s = await currentSession();
      return s ? toSession(s) : null;
    },
    onSessionChange(listener) {
      const { data } = db.auth.onAuthStateChange((_event, s) => listener(s ? toSession(s) : null));
      return () => data.subscription.unsubscribe();
    },
    async profile() {
      const s = await currentSession();
      return s ? readProfile(s.user.id) : null;
    },
    async updateProfile(patch) {
      const s = await currentSession();
      if (!s) throw NO_SESSION();
      const v = validateProfilePatch(patch);
      const row: Database["public"]["Tables"]["profiles"]["Update"] = {};
      if (v.name !== undefined) row.full_name = v.name;
      if (v.email !== undefined) row.email = v.email;
      if (v.description !== undefined) row.description = v.description;
      const { data, error } = await db.from("profiles").update(row).eq("id", s.user.id).select(PROFILE_COLUMNS).single();
      if (error) throw toDomainError(error);
      return toAccount(data);
    },
    async logout() {
      pending.clear();
      // Global: revoca todas las sesiones del usuario en el servidor. Sin red, al menos se borra la de este dispositivo.
      const { error } = await db.auth.signOut({ scope: "global" });
      if (error) await db.auth.signOut({ scope: "local" });
    },
  };
}
