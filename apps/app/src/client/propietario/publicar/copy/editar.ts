// Editar un dato de una casa publicada (trozo diferido editar-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const loading = "Cargando sus casas";
export const cancel = "Cancelar";
export const needsPhoto = "Necesita al menos una foto para enviarla a revisión.";
export const photosNotice = ({ admin, reviewNotice }: { admin: boolean; reviewNotice: string }) =>
  admin ? "Las fotos nuevas, el orden y las que quite se guardan al momento." : `El orden y las fotos que quite se guardan al momento. ${reviewNotice}`;
export const done = "Listo";
export const sendToReview = "Enviar a revisión";
export const save = "Guardar";
export const photosDialogNotice = ({ review }: { review: string }) => `El orden y las fotos que quite se guardan al momento y ya se ven en su ficha. ${review}`;
