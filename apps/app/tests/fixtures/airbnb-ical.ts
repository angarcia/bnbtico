// Datos inventados: conservan la forma de la muestra real sin copiar sus reservas, URL ni teléfonos.
export function calendarFile(...events: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//bnbtico//Prueba Airbnb//ES", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR", ""].join("\r\n");
}

export function calendarEvent(uid: string, start: string, end: string, extra: string[] = []): string {
  return ["BEGIN:VEVENT", `UID:${uid}`, "DTSTAMP:20261107T120000Z", `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, ...extra, "END:VEVENT"].join("\r\n");
}

export const INITIAL_AIRBNB = calendarFile(
  calendarEvent("reserva-prueba@bnbtico.test", "20261210", "20261213", [
    "SUMMARY:Reserved",
    "DESCRIPTION:Contenido privado inventado que no debe guardarse",
    " ni salir en errores. Phone Number (Last 4 Digits): 0000",
  ]),
  calendarEvent("cierre-prueba@bnbtico.test", "20261220", "20261222", ["SUMMARY:Airbnb (Not available)"]),
);

export const CHANGED_AIRBNB = calendarFile(calendarEvent("reserva-prueba@bnbtico.test", "20261211", "20261214"));
export const EMPTY_AIRBNB = calendarFile();
// Un archivo truncado debe fallar completo; no puede interpretarse como cancelación.
export const BROKEN_AIRBNB = INITIAL_AIRBNB.replace("END:VCALENDAR\r\n", "");
export const TEST_AIRBNB_URL = "https://www.airbnb.ca/calendar/ical/123456789.ics?t=00000000000000000000000000000000";
