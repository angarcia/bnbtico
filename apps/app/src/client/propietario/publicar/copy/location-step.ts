// El paso de la ubicación.
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva una
// pieza con marcado en medio, la función la recibe y devuelve la frase entera en trozos.

export const findingCanton = "Buscando el cantón…";
export const placeFailed = "No pudimos ubicar el punto. Revise su conexión.";
export const retry = "Reintentar";
export const search = "Busque un pueblo, playa o barrio";
export const searchPlaceholder = "Busque un pueblo, playa o barrio…";
export const privacy = "Los clientes solo ven la zona, no su dirección.";
export const otherZone = "Otra zona";
export const otherPlaceholder = "Escriba el nombre de la zona";
export const useName = ({ name }: { name: string }) => `Usar "${name}"`;
export const notLand = "Ponga el punto sobre tierra, dentro de Costa Rica";
