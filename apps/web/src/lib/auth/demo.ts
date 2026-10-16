// Proveedor demo: sin envíos reales. Código fijo, cuentas guardadas en una cookie firmada de este navegador.
// Es lo que corre mientras no hay Supabase + Twilio configurados; las pantallas no notan la diferencia.
import { readSigned, sign } from "@/lib/signed";
import type { Account, AuthProvider, CookieJar, Pending, Result, StartInput } from "./types";

export const DEMO_CODE = "123456";
const SESSION = "bnbtico_session";
const PENDING = "bnbtico_pending";
const ACCOUNTS = "bnbtico_demo_accounts";
const MAX_ATTEMPTS = 5;
const CODE_TTL_MS = 5 * 60 * 1000;
const YEAR = 60 * 60 * 24 * 365;

interface PendingState extends Pending {
  attempts: number;
  expiresAt: number;
}

export function createDemoAuth(jar: CookieJar, secret: string): AuthProvider {
  const read = <T>(name: string) => readSigned<T>(jar.get(name), secret);
  const write = async (name: string, value: unknown, maxAge = YEAR) => jar.set(name, await sign(value, secret), { maxAge });
  const accounts = async () => (await read<Record<string, Account>>(ACCOUNTS)) ?? {};

  return {
    demo: true,
    async start(input: StartInput): Promise<Result> {
      const all = await accounts();
      const existing = all[input.phone];
      if (input.mode === "login" && !existing) return { ok: false, error: "No hay una cuenta con ese WhatsApp. Creá una cuenta." };
      if (input.mode === "register" && existing) return { ok: false, error: "Ya hay una cuenta con ese WhatsApp. Iniciá sesión." };
      if (input.mode === "register" && !input.name.trim()) return { ok: false, error: "Escribí tu nombre." };
      const pending: PendingState = {
        mode: input.mode,
        phone: input.phone,
        name: input.mode === "register" ? input.name.trim() : undefined,
        attempts: 0,
        expiresAt: Date.now() + CODE_TTL_MS,
      };
      await write(PENDING, pending, 600);
      return { ok: true };
    },
    async pending() {
      const p = await read<PendingState>(PENDING);
      return p ? { mode: p.mode, phone: p.phone, name: p.name } : null;
    },
    async resend() {
      const p = await read<PendingState>(PENDING);
      if (!p) return { ok: false, error: "No hay ningún número pendiente." };
      await write(PENDING, { ...p, attempts: 0, expiresAt: Date.now() + CODE_TTL_MS }, 600);
      return { ok: true };
    },
    async cancel() {
      jar.delete(PENDING);
    },
    async verify(code: string): Promise<Result> {
      const p = await read<PendingState>(PENDING);
      if (!p) return { ok: false, error: "No hay ningún código pendiente. Volvé a empezar." };
      if (Date.now() > p.expiresAt) return { ok: false, error: "El código caducó. Pedí otro código." };
      if (p.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Demasiados intentos. Pedí otro código." };
      if (code.trim() !== DEMO_CODE) {
        await write(PENDING, { ...p, attempts: p.attempts + 1 }, 600);
        return { ok: false, error: "Ese código no es correcto." };
      }
      const all = await accounts();
      const account: Account = all[p.phone] ?? {
        id: `demo-${p.phone.replace(/\D/g, "")}`,
        name: p.name ?? "",
        phone: p.phone,
        phoneVerified: true,
        isOwner: false,
      };
      all[p.phone] = account;
      await write(ACCOUNTS, all);
      await write(SESSION, { phone: p.phone });
      jar.delete(PENDING);
      return { ok: true };
    },
    async current() {
      const s = await read<{ phone: string }>(SESSION);
      if (!s) return null;
      return (await accounts())[s.phone] ?? null;
    },
    async updateProfile(patch): Promise<Result> {
      const s = await read<{ phone: string }>(SESSION);
      if (!s) return { ok: false, error: "No hay sesión." };
      const all = await accounts();
      const account = all[s.phone];
      if (!account) return { ok: false, error: "No hay sesión." };
      all[s.phone] = { ...account, ...patch, name: (patch.name ?? account.name).trim() || account.name };
      await write(ACCOUNTS, all);
      return { ok: true };
    },
    async logout() {
      jar.delete(SESSION);
      jar.delete(PENDING);
    },
  };
}
