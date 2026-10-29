// Qué cambia una edición de una casa publicada («nombre, descripción, 2 fotos nuevas»). Va aparte de ./edit para que la
// zona del admin no arrastre las reglas del formulario.
// Módulo de dominio: sin imports de framework.
import type { ListingEdit } from "./edit";

export type ReviewedField = "nombre" | "tipo" | "ubicacion" | "descripcion";

const SUMMARY_NAMES: Record<ReviewedField, string> = { nombre: "nombre", tipo: "tipo", ubicacion: "ubicación", descripcion: "descripción" };

/** Datos con revisión que cambia la edición, en el orden nombre, tipo, ubicación, descripción. */
export function editedFields(e: ListingEdit): ReviewedField[] {
  const out: ReviewedField[] = [];
  if (e.title !== null) out.push("nombre");
  if (e.kind !== null || e.bathroomShared !== null) out.push("tipo");
  if (e.location !== null) out.push("ubicacion");
  if (e.description !== null) out.push("descripcion");
  return out;
}

/** «nombre, descripción, 2 fotos nuevas»; "" si no cambia nada. */
export function editSummary(e: ListingEdit): string {
  const parts: string[] = editedFields(e).map((f) => SUMMARY_NAMES[f]);
  const n = e.photos.length;
  if (n > 0) parts.push(n === 1 ? "1 foto nueva" : `${n} fotos nuevas`);
  return parts.join(", ");
}
