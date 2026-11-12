import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import { readIcalExportSnapshot, readOwnerIcalExport, serializeManualCalendar } from "../../src/domain/ical-export";

const id = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-11-08T12:00:00Z");
const snapshot = { id, nights: ["2026-11-10", "2026-11-09", "2026-11-09"] };
const token = "a".repeat(64);

describe("Exportación iCal · lector independiente RFC 5545", () => {
  it("otro lector reconoce días completos, fin exclusivo, ocupación y dos UID únicos", () => {
    const calendar = ICAL.Component.fromString(serializeManualCalendar(snapshot, now));
    expect(calendar.name).toBe("vcalendar");
    expect(calendar.getFirstPropertyValue("version")).toBe("2.0");
    const events = calendar.getAllSubcomponents("vevent").map(component => new ICAL.Event(component));
    expect(events.map(event => [event.startDate.toString(), event.endDate.toString()])).toEqual([
      ["2026-11-09", "2026-11-10"], ["2026-11-10", "2026-11-11"],
    ]);
    expect(events.every(event => event.startDate.isDate && event.endDate.isDate)).toBe(true);
    expect(new Set(events.map(event => event.uid)).size).toBe(2);
    expect(events.every(event => event.component.getFirstPropertyValue("transp") === "OPAQUE")).toBe(true);
    expect(events.every(event => event.component.getFirstPropertyValue("dtstamp") instanceof ICAL.Time)).toBe(true);
  });

  it("excluye fuera de ventana y exporta la última noche con salida al día siguiente", () => {
    const file = serializeManualCalendar({ id, nights: ["2026-11-07", "2026-11-08", "2027-11-08", "2027-11-09"] }, now);
    const events = ICAL.Component.fromString(file).getAllSubcomponents("vevent").map(component => new ICAL.Event(component));
    expect(events.map(event => [event.startDate.toString(), event.endDate.toString()])).toEqual([
      ["2026-11-08", "2026-11-09"], ["2027-11-08", "2027-11-09"],
    ]);
  });

  it("cambia de ventana a medianoche de Costa Rica, sin convertir fechas completas a UTC", () => {
    const input = { id, nights: ["2026-11-07", "2026-11-08"] };
    const before = ICAL.Component.fromString(serializeManualCalendar(input, Date.parse("2026-11-08T05:59:59Z")));
    const after = ICAL.Component.fromString(serializeManualCalendar(input, Date.parse("2026-11-08T06:00:00Z")));
    expect(before.getAllSubcomponents("vevent")).toHaveLength(2);
    expect(after.getAllSubcomponents("vevent")).toHaveLength(1);
    expect(new ICAL.Event(after.getFirstSubcomponent("vevent")!).startDate.toString()).toBe("2026-11-08");
  });

  it("un calendario vacío sigue siendo válido para un lector distinto del importador de 3bstays", () => {
    const calendar = ICAL.Component.fromString(serializeManualCalendar({ id, nights: [] }, now));
    expect(calendar.getAllSubcomponents("vevent")).toEqual([]);
    expect(calendar.getFirstPropertyValue("version")).toBe("2.0");
  });

  it("cambiar la hora de lectura no cambia el UID y otra casa tiene otro namespace", () => {
    const event = (source: string, time: number) => new ICAL.Event(ICAL.Component.fromString(
      serializeManualCalendar({ id: source, nights: ["2026-11-09"] }, time),
    ).getFirstSubcomponent("vevent")!);
    expect(event(id, now).uid).toBe(event(id, now + 60_000).uid);
    expect(event(id, now).uid).not.toBe(event("22222222-2222-4222-8222-222222222222", now).uid);
  });
});

describe("Exportación iCal · frontera de datos privados", () => {
  it("extrae solo fechas e identificador técnico y descarta otros campos", () => {
    expect(readIcalExportSnapshot({ ...snapshot, token, price: 75000, guest: "Ficticio" })).toEqual(snapshot);
  });

  it.each([
    { id: `${id}\r\nDESCRIPTION:privado`, nights: [] },
    { id, nights: ["2026-02-30"] },
    { id, nights: ["2026-11-09\r\nSUMMARY:privado"] },
    { id, nights: Array.from({ length: 367 }, () => "2026-11-09") },
    { id, nights: "2026-11-09" },
  ])("rechaza una proyección inválida sin serializar datos parciales: %j", input => {
    expect(() => readIcalExportSnapshot(input)).toThrow();
  });

  it("admite los estados de propietario sin inventar ni persistir un enlace", () => {
    for (const value of [
      { generated: false, suspended: false, token: null, nights: 0 },
      { generated: true, suspended: false, token, nights: 366 },
      { generated: true, suspended: true, token: null, nights: 1 },
    ]) expect(readOwnerIcalExport(value)).toEqual(value);
  });

  it.each([
    { generated: true, suspended: false, token: null, nights: 0 },
    { generated: false, suspended: false, token, nights: 0 },
    { generated: true, suspended: true, token, nights: 0 },
    { generated: true, suspended: false, token: "corto", nights: 0 },
    { generated: true, suspended: false, token, nights: 367 },
  ])("rechaza metadatos incoherentes sin devolver el secreto", value => {
    expect(() => readOwnerIcalExport(value)).toThrow("Respuesta de exportación no válida.");
  });
});
