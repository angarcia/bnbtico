// Piezas del asistente que comparte con la entrada de publicar (trozo diferido wizard-parts-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva una
// pieza con marcado en medio, la función la recibe y devuelve la frase entera en trozos.

export const steps = ({ from, to, total }: { from: number; to: number; total: number }) => `Pasos ${from} a ${to} de ${total}`;
export const whatMeans = ({ label }: { label: string }) => `Qué significa ${label}`;
export const kindTitle = "¿Qué es?";
export const readyPhotos = "Fotos horizontales, si ya las tiene";
export const readyPrice = "El precio por noche";
export const readyTime = "Unos 10 minutos";
export const lastStepLabel = ({ step, total }: { step: number; total: number }) => `Revisar y enviar, último paso. Paso ${step} de ${total}.`;
export const lastStep = "Revisar y enviar";
export const lastStepNote = "último paso";
export const stageLabel = ({ name, position, size, step, total }: { name: string; position: number; size: number; step: number; total: number }) =>
  `${name}, ${position} de ${size}. Paso ${step} de ${total}.`;
export const stagePosition = ({ position, size }: { position: number; size: number }) => `${position} de ${size}`;
export const publishTitle = "Publicar casa";
