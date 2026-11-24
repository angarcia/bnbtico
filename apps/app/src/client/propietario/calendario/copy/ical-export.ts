// Exportar hacia Airbnb (grupo de trozo airbnb-management).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const title = "Exportar hacia Airbnb";
export const text = "Lleve a Airbnb las noches que marque como ocupadas en 3bstays.";
export const loading = "Cargando enlace…";
export const offline = "Sin conexión. Para consultar o generar el enlace, vuelva a conectarse.";
export const revoked = "Retire también el enlace anterior de Airbnb. Los bloqueos que ya leyó pueden seguir apareciendo allí.";
export const retry = "Intentar de nuevo";
export const suspended = "La exportación está suspendida mientras la casa esté bloqueada o rechazada por 3bstays. Los datos se conservan.";
export const noLink = "Todavía no ha generado un enlace de exportación.";
export const generate = ({ busy }: { busy: boolean }) => (busy ? "Generando enlace…" : "Generar enlace");
export const linkLabel = "Enlace de 3bstays para Airbnb";
export const copy = "Copiar enlace";
export const copyFailed = "No pudimos copiarlo. Mantenga pulsado el enlace para copiarlo.";
export const help = "Añada este enlace como calendario importado en Airbnb. Cualquier persona que lo tenga puede consultar sus noches bloqueadas; no puede modificarlas.";
export const noNights = "No hay noches bloqueadas manualmente en este período.";
export const steps = "En el calendario del alojamiento en Airbnb, abra Disponibilidad → Conectar calendarios → Conectar otro sitio web. Pegue el enlace y añada el calendario.";
export const pace = "Airbnb consulta los cambios según su propio ritmo. Copiar el enlace no confirma que Airbnb lo haya añadido ni actualizado.";
export const revoke = "Revocar enlace";
export const revokeInline = "¿Revocar este enlace? El enlace actual dejará de funcionar. Retírelo también de Airbnb.";
export const revoking = ({ busy }: { busy: boolean }) => (busy ? "Revocando…" : "Revocar enlace");
export const cancel = "Cancelar";
export const revokeTitle = "¿Revocar este enlace?";
export const revokeText = "El enlace actual dejará de funcionar. Retírelo también de Airbnb: los bloqueos que ya leyó pueden seguir apareciendo allí.";
export const readFailed = "No pudimos consultar el enlace. Intente de nuevo.";
export const generateFailed = "No pudimos generar el enlace. Intente de nuevo.";
export const copied = "Enlace copiado";
export const revokedToast = "Enlace revocado";
export const changedMeanwhile = "El enlace cambió. Cancele y vuelva a abrir la confirmación.";
export const revokeFailed = "No pudimos completar el cambio. Intente de nuevo.";
