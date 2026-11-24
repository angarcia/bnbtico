// Publicar con cuenta: la entrada y la cabecera del asistente (trozo diferido publicar-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const start = ({ pending, draft }: { pending: boolean; draft: boolean }) => (pending ? "Un momento…" : draft ? "Empezar otro" : "Empezar");
export const loading = "Cargando sus casas";
export const title = "Publicar casa";
export const draftTitle = "Tiene un borrador sin enviar";
export const draftLine = ({ title, date }: { title: string; date: string }) => `${title ? `«${title}»` : "Sin nombre todavía"} · empezado el ${date}.`;
export const continueDraft = "Seguir con el borrador";
export const intro = "Publique su casa en pocos pasos";
export const introNote = "La revisamos a mano y queda visible con su enlace para compartir por WhatsApp.";
export const wizardTitle = ({ admin }: { admin: boolean }) => (admin ? "Asistir casa" : "Publicar casa");
export const notFound = "No encontramos ese anuncio.";
export const verifyFirst = "Para esto hace falta verificar su WhatsApp.";
export const savingDraft = "Guardando el borrador…";
export const closeLater = "Cerrar y seguir después";
