// El Calendario del propietario (trozo diferido calendario-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const title = "Calendario";
export const loading = "Cargando su calendario";
export const activates = "Su calendario se activa cuando envíe su casa a revisión.";
export const continuePublishing = "Seguir publicando";
export const publish = "Publicar casa";
export const actions = "Acciones del calendario";
export const blocked = "Casa bloqueada por 3bstays: el calendario es de solo lectura.";
export const hint = ({ desktop }: { desktop: boolean }) => (desktop ? "Pulse los días para editarlos" : "Toque los días para editarlos");
export const mark = "Marcar una reserva";
export const pause = "Pausar la casa";
export const paused = ({ until }: { until: string | null }) => (until ? `Pausada hasta el ${until}` : "Pausada");
export const pausedNote = "No aparece en Explorar ni recibe consultas.";
export const republish = "Volver a publicarla";
export const openError = ({ name }: { name: string }) => `No pudimos abrir «${name}». Revise su conexión e inténtelo de nuevo.`;
export const retry = "Reintentar";
export const untitled = "Borrador sin título";
export const availabilityUnknown = "No pudimos comprobar la disponibilidad. Intente de nuevo.";
export const nightsTaken = "Hay noches ocupadas entre esas fechas.";
