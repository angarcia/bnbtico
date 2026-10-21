// Proveedor demo: sin envíos reales. Código fijo, cuentas guardadas en cookies firmadas de este navegador (una por cuenta,
// para no superar los 4 KB por cookie). Es lo que corre mientras no hay Supabase + Twilio; las pantallas no notan la diferencia.
import { readSigned, sign } from "@/lib/signed";
import { cooldownError } from "./cooldown";
import type { Account, AuthProvider, CookieJar, Pending, Result, StartInput } from "./types";

export const DEMO_CODE = "123456";
const SESSION = "bnbtico_session";
const PENDING = "bnbtico_pending";
const ACCOUNT_PREFIX = "bnbtico_demo_acct_";
const MAX_ATTEMPTS = 5;
const CODE_TTL_MS = 5 * 60 * 1000;
const YEAR = 60 * 60 * 24 * 365;

interface PendingState extends Pending {
  attempts: number;
  expiresAt: number;
}

const accountCookie = (phone: string) => ACCOUNT_PREFIX + phone.replace(/\D/g, "");

export function createDemoAuth(jar: CookieJar, secret: string, deps: { now?: () => number } = {}): AuthProvider {
  const now = deps.now ?? Date.now;
  const read = <T>(name: string) => readSigned<T>(jar.get(name), secret);
  const write = async (name: string, value: unknown, maxAge = YEAR) => jar.set(name, await sign(value, secret), { maxAge });
  const account = (phone: string) => read<Account>(accountCookie(phone));
  const saveAccount = (a: Account) => write(accountCookie(a.phone), a);
  const readPending = () => read<PendingState>(PENDING);
  const issue = (p: Omit<PendingState, "attempts" | "expiresAt" | "sentAt">) => write(PENDING, { ...p, attempts: 0, sentAt: now(), expiresAt: now() + CODE_TTL_MS } satisfies PendingState, 600);

  return {
    demo: true,
    async start(input: StartInput): Promise<Result> {
      const previous = await readPending();
      const wait = previous?.phone === input.phone ? cooldownError(previous.sentAt, now()) : null;
      if (wait) return { ok: false, error: wait };
      const existing = await account(input.phone);
      if (input.mode === "login" && !existing) return { ok: false, error: "No hay una cuenta con ese WhatsApp. Cree una cuenta." };
      if (input.mode === "register" && existing) return { ok: false, error: "Ya hay una cuenta con ese WhatsApp. Iniciá sesión." };
      if (input.mode === "register" && !input.name.trim()) return { ok: false, error: "Escriba su nombre." };
      await issue({ mode: input.mode, phone: input.phone, name: input.mode === "register" ? input.name.trim() : undefined });
      return { ok: true };
    },
    async pending() {
      const p = await readPending();
      return p ? { mode: p.mode, phone: p.phone, name: p.name, sentAt: p.sentAt } : null;
    },
    async resend() {
      const p = await readPending();
      if (!p) return { ok: false, error: "No hay ningún número pendiente." };
      const wait = cooldownError(p.sentAt, now());
      if (wait) return { ok: false, error: wait };
      await issue({ mode: p.mode, phone: p.phone, name: p.name });
      return { ok: true };
    },
    async cancel() {
      jar.delete(PENDING);
    },
    async verify(code: string): Promise<Result> {
      const p = await readPending();
      if (!p) return { ok: false, error: "No hay ningún código pendiente. Vuelva a empezar." };
      if (now() > p.expiresAt) return { ok: false, error: "El código caducó. Pida otro código." };
      if (p.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Demasiados intentos. Pida otro código." };
      if (code.trim() !== DEMO_CODE) {
        await write(PENDING, { ...p, attempts: p.attempts + 1 }, 600);
        return { ok: false, error: "Ese código no es correcto." };
      }
      const existing = await account(p.phone);
      if (!existing && p.mode === "login") return { ok: false, error: "No hay una cuenta con ese WhatsApp. Cree una cuenta." };
      await saveAccount(
        existing ?? {
          id: `demo-${p.phone.replace(/\D/g, "")}`,
          name: p.name ?? "",
          phone: p.phone,
          phoneVerified: true,
          isOwner: false,
          isAdmin: false,
        },
      );
      await write(SESSION, { phone: p.phone });
      jar.delete(PENDING);
      return { ok: true };
    },
    async current() {
      const s = await read<{ phone: string }>(SESSION);
      return s ? account(s.phone) : null;
    },
    async updateProfile(patch): Promise<Result> {
      const s = await read<{ phone: string }>(SESSION);
      const existing = s ? await account(s.phone) : null;
      if (!existing) return { ok: false, error: "No hay sesión." };
      await saveAccount({ ...existing, ...patch, name: (patch.name ?? existing.name).trim() || existing.name });
      return { ok: true };
    },
    async logout() {
      jar.delete(SESSION);
      jar.delete(PENDING);
    },
  };
}
