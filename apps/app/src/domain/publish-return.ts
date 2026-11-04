// Vuelta a publicar tras verificar el WhatsApp (plan E, publicar v2): lo escrito sin cuenta espera en el teléfono y la
// pregunta del correo se hace una vez. Desde el 2026-11-04 (Ana) son los pasos 1–6 enteros, no solo el tipo: el código se
// pide antes de las fotos. Módulo de dominio, sin framework.
import { emptyDraft, FEATURES, KINDS, normalize, type Feature, type ListingDraft } from "./listing";

/** El tipo de alojamiento elegido en el paso 1, en localStorage hasta crear la casa. */
export const PUBLISH_STEP1_KEY = "bnbtico-publicar-paso1";
/** Siete días. */
export const PUBLISH_STEP1_TTL_MS = 604_800_000;

export type Step1Kind = "completo" | "habitacion";

// Comprobado a mano y no con zod: las funciones de zod que solo usara esta lectura (un trozo diferido) irían al zod del JS
// inicial.
const isStep1Kind = (k: unknown): k is Step1Kind => k === "completo" || k === "habitacion";

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
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const { kind, savedAt } = v as { kind?: unknown; savedAt?: unknown };
  if (!isStep1Kind(kind) || typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
  if (savedAt > now || now - savedAt > PUBLISH_STEP1_TTL_MS) return null;
  return { kind };
}

/** Los pasos 1–6 escritos sin cuenta, en localStorage hasta crear la casa (mismo plazo que el paso 1). */
export const PUBLISH_DRAFT_KEY = "bnbtico-publicar-borrador";

/** El borrador sin fotos (no las hay sin cuenta). */
export function storeLocalDraft(draft: ListingDraft, now: number): string {
  return JSON.stringify({ draft: { ...draft, photoCount: 0 }, savedAt: now });
}

type Check = (v: unknown) => boolean;
const str: Check = (v) => typeof v === "string";
const num: Check = (v) => typeof v === "number" && Number.isFinite(v);
const bool: Check = (v) => typeof v === "boolean";
const oneOf = (...xs: string[]): Check => (v) => typeof v === "string" && xs.includes(v);
/** Qué tipo vale para cada dato (null siempre vale donde el borrador vacío lo tiene). A mano, sin zod (ver arriba). */
const FIELD_CHECKS: Partial<Record<keyof ListingDraft, Check>> = {
  acceptsNightly: bool, acceptsMonthly: bool, province: str, canton: str, district: str, zone: str, zoneId: str,
  zoneSource: oneOf("list", "district", "other"), lat: num, lng: num, capacity: num, bedrooms: num, bathrooms: num,
  bathroomShared: bool, title: str, description: str, parkingPaid: bool, nightlyPriceCrc: num, minNights: num,
  monthlyMode: oneOf("amount", "contact"), monthlyPriceCrc: num, minMonths: num,
};
const FEATURE_IDS = new Set<string>(FEATURES.map(([id]) => id));

/** El borrador guardado, si se entiende, no es del futuro y no ha caducado; si no, null. Un dato con un tipo que no toca
 *  se queda vacío (el asistente lo vuelve a pedir); se normaliza como al guardar. */
export function readLocalDraft(raw: string | null, now: number): ListingDraft | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const { draft, savedAt } = v as { draft?: unknown; savedAt?: unknown };
  if (typeof draft !== "object" || draft === null || Array.isArray(draft)) return null;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt) || savedAt > now || now - savedAt > PUBLISH_STEP1_TTL_MS) return null;
  const d = draft as Record<string, unknown>;
  if (!(KINDS as readonly unknown[]).includes(d.kind)) return null;
  const out: ListingDraft = { ...emptyDraft(), kind: d.kind as ListingDraft["kind"] };
  for (const [key, check] of Object.entries(FIELD_CHECKS) as [keyof ListingDraft, Check][]) {
    if (key in d && check(d[key])) (out as unknown as Record<string, unknown>)[key] = d[key];
  }
  if (Array.isArray(d.features)) out.features = d.features.filter((f): f is Feature => typeof f === "string" && FEATURE_IDS.has(f));
  return normalize(out);
}

/** Lo que se escribió sin cuenta: el borrador entero o, de una visita del flujo anterior, solo el tipo del paso 1. */
export function readPublishDraft(draftRaw: string | null, step1Raw: string | null, now: number): ListingDraft | null {
  const draft = readLocalDraft(draftRaw, now);
  if (draft) return draft;
  const step1 = readStep1(step1Raw, now);
  return step1 ? normalize({ ...emptyDraft(), kind: step1.kind }) : null;
}

/** Marca de «Ahora no» en la pregunta del correo. */
export const EMAIL_SKIPPED_KEY = "bnbtico-correo-omitido";

/** Cuenta recién verificada sin correo y sin haber dicho «Ahora no». */
export function shouldAskEmail(account: { email: string | null } | undefined, skipped: string | null): boolean {
  return !!account && !account.email && skipped === null;
}
