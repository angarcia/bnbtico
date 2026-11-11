import { isRecord } from "./airbnb";
import { addDays, calendarWindow, isIsoDate } from "./calendar";
import { costaRicaToday } from "./inquiry";

export interface OwnerIcalExport {
  generated: boolean;
  suspended: boolean;
  token: string | null;
  nights: number;
  /** Cambia solo al generar otro enlace; protege revocaciones con respuesta de red desconocida. */
  generation?: number;
}

export interface IcalExportSnapshot { id: string; nights: string[] }

export interface IcalExportService {
  owner(jwt: string, listingId: string, generate: boolean): Promise<OwnerIcalExport>;
  revoke(jwt: string, listingId: string, expectedGeneration?: number): Promise<void>;
  /** Solo servicio: valida la capacidad sin aceptar una sesión como alternativa al token. */
  read(token: string): Promise<IcalExportSnapshot | null>;
}

export interface OwnerIcalExportApi {
  overview(listingId: string): Promise<OwnerIcalExport>;
  generate(listingId: string): Promise<OwnerIcalExport>;
  revoke(listingId: string, expectedGeneration: number): Promise<void>;
}

export const ICAL_EXPORT_TOKEN = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const ICAL_EXPORT_MESSAGES = {
  unavailable: "Esta casa no permite generar enlaces de calendario.",
  account: "Verifique su cuenta para gestionar el calendario.",
  missing: "No encontramos ese anuncio.",
  session: "Su sesión venció. Ingrese de nuevo.",
  changed: "El enlace cambió. Revise el estado e intente de nuevo.",
} as const;

export function readOwnerIcalExport(value: unknown): OwnerIcalExport {
  if (!isRecord(value) || typeof value.generated !== "boolean" || typeof value.suspended !== "boolean" ||
    !(value.token === null || typeof value.token === "string" && ICAL_EXPORT_TOKEN.test(value.token)) ||
    typeof value.nights !== "number" || !Number.isInteger(value.nights) || value.nights < 0 || value.nights > 366 ||
    (!value.generated || value.suspended ? value.token !== null : value.token === null) ||
    !(value.generation === undefined || typeof value.generation === "number" && Number.isSafeInteger(value.generation) && value.generation >= 0)) {
    throw new Error("Respuesta de exportación no válida.");
  }
  return { generated: value.generated, suspended: value.suspended, token: value.token, nights: value.nights,
    ...(typeof value.generation === "number" ? { generation: value.generation } : {}) };
}

export function readIcalExportSnapshot(value: unknown): IcalExportSnapshot | null {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.id !== "string" || !UUID.test(value.id) ||
    !Array.isArray(value.nights) || value.nights.length > 366) throw new Error("Calendario de exportación no válido.");
  const nights: string[] = [];
  for (const night of value.nights) {
    if (typeof night !== "string" || !isIsoDate(night)) throw new Error("Fecha de exportación no válida.");
    nights.push(night);
  }
  return { id: value.id.toLowerCase(), nights };
}

/** RFC 5545: un evento por noche conserva su UID al editar noches adyacentes. */
export function serializeManualCalendar(snapshot: IcalExportSnapshot, now: number): string {
  const safe = readIcalExportSnapshot(snapshot);
  if (!safe) throw new Error("Calendario de exportación no válido.");
  const { first, last } = calendarWindow(costaRicaToday(now));
  const nights = [...new Set(safe.nights)].filter(day => day >= first && day <= last).sort();
  const stamp = new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//bnbtico//Calendario de disponibilidad//ES", "CALSCALE:GREGORIAN"];
  for (const day of nights) {
    const start = day.replaceAll("-", "");
    lines.push("BEGIN:VEVENT", `UID:bnbtico-${safe.id}-${start}@bnbtico.com`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${addDays(day, 1).replaceAll("-", "")}`,
      "SUMMARY:Ocupado", "TRANSP:OPAQUE", "END:VEVENT");
  }
  return [...lines, "END:VCALENDAR", ""].join("\r\n");
}
