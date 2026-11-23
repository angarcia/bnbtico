// Editar casas desde el admin y los borradores (trozo diferido asistir-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva una
// pieza con marcado en medio, la función la recibe y devuelve la frase entera en trozos.

export const title = "Editar casa";
export const viewListing = "Ver ficha";
export const houseLine = ({ id, title }: { id: string; title: string }) => `${id} · ${title || "Sin nombre"}`;
export const calendar = "Calendario";
export const calendarHint = "Días ocupados y precios especiales";
export const loading = "Cargando sus casas";
export const noName = "Sin nombre";
export const drafts = "Borradores";
export const draftsText = "Casas que su anfitrión empezó y aún no envió. Toque una para completarla con él.";
export const loadingDrafts = "Cargando los borradores";
export const noDrafts = "No hay borradores sin enviar.";
export const started = ({ date }: { date: string }) => `empezado el ${date}`;
export const readyToSend = "Listo para enviar";
