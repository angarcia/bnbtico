// Vuelta a publicar tras verificar el WhatsApp (plan E, publicar v2): la respuesta del paso 1 espera en la pestaña y la
// pregunta del correo se hace una vez. Módulo de dominio: solo zod y módulos propios.
import * as z from "zod/mini";

/** El tipo de alojamiento elegido en el paso 1, en localStorage hasta crear la casa. */
export const PUBLISH_STEP1_KEY = "bnbtico-publicar-paso1";
/** Siete días. */
export const PUBLISH_STEP1_TTL_MS = 604_800_000;

export type Step1Kind = "completo" | "habitacion";

// `kind` como texto y comprobado a mano: z.enum metería su código en el zod del JS inicial (~0,4 KB) solo por esto.
const Step1 = z.object({ kind: z.string(), savedAt: z.number() });
const isStep1Kind = (k: string): k is Step1Kind => k === "completo" || k === "habitacion";

export function storeStep1(kind: Step1Kind, now: number): string {
  return JSON.stringify({ kind, savedAt: now });
}

/** La respuesta guardada, si se entiende, no es del futuro y no ha caducado; si no, null. */
export function readStep1(raw: string | null, now: number): { kind: Step1Kind } | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  const r = Step1.safeParse(v);
  if (!r.success || !isStep1Kind(r.data.kind) || r.data.savedAt > now || now - r.data.savedAt > PUBLISH_STEP1_TTL_MS) return null;
  return { kind: r.data.kind };
}

/** Marca de «Ahora no» en la pregunta del correo. */
export const EMAIL_SKIPPED_KEY = "bnbtico-correo-omitido";

/** Cuenta recién verificada sin correo y sin haber dicho «Ahora no». */
export function shouldAskEmail(account: { email: string | null } | undefined, skipped: string | null): boolean {
  return !!account && !account.email && skipped === null;
}
