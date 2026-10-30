// Edición de una casa publicada (spec .scratch/editar-casa): unos datos cambian al momento (capacidad, características,
// precio) y otros pasan por la revisión del admin (nombre, tipo, ubicación, descripción y fotos nuevas), mientras los
// clientes siguen viendo la versión aprobada. Desde la revisión UX 2026-10-29 (A5), cada dato y cada foto nueva va a
// revisión en cuanto se guarda y el admin decide uno a uno; para cada dato cuenta el último valor enviado. Las reglas de cada dato son las del
// asistente (validateStep, parseStep, normalize); los mensajes, los mismos en SQL, el dominio y el fake.
// Módulo de dominio: sin imports de framework.
import { emptyDraft, KIND_LABELS, normalize, TITLE_MIN, type Kind, type ListingDraft, type Listing, type Photo, type Step } from "./listing";
import { validateStep } from "./listing-rules";
import { parseStep, type FormInput } from "./step-forms";
import type { ZoneSource } from "./zones";
import type { EditStatus } from "./edit-label";
import { editedFields, type ReviewedField } from "./edit-summary";

export type { EditStatus } from "./edit-label";
export { editLabel, editOverview, EDIT_LABELS } from "./edit-label";
export { EDIT_MESSAGES } from "./edit-messages";
export { editSummary, editedFields, FIELD_COLUMN, COLUMN_FIELD, type EditFieldColumn, type ReviewedField } from "./edit-summary";

export interface EditLocation {
  lat: number;
  lng: number;
  zone: string;
  zoneId: string | null;
  zoneSource: ZoneSource;
}

/** Estado de un dato o una foto pendiente: en revisión o con cambios pedidos (y la nota del admin). */
export interface EditItemState {
  status: EditStatus;
  reviewNote: string | null;
  /** El envío que el admin abre (y con el que decide). */
  submittedAt: string;
}

export type EditPhoto = Photo & EditItemState;

export interface ListingEdit {
  /** Resumen: «review» si algo espera al admin; si no, «changes». */
  status: EditStatus;
  /** Cada dato con revisión que cambia, con su estado. */
  fields: Partial<Record<ReviewedField, EditItemState>>;
  title: string | null;
  kind: Kind | null;
  /** Va con el tipo: solo cuenta si el tipo resultante es habitación. */
  bathroomShared: boolean | null;
  /** "" = borrar la descripción; null = sin cambio. */
  description: string | null;
  location: EditLocation | null;
  /** El envío más antiguo de lo que espera al admin (orden de su cola); null si nada espera. */
  submittedAt: string | null;
  /** Fotos nuevas, por posición, cada una con su estado; al aprobarla va al final de la ficha. */
  photos: EditPhoto[];
}



export const EDIT_COPY = {
  savedLive: "Guardado. Ya se ve en su ficha.",
  sentToReview: "Enviado a revisión. Su ficha sigue como está hasta que lo aprobemos.",
  discardConfirm: "¿Descartar este cambio? Su ficha sigue como está.",
  photosNotice: "Las fotos nuevas las revisamos antes de publicarlas, normalmente en menos de 24 horas.",
} as const;

/** Lo que el cliente ve mientras tanto, en el aviso de la pantalla de un dato con revisión. */
function approvedValue(field: ReviewedField, l: Listing): string {
  if (field === "nombre") return `«${l.title}»`;
  if (field === "tipo") return `«${l.kind ? KIND_LABELS[l.kind] : ""}»`;
  if (field === "ubicacion") return `«${l.zone}»`;
  return l.description.trim() ? "la descripción de ahora" : "la ficha sin descripción";
}

/** «Este cambio lo revisamos antes de publicarlo, normalmente en menos de 24 horas. Mientras tanto los clientes ven «…».» */
export function reviewNotice(field: ReviewedField, l: Listing): string {
  return `Este cambio lo revisamos antes de publicarlo, normalmente en menos de 24 horas. Mientras tanto los clientes ven ${approvedValue(field, l)}.`;
}

