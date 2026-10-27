// Reglas de la cuenta que no dependen del proveedor: enfriamiento entre códigos, caducidad del número pendiente,
// validación del registro y del perfil, destino seguro tras ingresar. Las usan los dos adaptadores de AuthApi y la UI.
import type { PendingOtp, ProfilePatch, StartInput } from "./api";
import { DomainError } from "./errors";
import { normalizePhone } from "./phone";

/** Cada envío real cuesta dinero: 30 s entre códigos para el mismo número (igual que el prototipo y la app vieja). */
export const RESEND_COOLDOWN_MS = 30_000;
/** El número y el nombre pendientes se guardan diez minutos desde el último envío. */
export const PENDING_TTL_MS = 10 * 60_000;
export const DESCRIPTION_MAX = 1000;

export function resendWaitSeconds(sentAt: number, now: number): number {
  return Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - now) / 1000));
}

export function cooldownError(sentAt: number | undefined, now: number): DomainError | null {
  if (sentAt === undefined) return null;
  const s = resendWaitSeconds(sentAt, now);
  return s > 0 ? new DomainError(`Espere ${s} segundos antes de pedir otro código.`, "rate_limit") : null;
}

export function parsePending(raw: string | null, now: number): PendingOtp | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<PendingOtp>;
    if ((p.mode !== "register" && p.mode !== "login") || typeof p.phone !== "string" || typeof p.sentAt !== "number") return null;
    if (now >= p.sentAt + PENDING_TTL_MS) return null;
    return { mode: p.mode, phone: p.phone, sentAt: p.sentAt, ...(typeof p.name === "string" ? { name: p.name } : {}) };
  } catch {
    return null;
  }
}

export function validateStart(input: StartInput): StartInput {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new DomainError("Escriba un WhatsApp válido, con código de país si no es de Costa Rica.", "validation");
  if (input.name === undefined) return { phone };
  const name = input.name.trim();
  if (name.length < 2) throw new DomainError("Escriba su nombre.", "validation");
  return { name, phone };
}

/** El primer paso sin nombre responde que no hay cuenta (GoTrue: `otp_disabled` con `shouldCreateUser: false`). */
export const isNoAccount = (e: DomainError) => e.kind === "not_found";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Nombre vacío se ignora (nunca se borra); correo y descripción vacíos quedan en null. */
export function validateProfilePatch(patch: ProfilePatch): ProfilePatch {
  const out: ProfilePatch = {};
  const name = patch.name?.trim();
  if (name) out.name = name.slice(0, 80);
  if (patch.email !== undefined) {
    const email = patch.email?.trim() ?? "";
    if (email && !EMAIL.test(email)) throw new DomainError("Ese correo no parece válido.", "validation");
    out.email = email || null;
  }
  if (patch.description !== undefined) out.description = patch.description?.trim().slice(0, DESCRIPTION_MAX) || null;
  return out;
}

/** Destino al que volver tras ingresar. Solo rutas internas: evita redirecciones abiertas (`//otro.com`, `https://…`). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !/^\/(?![/\\])/.test(next)) return null;
  return next;
}
