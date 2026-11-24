// La ficha editable de una casa publicada (trozo diferido casa-editable-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva una
// pieza con marcado en medio, la función la recibe y devuelve la frase entera en trozos.

import { plural } from "../../../domain/plural";

export const pendingOwner = ({ value }: { value: string }) => `Pendiente del anfitrión: ${value}`;
export const editField = ({ field }: { field: string }) => `Editar: ${field}`;
export const edit = "Editar";
export const changesAsked = ({ note }: { note: string }) => `Le pedimos cambios: ${note}`;
export const pendingVisibility = "Los clientes ven lo de antes hasta que lo aprobemos.";
export const discardChange = ({ field }: { field: string }) => `Descartar el cambio de ${field}`;
export const discard = "Descartar";
export const last30 = "Últimos 30 días";
export const visits = ({ count }: { count: number }) => plural(count, { one: "visita", other: "visitas" });
export const inquiries = ({ count }: { count: number }) => plural(count, { one: "consulta", other: "consultas" });
export const plan = ({ promo }: { promo: boolean }) => (promo ? "Oferta de lanzamiento" : "Suscripción mensual");
export const stopped = "Parada";
export const upToDate = "Al día";
export const afterPromo = ({ fee }: { fee: string }) => `. Después, ${fee} al mes, sin permanencia.`;
export const subscription = "Suscripción";
export const stoppedTitle = "Suscripción parada";
export const stoppedText = ({ title }: { title: string }) => `${title} no aparece en Explorar y el enlace de su ficha no funciona. Actívela para que vuelvan a escribirle.`;
export const fee = ({ fee }: { fee: string }) => `${fee} al mes, sin permanencia`;
export const noPhotos = "Sin fotos";
export const editPhotos = "Editar fotos";
export const editPhotosLabel = ({ photos }: { photos: string }) => `Editar fotos: ${photos}`;
export const hint = ({ admin }: { admin: boolean }) =>
  admin ? "Toque un dato para cambiarlo. Lo que guarde se publica al momento, sin revisión." : "Toque un dato para editarlo. Su ficha seguirá visible durante la revisión.";
export const roomBath = ({ shared }: { shared: boolean }) => `Habitación · baño ${shared ? "compartido" : "privado"}`;
export const people = ({ count }: { count: number }) => plural(count, { one: `${count} persona`, other: `${count} personas` });
export const bedrooms = ({ count }: { count: number }) => plural(count, { one: `${count} dormitorio`, other: `${count} dormitorios` });
export const baths = ({ count }: { count: number }) => plural(count, { one: `${count} baño`, other: `${count} baños` });
export const noFeatures = "Ninguna marcada";
export const noDescription = "Sin descripción";
