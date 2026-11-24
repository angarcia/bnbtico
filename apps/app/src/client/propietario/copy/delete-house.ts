// Eliminar una casa (el anfitrión, desde su detalle). Catálogo de textos (estructura por áreas, paso 3, decisión del
// 2026-11-23): un export por mensaje, importado como espacio de nombres (`import * as X_COPY`).

export const action = "Eliminar casa";
export const pending = "Eliminando…";
export const done = "Casa eliminada.";
export const title = ({ name }: { name: string }) => `¿Eliminar «${name}»?`;
export const body = "La casa deja de verse en 3bstays, su enlace deja de funcionar y no recibirá más consultas. Su suscripción termina sin reembolso del período ya pagado. Guardamos sus datos por seguridad, pero no podrá recuperarla desde la app.";
export const pauseHint = "Si solo quiere dejar de recibir clientes un tiempo, use «Pausar la casa» en el Calendario.";
