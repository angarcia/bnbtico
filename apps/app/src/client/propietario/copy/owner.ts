// Mis casas, el detalle de una casa, «¡Listo! Su casa está en revisión» y sus piezas (grupo de trozo propietario).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva una
// pieza con marcado en medio, la función la recibe y devuelve la frase entera en trozos.

import { plural } from "../../../domain/plural";

export const discardTitle = "¿Descartar este borrador?";
export const discardBody = "No se puede deshacer.";
export const discard = "Descartar";
export const newHouse = "Nueva casa";
export const addHouse = "Añadir casa";
export const title = "Mis casas";
export const loading = "Cargando sus casas";
export const reviewNote = ({ note }: { note: string }) => `Nota de 3bstays: ${note}`;
export const calendar = "Calendario";
export const inquiries = "Consultas";
export const inquiriesFresh = ({ count }: { count: number }) => plural(count, { one: `Consultas, ${count} nueva`, other: `Consultas, ${count} nuevas` });
export const fixAndResend = "Corregir y reenviar";
export const continuePublishing = "Seguir publicando";
export const viewListing = "Ver ficha";
export const myHouse = "Mi casa";
export const addPhotos = "Añadir fotos";
export const inReview = "La estamos revisando, normalmente en menos de 24 horas. Le avisamos por WhatsApp. Mientras tanto no se puede editar.";
export const changesAsked = "Le pedimos cambios";
export const discardDraft = "Descartar borrador";
export const share = "Compartir ficha";
export const shareState = ({ copied, enabled }: { copied: boolean; enabled: boolean }) =>
  copied ? "Enlace copiado" : enabled ? "Envíe el enlace por WhatsApp o compártalo en sus redes" : "Disponible cuando la casa esté activa";
export const sentTitle = "¡Listo! Su casa está en revisión";
export const sentText = ({ title }: { title: string | null }) => `Revisamos ${title ?? "su casa"} a mano, normalmente en menos de 24 horas. Le avisamos por WhatsApp cuando esté publicada.`;
export const sent = "Enviada";
export const sentRef = <T,>({ id }: { id: T }) => ["Hoy · referencia ", id] as const;
export const reviewing = "La revisamos";
export const reviewingNote = "Si falta algo se lo decimos por WhatsApp y lo corrige desde Mis casas";
export const published = ({ months, fee }: { months: number | null; fee: string | null }) =>
  months ? `Publicada y gratis ${months} meses` : fee ? `Publicada · ${fee} al mes` : "Publicada y con la oferta de lanzamiento";
export const publishedNote = "Comparta el enlace y los clientes le escriben por WhatsApp";
export const markNights = "Marcar las noches ocupadas";
export const toMyHouses = "Ir a Mis casas";
export const addMethod = "Añadir método de pago";
export const activate = "Activar suscripción";
export const write3bstays = "Escribir a 3bstays";
export const holdNote = <T,>({ title, reason }: { title: T; reason: string }) => [title, ` Motivo: ${reason}`] as const;
export const holdTitle = ({ title }: { title: string }) => `${title}.`;
export const reasonLabel = "Motivo:";
export const shareLabel = ({ copied }: { copied: boolean }) => (copied ? "Enlace copiado" : "Compartir ficha");
export const shareButton = ({ copied }: { copied: boolean }) => (copied ? "Enlace copiado" : "Compartir");
export const housePhone = "WhatsApp de esta casa";
export const housePhoneLine = ({ phone }: { phone: string }) => `${phone} · verificado`;
export const notFoundTitle = "No encontramos esta casa";
export const notFoundText = "Puede que la haya descartado o que el enlace no sea suyo.";
export const noPhotos = "Aún sin fotos";
