// La entrada de publicar sin cuenta y «¿Quiere añadir un correo?» (trozo diferido publicar-entrada-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const close = "Cerrar";
export const ready = "Qué tener a mano";
export const readyTitle = "Tenga a mano:";
export const back = "Atrás";
export const next = "Continuar";
export const title = "Publicar casa";
export const retry = "Intentar de nuevo";
export const draftTitle = "Tiene un borrador sin enviar";
export const draftLine = ({ title, date }: { title: string; date: string }) => `${title ? `«${title}»` : "Sin nombre todavía"} · empezado el ${date}.`;
export const continueDraft = "Seguir con el borrador";
export const startOther = ({ title }: { title: string }) => (title ? `Seguir con «${title}»` : "Empezar otra");
export const preparing = "Preparando su casa";
export const emailTitle = "¿Quiere añadir un correo?";
export const email = "Correo";
export const emailHint = "Para recuperar su cuenta si pierde el acceso a su WhatsApp. Opcional.";
export const saveEmail = "Guardar correo";
export const skip = "Ahora no";
