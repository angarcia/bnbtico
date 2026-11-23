// La rejilla de fotos del paso 7 y del editor de fotos (trozo diferido photo-grid-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const dragHelp = "Mantenga pulsada una foto y arrástrela para cambiar el orden. La primera es la portada.";
export const cover = "Portada";
export const remove = ({ n }: { n: number }) => `Quitar foto ${n}`;
export const moveBefore = ({ n }: { n: number }) => `Mover foto ${n} antes`;
export const moveAfter = ({ n }: { n: number }) => `Mover foto ${n} después`;
export const pending = ({ changes }: { changes: boolean }) => (changes ? "Cambios pedidos" : "En revisión");
export const uploading = ({ name }: { name: string }) => `Subiendo ${name}`;
export const addPhotos = "Añadir fotos";
export const add = "Añadir";