export type EditField = "fotos" | "nombre" | "tipo" | "ubicacion" | "capacidad" | "caracteristicas" | "descripcion" | "precio";
export type FormField = Exclude<EditField, "fotos">;

/** Orden de las filas de la ficha editable (maqueta 08a). */
export const FIELD_ORDER: readonly FormField[] = ["nombre", "tipo", "capacidad", "caracteristicas", "descripcion", "precio", "ubicacion"];
export const IMMEDIATE_FIELDS: readonly FormField[] = ["capacidad", "caracteristicas", "precio"];
export const REVIEWED_FIELDS: readonly FormField[] = ["nombre", "tipo", "ubicacion", "descripcion"];
const EDIT_FIELDS: readonly EditField[] = ["fotos", ...FIELD_ORDER];

export const FIELD_TITLES: Record<EditField, string> = {
  fotos: "Fotos",
  nombre: "Nombre",
  tipo: "Tipo",
  ubicacion: "Ubicación",
  capacidad: "Personas, habitaciones y baños",
  caracteristicas: "Características",
  descripcion: "Descripción",
  precio: "Precio",
};

/** La pantalla del asistente cuyos campos y reglas reutiliza cada dato. */
export const FIELD_STEP: Record<FormField, Step> = { tipo: 1, ubicacion: 2, capacidad: 4, caracteristicas: 5, nombre: 6, descripcion: 6, precio: 8 };

/** Columnas que `update_listing_live` acepta. */
export const LIVE_KEYS = ["capacity", "bedrooms", "bathrooms", "features", "parkingPaid", "nightlyPriceCrc", "acceptsMonthly", "monthlyPriceCrc"] as const;
export type LivePatch = Partial<Pick<ListingDraft, (typeof LIVE_KEYS)[number]>>;
/** Columnas que `save_edit` acepta (la ubicación, siempre las cinco juntas). */
export const EDIT_KEYS = ["title", "kind", "bathroomShared", "description", "lat", "lng", "zone", "zoneId", "zoneSource"] as const;
export type EditPatch = Partial<Pick<ListingDraft, (typeof EDIT_KEYS)[number]>>;

/** Lo que lee cada pantalla de su formulario. */
const PARSED_KEYS: Record<FormField, readonly (keyof ListingDraft)[]> = {
  nombre: ["title"],
  descripcion: ["description"],
  tipo: ["kind", "bathroomShared"],
  ubicacion: ["lat", "lng", "province", "canton", "district", "zone", "zoneId", "zoneSource"],
  capacidad: ["capacity", "bedrooms", "bathrooms"],
  caracteristicas: ["features", "parkingPaid"],
  precio: ["nightlyPriceCrc", "acceptsMonthly", "monthlyPriceCrc"],
};

/** Lo que cada dato con revisión manda a la edición (provincia, cantón y distrito los recalcula la base al aprobar). */
const REVIEWED_KEYS: Record<ReviewedField, readonly (typeof EDIT_KEYS)[number][]> = {
  nombre: ["title"],
  descripcion: ["description"],
  tipo: ["kind", "bathroomShared"],
  ubicacion: ["lat", "lng", "zone", "zoneId", "zoneSource"],
};

export function editFieldFromParam(campo: string): EditField | null {
  return (EDIT_FIELDS as readonly string[]).includes(campo) ? (campo as EditField) : null;
}

const DRAFT_KEYS = Object.keys(emptyDraft()) as (keyof ListingDraft)[];

