// El buscador de lugares.
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva una
// pieza con marcado en medio, la función la recibe y devuelve la frase entera en trozos.

export const credit = <T,>({ link }: { link: T }) => ["Datos © ", link, " · Photon"] as const;
export const osm = "OpenStreetMap";
