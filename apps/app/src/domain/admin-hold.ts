// La retención de una casa por el admin (spec .scratch/admin-casas-acciones, decidido el 2026-10-30): pausada o bloqueada.
// No toca `status`: son columnas aparte (admin_hold). Este módulo es lo mínimo que entra en el JS inicial (el tipo, leerlo de
// la fila y la etiqueta); los mensajes, las reglas y los textos largos van aparte, en admin-actions.ts.

/** `paused`: sale del público y el propietario la sigue editando; `blocked`: lo mismo, sin editar y con la suscripción parada. */
export type HoldKind = "paused" | "blocked";

/** La retención de una casa tal como la ve el propietario o el admin: el tipo y el motivo que escribió el admin. */
export interface AdminHold {
  kind: HoldKind;
  reason: string;
}

/** La retención desde las dos columnas de la fila; null si no hay o si el tipo no es uno de los dos. */
export function holdFromRow(kind: string | null | undefined, reason: string | null | undefined): AdminHold | null {
  return kind === "paused" || kind === "blocked" ? { kind, reason: reason ?? "" } : null;
}

