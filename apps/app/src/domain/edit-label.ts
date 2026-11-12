// Etiqueta de la edición de una casa publicada, para la tarjeta de Mis casas (cardLabel) y la ficha editable.
// Va aparte de ./edit para que la tarjeta no arrastre las reglas del formulario (zod).
// Módulo de dominio: sin imports de framework.

/** Resumen de los cambios pendientes de una casa publicada (revisión UX 2026-10-29, A5): «review» si algo espera al
 *  admin; «changes» si todo lo pendiente tiene cambios pedidos. Cada dato y cada foto llevan además su propio estado. */
export type EditStatus = "review" | "changes";

export const EDIT_LABELS: Record<EditStatus, string> = {
  review: "Cambios en revisión",
  changes: "Cambios pedidos",
};

/** Clases de la etiqueta sobre la foto (las de B): sin ocre. */
const EDIT_BADGES: Record<EditStatus, "state-draft" | "state-review"> = {
  review: "state-review",
  changes: "state-review",
};

export function editLabel(e: { status: EditStatus } | null | undefined): { label: string; badge: "state-draft" | "state-review" } | null {
  return e ? { label: EDIT_LABELS[e.status], badge: EDIT_BADGES[e.status] } : null;
}

/** El resumen de una edición a partir del estado de cada dato y cada foto (lo mismo que listing_edit_sync en la base). */
export function editOverview(items: readonly { status: EditStatus; submittedAt: string }[]): { status: EditStatus; submittedAt: string | null } {
  const waiting = items.filter((i) => i.status === "review").map((i) => i.submittedAt).sort();
  return { status: waiting.length ? "review" : "changes", submittedAt: waiting[0] ?? null };
}
