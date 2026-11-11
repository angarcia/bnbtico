import { describe, expect, it } from "vitest";
import { IcalError, parseAirbnbCalendar, validateAirbnbUrl } from "../../src/domain/ical";
import { BROKEN_AIRBNB, EMPTY_AIRBNB, INITIAL_AIRBNB, TEST_AIRBNB_URL, calendarEvent, calendarFile } from "../fixtures/airbnb-ical";

describe("Airbnb · interpretación de la instantánea", () => {
  it("conserva fechas y UID de reservas y cierres sin datos privados ni títulos", () => {
    expect(parseAirbnbCalendar(INITIAL_AIRBNB)).toEqual([
      { uid: "reserva-prueba@3bstays.test", start: "2026-12-10", end: "2026-12-13" },
      { uid: "cierre-prueba@3bstays.test", start: "2026-12-20", end: "2026-12-22" },
    ]);
  });

  it("un calendario completo vacío es una instantánea válida", () => {
    expect(parseAirbnbCalendar(EMPTY_AIRBNB)).toEqual([]);
  });

  it("une continuaciones antes de leer campos y admite metadatos con hora", () => {
    const event = calendarEvent("id-largo@3bstays.test", "20261210", "20261213").replace("id-largo@3bstays.test", "id-largo@\r\n 3bstays.test");
    expect(parseAirbnbCalendar(calendarFile(event))).toEqual([{ uid: "id-largo@3bstays.test", start: "2026-12-10", end: "2026-12-13" }]);
  });

  it("cancelados y transparentes dejan de aportar ocupación", () => {
    const input = calendarFile(
      calendarEvent("a", "20261210", "20261213", ["STATUS:CANCELLED"]),
      calendarEvent("b", "20261210", "20261213", ["TRANSP:TRANSPARENT"]),
      calendarEvent("c", "20261211", "20261212", ["TRANSP:OPAQUE"]),
    );
    expect(parseAirbnbCalendar(input)).toEqual([{ uid: "c", start: "2026-12-11", end: "2026-12-12" }]);
  });

  it("un UID repetido idéntico no duplica y uno contradictorio invalida todo", () => {
    const a = calendarEvent("a", "20261210", "20261213");
    expect(parseAirbnbCalendar(calendarFile(a, a))).toEqual([{ uid: "a", start: "2026-12-10", end: "2026-12-13" }]);
    expect(() => parseAirbnbCalendar(calendarFile(a, calendarEvent("a", "20261211", "20261213")))).toThrow(IcalError);
  });

  it.each([
    ["archivo truncado", BROKEN_AIRBNB],
    ["HTML", "<html>Contenido privado</html>"],
    ["vacío de red", ""],
    ["versión incorrecta", EMPTY_AIRBNB.replace("VERSION:2.0", "VERSION:1.0")],
    ["dos calendarios", EMPTY_AIRBNB + EMPTY_AIRBNB],
    ["fecha inexistente", calendarFile(calendarEvent("a", "20260230", "20260304"))],
    ["salida anterior", calendarFile(calendarEvent("a", "20261213", "20261210"))],
    ["cero noches", calendarFile(calendarEvent("a", "20261210", "20261210"))],
    ["sin UID", calendarFile(calendarEvent("a", "20261210", "20261213").replace("UID:a\r\n", ""))],
    ["sin salida", calendarFile(calendarEvent("a", "20261210", "20261213").replace("DTEND;VALUE=DATE:20261213\r\n", ""))],
    ["inicio duplicado", calendarFile(calendarEvent("a", "20261210", "20261213", ["DTSTART;VALUE=DATE:20261211"]))],
    ["recurrencia", calendarFile(calendarEvent("a", "20261210", "20261213", ["RRULE:FREQ=WEEKLY"]))],
    ["excepción de recurrencia", calendarFile(calendarEvent("a", "20261210", "20261213", ["RECURRENCE-ID;VALUE=DATE:20261210"]))],
    ["duración alternativa", calendarFile(calendarEvent("a", "20261210", "20261213", ["DURATION:P3D"]))],
    ["inicio con hora", calendarFile(calendarEvent("a", "20261210", "20261213").replace("DTSTART;VALUE=DATE:20261210", "DTSTART:20261210T120000Z"))],
    ["zona en fecha de día completo", calendarFile(calendarEvent("a", "20261210", "20261213").replace("DTSTART;VALUE=DATE:", "DTSTART;TZID=America/Costa_Rica;VALUE=DATE:"))],
  ])("rechaza toda la lectura ante %s y no revela el contenido", (_name, input) => {
    let caught: unknown;
    try { parseAirbnbCalendar(input); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(IcalError);
    if (input) expect(caught instanceof Error ? caught.message : "").not.toContain(input);
    expect(caught instanceof Error ? caught.message : "").not.toContain("Contenido privado");
  });

  it("un evento no admitido después de otro correcto falla completo", () => {
    const input = calendarFile(calendarEvent("a", "20261210", "20261213"), calendarEvent("b", "20261220", "20261222", ["RRULE:FREQ=DAILY"]));
    expect(() => parseAirbnbCalendar(input)).toThrow(IcalError);
  });

  it("admite un 29 de febrero existente y no confunde años", () => {
    expect(parseAirbnbCalendar(calendarFile(calendarEvent("bisiesto", "20280229", "20280301")))).toEqual([
      { uid: "bisiesto", start: "2028-02-29", end: "2028-03-01" },
    ]);
  });
});

describe("Airbnb · destino de descarga", () => {
  it.each(["www.airbnb.ca", "www.airbnb.com"])("normaliza el idioma opcional en %s", (host) => {
    const canonical = TEST_AIRBNB_URL.replace("www.airbnb.ca", host);
    expect(validateAirbnbUrl(`${canonical}&locale=en-CA`)).toBe(canonical);
    const url = new URL(canonical);
    url.search = `locale=en-CA&t=${url.searchParams.get("t")}`;
    expect(validateAirbnbUrl(url.href)).toBe(canonical);
  });

  it("admite únicamente los enlaces HTTPS directos de los hosts admitidos", () => {
    expect(validateAirbnbUrl(TEST_AIRBNB_URL)).toBe(TEST_AIRBNB_URL);
    expect(validateAirbnbUrl(TEST_AIRBNB_URL.replace("airbnb.ca", "airbnb.com"))).toBe(TEST_AIRBNB_URL.replace("airbnb.ca", "airbnb.com"));
  });

  it.each([
    "http://www.airbnb.ca/calendar/ical/1.ics?t=secreto",
    "https://127.0.0.1/calendar/ical/1.ics?t=secreto",
    "https://[::1]/calendar/ical/1.ics?t=secreto",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/calendar/ical/1.ics?t=secreto",
    "https://www.airbnb.ca.example.org/calendar/ical/1.ics?t=secreto",
    "https://www.airbnb.ca@127.0.0.1/calendar/ical/1.ics?t=secreto",
    "https://usuario:clave@www.airbnb.ca/calendar/ical/1.ics?t=secreto",
    "https://www.airbnb.ca:8443/calendar/ical/1.ics?t=secreto",
    "https://www.airbnb.ca/otra-ruta?t=secreto",
    "https://www.airbnb.ca/calendar/ical/1.ics",
    `${TEST_AIRBNB_URL}#fragmento`,
    `${TEST_AIRBNB_URL}&t=otro`,
    `${TEST_AIRBNB_URL}&destino=http://localhost`,
    `${TEST_AIRBNB_URL}&locale=en-CA&locale=es-CR`,
    `${TEST_AIRBNB_URL}&locale=http://localhost`,
    `${TEST_AIRBNB_URL}&locale=`,
  ])("rechaza destinos no autorizados sin incluir la URL en el error", (url) => {
    let caught: unknown;
    try { validateAirbnbUrl(url); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(IcalError);
    expect(caught instanceof Error ? caught.message : "").not.toContain(url);
    expect(caught instanceof Error ? caught.message : "").not.toContain("secreto");
  });
});
