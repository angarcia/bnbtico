// Arnés de AuthApi contra Supabase local: número de prueba sin cuenta al empezar (se borra con la clave de servicio),
// almacenamiento en memoria compartido entre «reinicios». Supabase admite un código por segundo y número: cada prueba
// espera ese segundo, y adelantar el reloj también lo espera de verdad.
import { createClient } from "@supabase/supabase-js";
import { createPostgrestAuth } from "../../src/data/postgrest/auth";
import { createSessionClient } from "../../src/data/postgrest/session-client";
import { memoryStore, SESSION_STORAGE_KEY } from "../../src/data/storage";
import type { AuthHarness } from "../contract/harness";
import { totp } from "../contract/totp";
import { localSupabase, serviceClient } from "./local";

export const FREE_PHONE = "+50688889999";
/** Número de prueba de Estados Unidos (config.toml, [auth.sms.test_otp]); solo local. */
export const INTL_PHONE = "+14155550100";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Borra la cuenta de ese número (y en cascada su perfil y sus casas). */
export async function deleteAccount(phone: string) {
  const admin = serviceClient().auth.admin;
  const { data, error } = await admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) if (u.phone === phone.replace("+", "")) await admin.deleteUser(u.id);
}

export async function postgrestAuthHarness(): Promise<AuthHarness> {
  await deleteAccount(FREE_PHONE);
  await deleteAccount(INTL_PHONE);
  await sleep(1100);
  const { url, anonKey } = localSupabase();
  let skew = 0;
  const stores = { session: memoryStore(), pending: memoryStore() };
  const make = () => createPostgrestAuth(createSessionClient(url, anonKey, stores.session), { pending: stores.pending, now: () => Date.now() + skew });
  return {
    auth: make(),
    restart: make,
    async advance(ms) {
      skew += ms;
      await sleep(1100);
    },
    code: "123456",
    mfaCode: (secret) => totp(secret),
    async makeAdmin() {
      const { error } = await serviceClient().rpc("seed_admin", { p_phone: FREE_PHONE });
      if (error) throw error;
    },
    phone: FREE_PHONE,
    intlPhone: INTL_PHONE,
    async captureSession() {
      const raw = stores.session.getItem(SESSION_STORAGE_KEY);
      const token = raw ? (JSON.parse(raw) as { access_token: string }).access_token : "";
      // getUser con el token de acceso guardado: GoTrue lo rechaza si la sesión del token ya no existe (revocada).
      const probe = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      return async () => !!token && !(await probe.auth.getUser(token)).error;
    },
  };
}
