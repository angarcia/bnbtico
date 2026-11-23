// El selector de casa o de zona (trozo diferido house-picker-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva una
// pieza con marcado en medio, la función la recibe y devuelve la frase entera en trozos.

export const chooseZone = "Elegir zona";
export const filterHouse = "Filtrar por casa";
export const chooseHouse = "Elegir casa";
export const zoneLabel = ({ name }: { name: string }) => `Zona, ${name}`;
