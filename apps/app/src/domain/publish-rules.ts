// Reglas del asistente de publicar (decisión 2026-10-30, «publicar avanza siempre»): qué es obligatorio para enviar a
// revisión, qué se avisa en ocre, qué cabe en la tabla y cómo se guarda cada pantalla. Aparte de listing.ts porque solo
// las leen las pantallas del propietario y los adaptadores de datos (trozos diferidos), no Explorar.
// Módulo de dominio: sin imports de framework.
import {
  emptyDraft,
  LAST_STEP,
  MIN_PHOTOS_TO_APPROVE,
  normalize,
  type ListingDraft,
  type Step,
} from "./listing";
import {
  isInt,
  descriptionError,
  monthlyError,
  nightlyError,
  titleError,
  validateStep,
} from "./listing-rules";

export type Problem = { step: Step; error: string };
export const PHOTO_REQUIRED_ERROR = "Añada al menos una foto.";
/** Aviso, no error: la descripción es opcional, pero Ana quiere recordar lo que falta (ronda del 2026-10-30). */
export const DESCRIPTION_EMPTY_WARNING = "Sin descripción.";

/** Lo obligatorio para enviar a revisión (decisión 2026-10-30), en el orden de las pantallas: tipo, ubicación, nombre,
 *  al menos una foto y precio por noche. Lo mismo exige `submit_listing`. Lo demás no bloquea: ver `warnings`. */
export function requiredProblems(d: ListingDraft): Problem[] {
  return problems([
    [1, validateStep(1, d)],
    [2, validateStep(2, d)],
    [6, titleError(d)],
    [7, d.photoCount < MIN_PHOTOS_TO_APPROVE ? PHOTO_REQUIRED_ERROR : validateStep(7, d)],
    [8, nightlyError(d)],
  ]);
}

const problems = (list: [Step, string | null][]): Problem[] => list.flatMap(([step, error]) => (error ? [{ step, error }] : []));

/** Lo no obligatorio que está sin decir o mal escrito (capacidad y baño, parqueo, descripción vacía o fuera de 80–2000,
 *  precio al mes): se muestra en ocre al final y no bloquea; lo decide el admin al revisar. Con el nombre mal, el aviso de
 *  la descripción se calla (ya hay un obligatorio en esa pantalla). */
export function warnings(d: ListingDraft): Problem[] {
  return problems([
    [4, validateStep(4, d)],
    [5, validateStep(5, d)],
    [6, titleError(d) ? null : d.description.trim() ? descriptionError(d) : DESCRIPTION_EMPTY_WARNING],
    [8, nightlyError(d) ? null : monthlyError(d)],
  ]);
}

/** El primer obligatorio sin cumplir al enviar a revisión (null = se puede enviar). */
export const validateAll = (d: ListingDraft): Problem | null => requiredProblems(d)[0] ?? null;

/** Mínimo de cada columna numérica que la tabla admite (los CHECK de `listings`). */
const INT_MIN = { capacity: 1, bedrooms: 0, bathrooms: 0, nightlyPriceCrc: 1, monthlyPriceCrc: 1, minNights: 1, minMonths: 1 } as const;

/** El borrador tal como la base puede guardarlo: lo que rompería un CHECK de la tabla (personas o precio menores que 1,
 *  habitaciones o baños negativos, noches o meses mínimos menores que 1, cualquier cosa que no sea entero) se guarda como
 *  null. Así «Continuar» avanza siempre y el fake y PostgREST coinciden (decisión 2026-10-30). */
export function storable(d: ListingDraft): ListingDraft {
  const n: Record<string, unknown> = { ...d };
  for (const [key, min] of Object.entries(INT_MIN)) if (!isInt(d[key as keyof typeof INT_MIN], min)) n[key] = null;
  return n as unknown as ListingDraft;
}

/** Lo que le falta a un borrador, en corto, para el botón «Seguir publicando» de su detalle: «Falta: fotos y precio».
 *  Solo lo obligatorio para enviar (decisión 2026-10-30); lo demás sale como aviso en «Revisar y enviar». */
const MISSING_LABEL: Partial<Record<Step, string>> = { 1: "tipo", 2: "ubicación", 6: "nombre", 7: "fotos", 8: "precio" };
export function missingParts(d: ListingDraft): string[] {
  return requiredProblems(d).flatMap((p) => MISSING_LABEL[p.step] ?? []);
}

/** «fotos y precio», «tipo, nombre y precio». */
export function missingLine(parts: readonly string[]): string | null {
  if (!parts.length) return null;
  return parts.length === 1 ? `Falta: ${parts[0]}` : `Falta: ${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/** Paso donde retomar un borrador (revisión UX A1/A5): el primero con un obligatorio pendiente; si no falta nada, el último. */
export function resumeStep(d: ListingDraft): Step {
  return validateAll(d)?.step ?? LAST_STEP;
}

/** Columnas del borrador que se guardan (el número de fotos no es columna: sale de la lista de fotos). */
const DRAFT_COLUMNS = Object.keys(emptyDraft()).filter((k) => k !== "photoCount") as (keyof ListingDraft)[];

const same = (a: unknown, b: unknown) => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => x === b[i]) : Object.is(a, b));

export type StepPlan = { error: string } | { changes: Partial<ListingDraft>; next: ListingDraft };

/**
 * Guardar una pantalla del asistente: mezcla el parche sobre el borrador actual (el del servidor) y devuelve todas las
 * columnas que cambian, también las que limpia `normalize` (baño sin habitación, tipo de parqueo sin parqueo, precio al mes
 * sin «Alquiler mensual»). «Continuar» avanza siempre (decisión 2026-10-30): solo el tipo del paso 1 bloquea, porque crea
 * el borrador y decide los demás campos; lo que no cabe en la tabla se guarda como null (`storable`). El número de fotos es
 * siempre el del borrador.
 */
export function planStep(current: ListingDraft, step: Step, patch: Partial<ListingDraft>): StepPlan {
  const merged: ListingDraft = { ...current, ...patch, photoCount: current.photoCount };
  if (step === 1) {
    const error = validateStep(1, merged);
    if (error) return { error };
  }
  const next = normalize(storable(merged));
  const changes: Partial<ListingDraft> = {};
  for (const key of DRAFT_COLUMNS) if (!same(next[key], current[key])) (changes as Record<string, unknown>)[key] = next[key];
  return { changes, next };
}
