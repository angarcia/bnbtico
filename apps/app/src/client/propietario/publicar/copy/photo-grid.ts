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
export const uploadFailed = "No pudimos subir esa foto. Intente de nuevo.";
export const photosError = "No pudimos cambiar las fotos. Intente de nuevo.";
export const phasePreparing = "Preparando…";
export const phaseUploading = "Subiendo…";
export const phaseSaving = "Guardando…";
export const dragHelpDesktop = "Arrastre una foto para cambiar el orden. La primera es la portada.";
export const movedTo = ({ position }: { position: number }) => (position === 1 ? "Foto movida a la posición 1, portada" : `Foto movida a la posición ${position}`);
