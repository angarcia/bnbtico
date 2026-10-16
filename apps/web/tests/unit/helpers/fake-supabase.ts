import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase simulado para las pruebas de contrato: auth por teléfono con OTP y tabla `profiles` con el trigger
// de creación de perfil (como en supabase/migrations/0001_init.sql). Sin red, sin RLS.
export const FAKE_OTP = "654321";

interface User { id: string; phone: string; full_name: string; confirmed: boolean }
interface ProfileRow { id: string; full_name: string; phone: string; phone_verified_at: string | null; is_owner: boolean; email: string | null; description: string | null }

export function fakeSupabase(opts: { trigger?: boolean; rateLimited?: boolean } = {}) {
  const trigger = opts.trigger ?? true;
  const users = new Map<string, User>(); // por teléfono E.164
  const profiles = new Map<string, ProfileRow>();
  let sessionUser: User | null = null;
  const sent: { phone: string; data?: Record<string, unknown> }[] = [];

  function createProfile(u: User) {
    if (!trigger || profiles.has(u.id)) return;
    profiles.set(u.id, { id: u.id, full_name: u.full_name, phone: u.phone, phone_verified_at: null, is_owner: false, email: null, description: null });
  }

  const client = {
    auth: {
      async signInWithOtp({ phone, options }: { phone: string; options?: { shouldCreateUser?: boolean; data?: Record<string, unknown> } }) {
        if (opts.rateLimited) return { data: {}, error: { message: "For security purposes, you can only request this after 42 seconds.", code: "over_sms_send_rate_limit" } };
        let u = users.get(phone);
        if (!u) {
          if (!options?.shouldCreateUser) return { data: {}, error: { message: "Signups not allowed for otp" } };
          u = { id: `user-${users.size + 1}`, phone, full_name: String(options.data?.full_name ?? ""), confirmed: false };
          users.set(phone, u);
          createProfile(u);
        }
        sent.push({ phone, data: options?.data });
        return { data: {}, error: null };
      },
      async verifyOtp({ phone, token }: { phone: string; token: string; type: string }) {
        const u = users.get(phone);
        if (!u || token !== FAKE_OTP) return { data: { user: null }, error: { message: "Token has expired or is invalid" } };
        if (!u.confirmed) {
          u.confirmed = true;
          const p = profiles.get(u.id);
          if (p && trigger) p.phone_verified_at = new Date().toISOString();
        }
        sessionUser = u;
        return { data: { user: { id: u.id, phone: u.phone.replace(/\D/g, "") } }, error: null };
      },
      async getUser() {
        return { data: { user: sessionUser ? { id: sessionUser.id, phone: sessionUser.phone.replace(/\D/g, "") } : null }, error: null };
      },
      async signOut() {
        sessionUser = null;
        return { error: null };
      },
    },
    from(table: string) {
      if (table !== "profiles") throw new Error(`tabla desconocida ${table}`);
      const requireSession = () => {
        if (!sessionUser) throw new Error("consulta sin sesión");
        return sessionUser;
      };
      return {
        select() {
          return {
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: profiles.get(id) ?? null, error: null }),
            }),
          };
        },
        update(row: Partial<ProfileRow>) {
          return {
            eq: async (_col: string, id: string) => {
              requireSession();
              const p = profiles.get(id);
              if (p) Object.assign(p, row);
              return { error: p ? null : { message: "no row" } };
            },
          };
        },
        insert: async (row: ProfileRow) => {
          requireSession();
          if (profiles.has(row.id)) return { error: { message: "duplicate key" } };
          profiles.set(row.id, { ...row, is_owner: false, email: null, description: null, phone_verified_at: row.phone_verified_at ?? null });
          return { error: null };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, sent, profiles, users };
}
