// El mapa de la lista de Explorar.
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const mapControls = "Controles del mapa";
export const mapSize = ({ expanded }: { expanded: boolean }) => (expanded ? "Reducir mapa" : "Ampliar mapa");
export const zoomIn = "Acercar mapa";
export const zoomOut = "Alejar mapa";
export const map = "Mapa";
export const openMap = "Abrir el mapa de las casas";
export const mapRegion = "Mapa de las casas";
