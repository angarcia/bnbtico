// El mapa a pantalla completa (trozo diferido explore-map-full-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const region = "Mapa de casas";
export const list = ({ houses }: { houses: string }) => `Ver lista · ${houses}`;
export const closeCard = "Cerrar tarjeta";
