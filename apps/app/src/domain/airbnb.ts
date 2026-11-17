import type { CalendarDay } from "./calendar";
import { costaRicaClock, costaRicaToday } from "./dates";
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
  /** Desde cuándo se puede volver a «Actualizar ahora» (null: ya se puede). Ausente antes de la migración del límite. */
  manualAvailableAt?: string | null;
  /** Lecturas manuales que quedan hoy (día de Costa Rica). Ausente antes de la migración del límite. */
  manualLeftToday?: number;
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

export interface AirbnbCycleService extends Pick<AirbnbService, "context" | "finish"> {
  due(cycle: string): Promise<string[]>;
  claimCycle(listingId: string, requestId: string, cycle: string): Promise<{ run: boolean }>;
}

export const AIRBNB_BUSY_MESSAGE = "Hay noches ocupadas entre esas fechas.";

/** Límite de las lecturas manuales (2026-11-17), igual en la base (airbnb_manual_gate), el fake y la pantalla. */
export const AIRBNB_MANUAL_WAIT_MS = 15 * 60_000;
export const AIRBNB_MANUAL_PER_DAY = 10;
export const AIRBNB_LIMIT_MESSAGES = {
  wait: (clock: string) => `Podrá actualizar de nuevo a las ${clock}.`,
  day: `Hoy ya actualizó ${AIRBNB_MANUAL_PER_DAY} veces. Podrá actualizar de nuevo mañana.`,
} as const;

/** Si un mensaje de la base es uno de los del límite (el de espera lleva la hora). */
export const isAirbnbLimitMessage = (message: string): boolean =>
  message === AIRBNB_LIMIT_MESSAGES.day || /^Podrá actualizar de nuevo a las \d\d:\d\d\.$/.test(message);

export interface AirbnbRead { startedMs: number; manual: boolean }

/**
 * Si una lectura manual puede empezar ahora. `wait`: «Actualizar ahora» espera 15 minutos desde la última lectura de la
 * casa, manual o automática. Conectar o cambiar el enlace no espera. Todas las manuales cuentan en el tope del día.
 */
export function airbnbManualRefusal(reads: readonly AirbnbRead[], nowMs: number, wait: boolean): string | null {
  const last = Math.max(-Infinity, ...reads.map((r) => r.startedMs));
  if (wait && nowMs - last < AIRBNB_MANUAL_WAIT_MS) return AIRBNB_LIMIT_MESSAGES.wait(costaRicaClock(last + AIRBNB_MANUAL_WAIT_MS));
  const today = costaRicaToday(nowMs);
  if (reads.filter((r) => r.manual && costaRicaToday(r.startedMs) === today).length >= AIRBNB_MANUAL_PER_DAY) return AIRBNB_LIMIT_MESSAGES.day;
  return null;
}

/** Lo que dice el resumen sobre el límite (manualAvailableAt y manualLeftToday). */
export function airbnbManualState(reads: readonly AirbnbRead[], nowMs: number): { manualAvailableAt: string | null; manualLeftToday: number } {
  const last = Math.max(-Infinity, ...reads.map((r) => r.startedMs));
  const today = costaRicaToday(nowMs);
  const used = reads.filter((r) => r.manual && costaRicaToday(r.startedMs) === today).length;
  return {
    manualAvailableAt: nowMs - last < AIRBNB_MANUAL_WAIT_MS ? new Date(last + AIRBNB_MANUAL_WAIT_MS).toISOString() : null,
    manualLeftToday: Math.max(0, AIRBNB_MANUAL_PER_DAY - used),
  };
}

/** El texto bajo «Actualizar ahora» cuando está desactivado por el límite, o null si se puede. */
export function airbnbManualHint(summary: Pick<AirbnbSummary, "manualAvailableAt" | "manualLeftToday">, nowMs: number): string | null {
  if (summary.manualLeftToday === 0) return AIRBNB_LIMIT_MESSAGES.day;
  const at = summary.manualAvailableAt ? Date.parse(summary.manualAvailableAt) : NaN;
  return Number.isFinite(at) && at > nowMs ? AIRBNB_LIMIT_MESSAGES.wait(costaRicaClock(at)) : null;
}

/** Validación de respuestas externas, sin conversiones de tipos para confiar en JSON remoto. */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function readAirbnbSummary(value: unknown): AirbnbSummary {
  if (!isRecord(value) || typeof value.connected !== "boolean" ||
    !["none", "connected", "running", "error", "suspended"].includes(String(value.state)) ||
    !(value.lastSuccessAt === null || typeof value.lastSuccessAt === "string" && Number.isFinite(Date.parse(value.lastSuccessAt))) ||
    !(value.errorCode === null || ["url", "calendar", "unsupported", "download", "timeout", "size"].includes(String(value.errorCode))) ||
    typeof value.nights !== "number" || !Number.isInteger(value.nights) || value.nights < 0 || value.nights > 366 ||
    !(value.exportGenerated === undefined || typeof value.exportGenerated === "boolean") ||
    !(value.lastErrorAt === undefined || value.lastErrorAt === null || typeof value.lastErrorAt === "string" && Number.isFinite(Date.parse(value.lastErrorAt))) ||
    !(value.manualAvailableAt === undefined || value.manualAvailableAt === null || typeof value.manualAvailableAt === "string" && Number.isFinite(Date.parse(value.manualAvailableAt))) ||
    !(value.manualLeftToday === undefined || typeof value.manualLeftToday === "number" && Number.isInteger(value.manualLeftToday) && value.manualLeftToday >= 0 && value.manualLeftToday <= AIRBNB_MANUAL_PER_DAY)) throw new Error("Respuesta de calendario no válida.");
  // Los predicados de valores discriminados se comprueban de nuevo para estrechar sin casts.
  const state = value.state;
  const error = value.errorCode;
  if (state !== "none" && state !== "connected" && state !== "running" && state !== "error" && state !== "suspended") throw new Error("Estado de calendario no válido.");
  if (error !== null && error !== "url" && error !== "calendar" && error !== "unsupported" && error !== "download" && error !== "timeout" && error !== "size") throw new Error("Error de calendario no válido.");
  return { connected: value.connected, state, lastSuccessAt: value.lastSuccessAt, errorCode: error, nights: value.nights,
    ...(typeof value.exportGenerated === "boolean" ? { exportGenerated: value.exportGenerated } : {}),
    ...(value.lastErrorAt === null || typeof value.lastErrorAt === "string" ? { lastErrorAt: value.lastErrorAt } : {}),
    ...(value.manualAvailableAt === null || typeof value.manualAvailableAt === "string" ? { manualAvailableAt: value.manualAvailableAt } : {}),
    ...(typeof value.manualLeftToday === "number" ? { manualLeftToday: value.manualLeftToday } : {}) };
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
