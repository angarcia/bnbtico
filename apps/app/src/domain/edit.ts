// Edición de una casa publicada (spec .scratch/editar-casa): unos datos cambian al momento (capacidad, características,
// precio) y otros pasan por la revisión del admin (nombre, tipo, ubicación, descripción y fotos nuevas) en una sola
// edición por casa, mientras los clientes siguen viendo la versión aprobada. Las reglas de cada dato son las del
// asistente (validateStep, parseStep, normalize); los mensajes, los mismos en SQL, el dominio y el fake.
// Módulo de dominio: sin imports de framework.
import { emptyDraft, normalize, TITLE_MIN, validateStep, type Kind, type ListingDraft, type Listing, type Photo, type Step } from "./listing";
import { parseStep, type FormInput } from "./step-forms";
import type { ZoneSource } from "./zones";
import type { EditStatus } from "./edit-label";
import { EDIT_MESSAGES } from "./edit-messages";
import { editedFields, type ReviewedField } from "./edit-summary";

export type { EditStatus } from "./edit-label";
export { editLabel, EDIT_LABELS } from "./edit-label";
export { EDIT_MESSAGES } from "./edit-messages";
export { editSummary, editedFields } from "./edit-summary";

export interface EditLocation {
  lat: number;
  lng: number;
  zone: string;
  zoneId: string | null;
  zoneSource: ZoneSource;
}

export interface ListingEdit {
  status: EditStatus;
  reviewNote: string | null;
  title: string | null;
  kind: Kind | null;
  /** Va con el tipo: solo cuenta si el tipo resultante es habitación. */
  bathroomShared: boolean | null;
  /** "" = borrar la descripción; null = sin cambio. */
  description: string | null;
  location: EditLocation | null;
  submittedAt: string | null;
  /** Fotos nuevas, por posición; al aprobar van al final de la ficha. */
  photos: Photo[];
}

export const EDIT_COPY = {
  savedLive: "Guardado. Ya se ve en su ficha.",
  savedEdit: "Guardado. Envíelo a revisión cuando termine.",
  discardConfirm: "¿Descartar los cambios sin aplicar? Su ficha sigue como está.",
  readOnly: "Este cambio está en revisión. Si quiere cambiar algo, descarte la edición y empiece otra.",
} as const;

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
 * columnas de ese dato tal cual (la base guarda como null lo que coincide con lo aprobado); con la edición en revisión se
 * rechazan.
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
  if (l.edit?.status === "review") return { error: EDIT_MESSAGES.inReview };
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
