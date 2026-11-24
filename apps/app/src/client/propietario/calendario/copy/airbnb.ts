// Calendarios de Airbnb: importar y conectar (grupo de trozo airbnb-management).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

import { plural } from "../../../../domain/plural";

export const title = "Calendarios de Airbnb";
export const loading = "Cargando conexión de Airbnb";
export const notFound = "No encontramos ese anuncio.";
export const importTitle = "Importar desde Airbnb";
export const importText = "Traiga a 3bstays las noches bloqueadas en Airbnb.";
export const suspended = "La conexión está suspendida mientras la casa esté bloqueada o rechazada por 3bstays. Los datos se conservan.";
export const lastSuccess = ({ at }: { at: string }) => `Última importación correcta: ${at}`;
export const nights = ({ count }: { count: number }) =>
  count ? plural(count, { one: `${count} noche bloqueada por Airbnb`, other: `${count} noches bloqueadas por Airbnb` }) : "No hay noches bloqueadas por Airbnb en este período.";
export const offline = "Sin conexión. Puede consultar el último estado guardado.";
export const updateFailed = ({ at }: { at: string | null }) => `No se pudo actualizar${at ? ` · ${at}` : ""}. Se conservan las últimas noches importadas. `;
export const running = ({ connected }: { connected: boolean }) => (connected ? "Actualizando…" : "Conectando…");
export const connect = "Conectar Airbnb";
export const update = ({ running, failed }: { running: boolean; failed: boolean }) => (running ? "Actualizando…" : failed ? "Intentar de nuevo" : "Actualizar ahora");
export const replace = "Sustituir enlace";
export const disconnect = "Desconectar Airbnb";
export const syncNote = "Los calendarios se actualizan periódicamente. Los cambios pueden tardar en aparecer en la otra plataforma. Confirme la disponibilidad antes de acordar una estancia";
export const disconnectTitle = "¿Desconectar Airbnb?";
export const disconnectText = "Se retirarán las noches importadas de Airbnb y dejarán de actualizarse. Sus bloqueos manuales y precios se conservan.";
export const disconnecting = ({ pending }: { pending: boolean }) => (pending ? "Desconectando…" : "Desconectar Airbnb");
export const sheetTitle = ({ exportCard, replacing }: { exportCard: boolean; replacing: boolean }) =>
  exportCard ? "Calendarios de Airbnb" : replacing ? "Sustituir enlace" : "Conectar Airbnb";
export const connected = "Airbnb conectado.";
export const howTo = "En Airbnb, abra el calendario de este alojamiento y copie su enlace de exportación. Péguelo aquí.";
export const keepsCurrent = "El enlace actual seguirá conectado hasta que podamos leer el nuevo.";
export const linkLabel = "Enlace de calendario de Airbnb";
export const linkHint = "Solo importamos noches bloqueadas. No copiamos precios ni datos de huéspedes. Compruebe que el enlace corresponde a esta casa.";
export const submit = ({ saving, replacing }: { saving: boolean; replacing: boolean }) =>
  saving ? (replacing ? "Sustituyendo…" : "Conectando…") : replacing ? "Sustituir enlace" : "Conectar";
export const cancel = "Cancelar";
export const disconnected = "Airbnb desconectado";
export const disconnectFailed = "No pudimos completar el cambio. Cancele y consulte el estado antes de intentar de nuevo.";
export const connectRunning = "La conexión sigue en curso. Vuelva a consultar el estado en un momento.";
export const connectFailed = "No pudimos completar la conexión. Intente de nuevo.";
export const replaced = "Enlace de Airbnb sustituido";
export const connectedToast = "Airbnb conectado";
