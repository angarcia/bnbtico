// Estado de la edición de una casa publicada; su etiqueta está en ./status-label (editStatusLabel).
// Va aparte de ./edit para que la tarjeta no arrastre las reglas del formulario (zod).
// Módulo de dominio: sin imports de framework.

/** Resumen de los cambios pendientes de una casa publicada (revisión UX 2026-10-29, A5): «review» si algo espera al
 *  admin; «changes» si todo lo pendiente tiene cambios pedidos. Cada dato y cada foto llevan además su propio estado. */
export type EditStatus = "review" | "changes";

/** El resumen de una edición a partir del estado de cada dato y cada foto (lo mismo que listing_edit_sync en la base). */
export function editOverview(items: readonly { status: EditStatus; submittedAt: string }[]): { status: EditStatus; submittedAt: string | null } {
  const waiting = items.filter((i) => i.status === "review").map((i) => i.submittedAt).sort();
  return { status: waiting.length ? "review" : "changes", submittedAt: waiting[0] ?? null };
}
