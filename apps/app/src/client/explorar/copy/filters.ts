// Filtros (trozo diferido filtros-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const seeHouses = ({ houses, more }: { houses: string | null; more: boolean }) =>
  houses === null ? "Ver casas" : `Ver ${more ? "más de " : ""}${houses}`;
export const title = "Filtros";
export const close = "Cerrar filtros";
export const reset = "Limpiar";
export const yourSearch = "Su búsqueda";
export const people = "Personas";
export const kind = "Tipo de alojamiento";
export const anyKind = "Cualquiera";
export const whole = "Completo";
export const bedrooms = "Dormitorios";
export const needs = "Qué necesitan";
export const featuresError = "No pudimos cargar las características disponibles.";
export const loadingFeatures = "Cargando características…";
export const price = "Precio";
export const min = "Mínimo";
export const max = "Máximo";
export const minPrice = "Precio mínimo por noche";
export const maxPrice = "Precio máximo por noche";
export const priceHint = "En colones (₡). Puede verlos en dólares desde Explorar.";
export const badRange = "El precio mínimo no puede ser mayor que el máximo.";
export const loading = "Cargando filtros…";
export const kindWhole = "Alojamiento completo";
export const kindRoom = "Habitación";
export const zone = "Zona";
export const allProvinces = "Todas las provincias";
export const wholeProvince = ({ province }: { province: string }) => `Todo ${province}`;
export const dates = "Fechas";
export const noDates = "Sin fechas";
export const nights = "Noches";
export const noNights = "Sin noches";
export const bedsAtLeast = ({ beds }: { beds: number }) => (beds ? `${beds} o más` : "Cualquier cantidad");
