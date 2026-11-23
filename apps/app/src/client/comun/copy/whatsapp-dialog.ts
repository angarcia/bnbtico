// La ventana de escritorio para verificar el WhatsApp.
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const title = ({ publish }: { publish: boolean }) => (publish ? "Verificar WhatsApp" : "Ingresar");
export const backToNumber = "Volver al número";
export const loading = "Cargando…";
