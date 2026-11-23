// La búsqueda del teléfono (trozo diferido buscar-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const zoneSearch = "Busque una zona";
export const clear = "Quitar";
export const zonesList = "Zonas con casas";
export const loadingZones = "Cargando zonas…";
export const zonesError = "No pudimos cargar las zonas.";
export const retry = "Reintentar";
export const noZones = ({ searched }: { searched: boolean }) => (searched ? "Todavía no hay casas en esa zona." : "Todavía no hay zonas con casas.");
export const zoneNote = "Le mostramos las casas de la zona y las que están a 5 km o menos.";
export const heading = "Buscar casas";
export const close = "Cerrar la búsqueda";
export const where = "¿Dónde?";
export const addZone = "Añadir zona";
export const howManyNights = "¿Cuántas noches?";
export const addNights = "Añadir noches";
export const nightsNote = "Le mostramos un precio orientativo para esas noches. La disponibilidad se la confirma el anfitrión por WhatsApp.";
export const when = "¿Cuándo?";
export const addDates = "Añadir fechas";
export const pick = ({ arrival }: { arrival: boolean }) => (arrival ? "Elija la salida" : "Elija la llegada");
export const next = "Siguiente";
export const datesNote = "Le mostramos las casas libres esas noches.";
export const clearDates = "Quitar fechas";
export const who = "¿Quiénes?";
export const addPeople = "Añadir personas";
export const people = "Personas";
export const peopleHint = "Todas las que se van a quedar";
export const onePerson = "Una persona";
export const messageNote = ({ mode }: { mode: "nights" | "dates" | "none" }) =>
  mode === "nights"
    ? "Las noches y las personas van en el mensaje de WhatsApp que le preparamos para el anfitrión."
    : mode === "dates"
      ? "Las fechas y las personas van en el mensaje de WhatsApp que le preparamos para el anfitrión."
      : "Las personas van en el mensaje de WhatsApp que le preparamos para el anfitrión.";
export const clearAll = "Borrar todo";
export const search = "Buscar";