/** La casa como la verá el cliente si se aprueba la edición: lo cambiado encima de lo aprobado. */
export function mergeEdit(l: Listing, e: ListingEdit | null): ListingDraft {
  const d = Object.fromEntries(DRAFT_KEYS.map((k) => [k, l[k]])) as unknown as ListingDraft;
  d.photoCount = l.photos.length + (e?.photos.length ?? 0);
  if (!e) return d;
  if (e.title !== null) d.title = e.title;
  if (e.description !== null) d.description = e.description;
  if (e.kind !== null) d.kind = e.kind;
  d.bathroomShared = d.kind === "habitacion" ? (e.bathroomShared ?? d.bathroomShared) : null;
  if (e.location) Object.assign(d, e.location);
  return d;
}

export function isEmptyEdit(e: ListingEdit): boolean {
  return editedFields(e).length === 0 && e.photos.length === 0;
}

const pick = <K extends keyof ListingDraft>(d: Partial<ListingDraft>, keys: readonly K[]): Partial<Pick<ListingDraft, K>> => {
  const out: Partial<Pick<ListingDraft, K>> = {};
  for (const k of keys) if (k in d) out[k] = d[k];
  return out;
};

/** Lee el formulario de un dato con las reglas de su pantalla del asistente y devuelve solo sus claves. */
export function parseField(field: FormField, input: FormInput): Partial<ListingDraft> {
  const parsed = parseStep(FIELD_STEP[field], input);
  // El tipo lleva el dato del baño, que en el asistente se pide en la pantalla de la capacidad.
  if (field === "tipo") parsed.bathroomShared = parseStep(4, input).bathroomShared ?? null;
  return pick(parsed, PARSED_KEYS[field]);
}

const same = (a: unknown, b: unknown) => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => x === b[i]) : Object.is(a, b));

/** El tipo también se comprueba con la regla del baño y las habitaciones (pantalla 4). */
const checkSteps = (field: FormField): Step[] => (field === "tipo" ? [1, 4] : [FIELD_STEP[field]]);
const firstError = (field: FormField, d: ListingDraft): string | null => {
  // Solo el nombre nuevo: un nombre aprobado de más de 32 (anterior a publicar v2) no bloquea los otros datos.
  const checked = field === "nombre" ? d : { ...d, title: "x".repeat(TITLE_MIN) };
  for (const step of checkSteps(field)) {
    const error = validateStep(step, checked);
    if (error) return error;
  }
  return null;
};

export type EditPlan = { error: string } | { immediate: LivePatch } | { reviewed: EditPatch };

/**
 * Guardar un dato de una casa publicada. Los inmediatos se validan sobre la versión aprobada y devuelven solo las columnas
 * que cambian (también las que limpia `normalize`). Los de revisión se validan sobre la edición pendiente y devuelven las
 * columnas de ese dato tal cual (la base guarda como null lo que coincide con lo aprobado) y van a revisión al guardarse.
 */
export function planEdit(l: Listing, field: FormField, patch: Partial<ListingDraft>): EditPlan {
  if ((IMMEDIATE_FIELDS as readonly string[]).includes(field)) {
    const merged: ListingDraft = { ...mergeEdit(l, null), ...patch };
    const error = firstError(field, merged);
    if (error) return { error };
    const next = normalize(merged);
    const immediate: Record<string, unknown> = {};
    for (const key of LIVE_KEYS) if (!same(next[key], l[key])) immediate[key] = next[key];
    return { immediate: immediate as LivePatch };
  }
  const merged: ListingDraft = { ...mergeEdit(l, l.edit), ...patch };
  const error = firstError(field, merged);
  if (error) return { error };
  return { reviewed: pick(normalize(merged), REVIEWED_KEYS[field as ReviewedField]) };
}

/** «5 fotos · Editar», «5 fotos · 1 nueva en revisión · Editar», «1 foto · Editar». */
export function photoPill(approved: number, pending: number): string {
  const count = approved === 1 ? "1 foto" : `${approved} fotos`;
  const news = pending === 0 ? "" : pending === 1 ? " · 1 nueva en revisión" : ` · ${pending} nuevas en revisión`;
  return `${count}${news} · Editar`;
}
