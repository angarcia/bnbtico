// Etiqueta de la edición de una casa publicada, para la tarjeta de Mis casas (cardLabel) y la ficha editable.
// Va aparte de ./edit para que la tarjeta no arrastre las reglas del formulario (zod).
// Módulo de dominio: sin imports de framework.

export type EditStatus = "open" | "review" | "changes";

export const EDIT_LABELS: Record<EditStatus, string> = {
  open: "Edición sin enviar",
  review: "Edición en revisión",
  changes: "Cambios pedidos en la edición",
};

/** Clases de la etiqueta sobre la foto (las de B): sin enviar como el borrador; en revisión y cambios pedidos, sin ocre. */
const EDIT_BADGES: Record<EditStatus, "state-draft" | "state-review"> = {
  open: "state-draft",
  review: "state-review",
  changes: "state-review",
};

export function editLabel(e: { status: EditStatus } | null | undefined): { label: string; badge: "state-draft" | "state-review" } | null {
  return e ? { label: EDIT_LABELS[e.status], badge: EDIT_BADGES[e.status] } : null;
}
