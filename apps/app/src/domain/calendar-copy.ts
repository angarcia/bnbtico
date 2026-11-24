// Calendario de la ficha, del contacto y del propietario; en el dominio porque month-grid solo importa React y el dominio
// (tests/unit/architecture.test.ts). Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un módulo por pantalla o pieza, con un export
// por mensaje, que se importa como espacio de nombres (`import * as X_COPY`). Así el bundler acorta los nombres y deja
// fuera los mensajes que no se usan. Mensajes completos; los datos, como parámetros con nombre.

export const clearDates = "Quitar fechas";
export const done = "Listo";
export const prevMonth = "Mes anterior";
export const nextMonth = "Mes siguiente";
export const available = "Disponible";
export const busy = "Ocupado";
export const perNight = ({ price }: { price: string }) => `${price} / noche`;
export const nights = "Noches";
export const nightsRange = ({ max }: { max: number }) => `De 1 a ${max}`;
export const nightsShortcuts = "Atajos de noches";
export const weekend = "Fin de semana";
export const oneWeek = "1 semana";
export const twoWeeks = "2 semanas";
export const oneMonth = "1 mes";
export const dayFree = "disponible";
export const dayBusy = "ocupado";
export const dayManualAndAirbnb = "bloqueo manual y Airbnb";
export const dayAirbnb = "ocupado por Airbnb";
export const daySpecial = "precio distinto";
export const pickCheckout = "Ahora elija la salida.";
