// Hojas y ventanas (trozo diferido overlay-*). Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un módulo por pantalla o pieza, con un export
// por mensaje, que se importa como espacio de nombres (`import * as X_COPY`). Así el bundler acorta los nombres y deja
// fuera los mensajes que no se usan. Mensajes completos; los datos, como parámetros con nombre.

export const close = "Cerrar";
export const keepEditing = "Seguir editando";
export const discard = "Descartar";
export const discardTitle = "¿Descartar los cambios?";
export const discardText = "Los cambios que hizo no se guardarán.";
