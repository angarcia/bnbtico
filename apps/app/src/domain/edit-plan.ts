// Guardar un dato de una casa publicada (spec .scratch/editar-casa; editar sigue las reglas de crear, ronda de Ana del
// 2026-11-02, ticket 12): con el dato ya leído de su formulario (parseField, en edit.ts), qué bloquea, qué se avisa y qué
// se envía (planEdit). Aparte de edit.ts porque solo lo lee «Editar un dato» (trozo editar-*), no la ficha editable
// (límite del trozo compartido de la edición en CI).
// Módulo de dominio: sin imports de framework.
import { fieldWarning, IMMEDIATE_FIELDS, LIVE_KEYS, mergeEdit, pick, type EDIT_KEYS, type EditPatch, type FormField, type LivePatch, type ReviewedField } from "./edit";
import { DESCRIPTION_MAX, normalize, type Listing, type ListingDraft, type Step } from "./listing";
import { bathroomsError, bedroomsError, capacityError, charCount, DESCRIPTION_LENGTH_ERROR, isInt, monthlyError, parkingError } from "./listing-rules";
import { requiredProblems, storable } from "./publish-rules";

/** Lo que cada dato con revisión manda a la edición (provincia, cantón y distrito los recalcula la base al aprobar). */
const REVIEWED_KEYS: Record<ReviewedField, readonly (typeof EDIT_KEYS)[number][]> = {
  nombre: ["title"],
  descripcion: ["description"],
  tipo: ["kind", "bathroomShared"],
  ubicacion: ["lat", "lng", "zone", "zoneId", "zoneSource"],
};

const same = (a: unknown, b: unknown) => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => x === b[i]) : Object.is(a, b));

/** Lo obligatorio al crear de cada dato (`requiredProblems`), por su pantalla: tipo, ubicación, nombre y precio por noche. */
const REQUIRED_STEP: Partial<Record<FormField, Step>> = { tipo: 1, ubicacion: 2, nombre: 6, precio: 8 };

/** La excepción de los datos que se publican al momento: cada regla de crear con `had`, si la casa ya tenía ese dato con un
 *  valor válido. Si lo tenía, el nuevo tiene que ser válido; si no, solo avisa y lo que la tabla no admite se guarda vacío
 *  (`storable`). El precio por noche, obligatorio, va por `REQUIRED_STEP`. Lo mismo hace `update_listing_live`. */
const LIVE_RULES: Partial<Record<FormField, [error: (d: ListingDraft) => string | null, had: (d: ListingDraft) => boolean][]>> = {
  capacidad: [
    [capacityError, (d) => !capacityError(d)],
    [bedroomsError, (d) => !bedroomsError(d)],
    [bathroomsError, (d) => !bathroomsError(d)],
  ],
  caracteristicas: [[parkingError, (d) => d.features.includes("parking") && d.parkingPaid !== null]],
  precio: [[monthlyError, (d) => d.acceptsMonthly && isInt(d.monthlyPriceCrc, 1)]],
};

/** Lo que bloquea guardar un dato: solo lo obligatorio al crear de ese dato, el tope de la descripción y la excepción. */
function blockingError(field: FormField, approved: ListingDraft, merged: ListingDraft): string | null {
  const required = requiredProblems(merged).find((p) => p.step === REQUIRED_STEP[field]);
  if (required) return required.error;
  if (field === "descripcion" && charCount(merged.description) > DESCRIPTION_MAX) return DESCRIPTION_LENGTH_ERROR;
  for (const [error, had] of LIVE_RULES[field] ?? []) if (had(approved) && error(merged)) return error(merged);
  return null;
}

export type EditPlan = { error: string } | { immediate: LivePatch; warning?: string } | { reviewed: EditPatch; warning?: string };

/**
 * Guardar un dato de una casa publicada. Los inmediatos se validan sobre la versión aprobada y devuelven solo las columnas
 * que cambian (también las que limpian `normalize` y `storable`). Los de revisión se validan sobre la edición pendiente y
 * devuelven las columnas de ese dato tal cual (la base guarda como null lo que coincide con lo aprobado) y van a revisión
 * al guardarse. Solo bloquea `blockingError`; el aviso del dato vuelve como `warning`. Sin nada leído (un nombre sin
 * tocar), no hay nada que enviar.
 */
export function planEdit(l: Listing, field: FormField, patch: Partial<ListingDraft>): EditPlan {
  const live = (IMMEDIATE_FIELDS as readonly string[]).includes(field);
  if (Object.keys(patch).length === 0) return live ? { immediate: {} } : { reviewed: {} };
  const approved = mergeEdit(l, null);
  const merged: ListingDraft = { ...(live ? approved : mergeEdit(l, l.edit)), ...patch };
  const error = blockingError(field, approved, merged);
  if (error) return { error };
  const warning = fieldWarning(field, merged);
  const extra = warning ? { warning } : {};
  const next = normalize(storable(merged));
  if (!live) return { reviewed: pick(next, REVIEWED_KEYS[field as ReviewedField]), ...extra };
  const immediate: Record<string, unknown> = {};
  for (const key of LIVE_KEYS) if (!same(next[key], l[key])) immediate[key] = next[key];
  return { immediate: immediate as LivePatch, ...extra };
}
