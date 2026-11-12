import type { CalendarDay } from "./calendar";
import type { IcalErrorCode, ImportedBlock } from "./ical";

export interface AirbnbSummary {
  connected: boolean;
  state: "none" | "connected" | "running" | "error" | "suspended";
  lastSuccessAt: string | null;
  errorCode: IcalErrorCode | null;
  /** Fecha del fallo posterior, independiente de la última importación válida. */
  lastErrorAt?: string | null;
  nights: number;
  /** Solo presencia, nunca el token. Compatible con la lectura de #5 anterior a la migración de #6. */
  exportGenerated?: boolean;
}

/** Puerto del worker. Contexto/finalización/repetición son exclusivamente de servicio. */
export interface AirbnbService {
  begin(jwt: string, listingId: string, url: string, requestId: string): Promise<{ run: boolean }>;
  update(jwt: string, listingId: string, requestId: string, replacementUrl?: string): Promise<{ run: boolean }>;
  disconnect(jwt: string, listingId: string, requestId: string): Promise<void>;
  claim(listingId: string, requestId: string): Promise<{ run: boolean }>;
  context(listingId: string, requestId: string): Promise<{ url: string } | null>;
  finish(listingId: string, requestId: string, blocks: ImportedBlock[] | null, error: IcalErrorCode | null): Promise<void>;
  overview(jwt: string, listingId: string): Promise<AirbnbSummary>;
}

export interface OwnerAirbnbApi {
  overview(listingId: string): Promise<AirbnbSummary>;
  connect(listingId: string, url: string, requestId: string): Promise<AirbnbSummary>;
  refresh(listingId: string, requestId: string): Promise<AirbnbSummary>;
  replace(listingId: string, url: string, requestId: string): Promise<AirbnbSummary>;
  disconnect(listingId: string, requestId: string): Promise<void>;
}

export const AIRBNB_BUSY_MESSAGE = "Hay noches ocupadas entre esas fechas.";

/** Validación de respuestas externas, sin conversiones de tipos para confiar en JSON remoto. */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function readAirbnbSummary(value: unknown): AirbnbSummary {
  if (!isRecord(value) || typeof value.connected !== "boolean" ||
    !["none", "connected", "running", "error", "suspended"].includes(String(value.state)) ||
    !(value.lastSuccessAt === null || typeof value.lastSuccessAt === "string" && Number.isFinite(Date.parse(value.lastSuccessAt))) ||
    !(value.errorCode === null || ["url", "calendar", "unsupported", "download", "timeout", "size"].includes(String(value.errorCode))) ||
    typeof value.nights !== "number" || !Number.isInteger(value.nights) || value.nights < 0 || value.nights > 366 ||
    !(value.exportGenerated === undefined || typeof value.exportGenerated === "boolean") ||
    !(value.lastErrorAt === undefined || value.lastErrorAt === null || typeof value.lastErrorAt === "string" && Number.isFinite(Date.parse(value.lastErrorAt)))) throw new Error("Respuesta de calendario no válida.");
  // Los predicados de valores discriminados se comprueban de nuevo para estrechar sin casts.
  const state = value.state;
  const error = value.errorCode;
  if (state !== "none" && state !== "connected" && state !== "running" && state !== "error" && state !== "suspended") throw new Error("Estado de calendario no válido.");
  if (error !== null && error !== "url" && error !== "calendar" && error !== "unsupported" && error !== "download" && error !== "timeout" && error !== "size") throw new Error("Error de calendario no válido.");
  return { connected: value.connected, state, lastSuccessAt: value.lastSuccessAt, errorCode: error, nights: value.nights,
    ...(typeof value.exportGenerated === "boolean" ? { exportGenerated: value.exportGenerated } : {}),
    ...(value.lastErrorAt === null || typeof value.lastErrorAt === "string" ? { lastErrorAt: value.lastErrorAt } : {}) };
}

export function readCalendarDays(value: unknown): CalendarDay[] {
  if (!Array.isArray(value) || value.length > 366) throw new Error("Días de calendario no válidos.");
  return value.map((row: unknown) => {
    if (!isRecord(row) || typeof row.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.day) ||
      typeof row.available !== "boolean" || !(row.special_price_crc === null || typeof row.special_price_crc === "number" && Number.isInteger(row.special_price_crc) && row.special_price_crc > 0) ||
      typeof row.imported !== "boolean" || typeof row.manual_available !== "boolean") throw new Error("Día de calendario no válido.");
    return { day: row.day, available: row.available, specialPriceCrc: row.special_price_crc,
      ...(row.imported ? { imported: true, manualAvailable: row.manual_available } : {}) };
  });
}
