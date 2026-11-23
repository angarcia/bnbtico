// Explorar en el JS inicial: la lista y la ayuda sin resultados.
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const searchPill = "Empiece su búsqueda";
export const heading = "Explorar casas";
export const moreError = "No pudimos cargar más casas. Revise su conexión e inténtelo de nuevo.";
export const more = ({ loading }: { loading: boolean }) => (loading ? "Cargando casas…" : "Ver más casas");
export const searching = "Buscando casas…";
export const nightsNote = "Precios orientativos con el precio por noche. El anfitrión le confirma por WhatsApp si está libre.";
export const datesError = "Revise las fechas de su búsqueda.";
export const clearDates = "Quitar fechas";
export const noListingsTitle = "Todavía no hay casas publicadas";
export const noListingsText = "Las primeras casas del Caribe sur están en camino.";
export const usdNote = ({ rate, day }: { rate: string; day: string }) =>
  `Dólares solo para orientarle: ≈ ${rate} por US$1 (tipo de referencia del ${day}). Los anfitriones fijan sus precios en colones.`;
export const helpText = "¿No encuentra lo que busca? Cuéntenos qué necesita por WhatsApp y le ayudamos a encontrar casa.";
export const helpButton = "Escribir a 3bstays por WhatsApp";
export const noResultsTitle = "No hay casas con esos filtros";
export const clearFilters = "Quitar filtros";
