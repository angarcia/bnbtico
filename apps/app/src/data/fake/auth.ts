// Fake en memoria de AuthApi: mismo comportamiento que GoTrue con los números de prueba (código 123456) y el segundo
// factor TOTP, los mismos mensajes en español y la sesión guardada en el almacenamiento que se le pase (sobrevive a «reiniciar la app»).
import { cooldownError, validateProfilePatch, validateStart } from "../../domain/account";
import type { Account, AuthApi, MfaApi, PendingOtp, Session } from "../../domain/api";
import { DomainError, toDomainError } from "../../domain/errors";
import { pendingOtpStore, SESSION_STORAGE_KEY, type KeyValueStore } from "../storage";
import type { FakeDb, FakeProfile } from "./db";
import { newTotpSecret, totpMatches } from "./totp";

export const FAKE_OTP = "123456";
const SUPABASE_MIN_GAP_MS = 1000;

export function createFakeAuth(db: FakeDb, deps: { session: KeyValueStore; pending: KeyValueStore; now: () => number }): AuthApi & MfaApi {
  const pending = pendingOtpStore(deps.pending, deps.now);
  const listeners = new Set<(s: Session | null) => void>();
  const emit = (s: Session | null) => listeners.forEach((l) => l(s));

  const toAccount = (p: FakeProfile): Account => ({
    id: p.id,
    name: p.fullName,
    phone: p.phone,
    phoneVerified: p.phoneVerified,
    email: p.email,
    description: p.description,
    isOwner: p.isOwner,
    isAdmin: p.isAdmin,
  });

  const token = () => deps.session.getItem(SESSION_STORAGE_KEY);
  const sessionOf = (p: FakeProfile): Session => ({ userId: p.id, aal: db.aal2Sessions.has(token() ?? "") ? "aal2" : "aal1" });

  function current(): FakeProfile | null {
    const token = deps.session.getItem(SESSION_STORAGE_KEY);
    const userId = token ? db.authSessions.get(token) : undefined;
    return userId ? (db.profiles.get(userId) ?? null) : null;
  }

  function send(p: Omit<PendingOtp, "sentAt">) {
    if (p.mode === "login" && !db.profileByPhone(p.phone)) throw toDomainError({ code: "otp_disabled", message: "Signups not allowed for otp" });
    const last = db.otpSentAt.get(p.phone);
    if (last !== undefined && deps.now() - last < SUPABASE_MIN_GAP_MS) {
      throw toDomainError({ code: "over_sms_send_rate_limit", message: "For security purposes, you can only request this after 0 seconds." });
    }
    db.otpSentAt.set(p.phone, deps.now());
    pending.write(p);
  }

  return {
    async start(input) {
      const v = validateStart(input);
      const previous = pending.read();
      const wait = previous?.phone === v.phone ? cooldownError(previous.sentAt, deps.now()) : null;
      if (wait) throw wait;
      if (v.name !== undefined) {
        send({ mode: "register", name: v.name, phone: v.phone });
        return "sent";
      }
      if (!db.profileByPhone(v.phone)) return "needs-name"; // como GoTrue con shouldCreateUser: false: nada enviado
      send({ mode: "login", phone: v.phone });
      return "sent";
    },
    pending: () => pending.read(),
    async resend() {
      const p = pending.read();
      if (!p) throw new DomainError("No hay ningún número pendiente. Vuelva a empezar.", "validation");
      const wait = cooldownError(p.sentAt, deps.now());
      if (wait) throw wait;
      const { sentAt: _sentAt, ...rest } = p;
      send(rest);
    },
    cancel: () => pending.clear(),
    async verify(code) {
      const p = pending.read();
      if (!p) throw new DomainError("No hay ningún código pendiente. Vuelva a empezar.", "validation");
      if (code.replace(/\D/g, "") !== FAKE_OTP) throw toDomainError({ code: "otp_expired", message: "Token has expired or is invalid" });
      const profile = db.profileByPhone(p.phone) ?? db.addProfile({ fullName: p.name ?? "", phone: p.phone, phoneVerified: true, isAdmin: false });
      const token = db.newId();
      db.authSessions.set(token, profile.id);
      deps.session.setItem(SESSION_STORAGE_KEY, token);
      pending.clear();
      emit({ userId: profile.id, aal: "aal1" });
      return toAccount(profile);
    },
    async session() {
      const p = current();
      return p ? sessionOf(p) : null;
    },
    onSessionChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    async profile() {
      const p = current();
      return p ? toAccount(p) : null;
    },
    async updateProfile(patch) {
      const p = current();
      if (!p) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
      const v = validateProfilePatch(patch);
      if (v.name !== undefined) p.fullName = v.name;
      if (v.email !== undefined) p.email = v.email;
      if (v.description !== undefined) p.description = v.description;
      return toAccount(p);
    },
    async enrolMfa() {
      const p = current();
      if (!p) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
      const existing = db.mfaFactors.get(p.id);
      if (existing?.verified) return { factorId: existing.id, verified: true };
      const factor = { id: db.newId(), secret: newTotpSecret(), verified: false };
      db.mfaFactors.set(p.id, factor);
      const uri = `otpauth://totp/bnbtico:${p.phone}?secret=${factor.secret}&issuer=bnbtico`;
      return { factorId: factor.id, verified: false, secret: factor.secret, qrCode: `data:image/svg+xml;utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><title>${uri}</title></svg>`)}` };
    },
    async verifyMfa(factorId, code) {
      const p = current();
      if (!p) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
      const digits = code.replace(/\D/g, "");
      if (digits.length !== 6) throw new DomainError("El código tiene 6 dígitos.", "validation");
      const factor = db.mfaFactors.get(p.id);
      if (factor?.id !== factorId) throw toDomainError({ code: "mfa_factor_not_found" });
      if (!(await totpMatches(factor.secret, digits, deps.now()))) throw toDomainError({ code: "mfa_verification_failed" });
      factor.verified = true;
      db.aal2Sessions.add(token()!);
      emit(sessionOf(p));
    },
    async logout() {
      const p = current();
      // Como signOut global de GoTrue: se cierran todas las sesiones del usuario, no solo la de este dispositivo.
      if (p) for (const [token, userId] of db.authSessions) if (userId === p.id) db.authSessions.delete(token);
      deps.session.removeItem(SESSION_STORAGE_KEY);
      pending.clear();
      emit(null);
    },
  };
}
