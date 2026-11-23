// El editor de fotos de escritorio (trozo diferido photo-viewer-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const title = "Fotos";
export const done = "Listo";
export const selected = "Foto elegida";
export const photoAlt = ({ n }: { n: number }) => `Foto ${n}`;
export const cover = "Portada";
export const band = "Lo que se ve en la ficha";
export const empty = "Añada fotos con «Añadir».";
export const position = ({ pending, n, total, cover }: { pending: string | null; n: number; total: number; cover: boolean }) =>
  pending ? `Foto nueva · ${pending}` : `Foto ${n} de ${total}${cover ? " · portada" : ""}`;
export const moveBefore = "Mover antes";
export const moveAfter = "Mover después";
export const makeCover = "Hacer portada";
export const remove = "Quitar foto";
export const rail = "Todas las fotos";
export const thumb = ({ n, cover, pending }: { n: number; cover: boolean; pending: string | null }) =>
  `Foto ${n}${cover ? ", portada" : ""}${pending ? `, ${pending.toLowerCase()}` : ""}`;
export const uploading = ({ name }: { name: string }) => `Subiendo ${name}`;
export const addPhotos = "Añadir fotos";
export const add = "Añadir";
export const confirmRemove = "Quitar";
