// Preparación de la hoja de reservas. No abre otra vía de importación ni programa trabajos.
import { randomUuid } from "../../../shared/random-uuid";
import type { QueryClient } from "@tanstack/react-query";
import { airbnbManualHint, type AirbnbSummary } from "../../../domain/airbnb";
import { DomainError, toDomainError } from "../../../domain/errors";
import { airbnbApi, airbnbQuery } from "./airbnb-queries";
import { calendarApi, calendarQuery } from "./calendar-days";
import { sessionState } from "../../comun/session";
import * as RESERVATION_COPY from "./copy/reservation-calendar";

const RECENT_MS = 60_000;
const WARNING = RESERVATION_COPY.airbnbStale;

export async function prepareReservationCalendar(client: QueryClient, userId: string, listingId: string, publicId: string, signal: AbortSignal): Promise<{ warning: string | null }> {
  const current = () => {
    if (signal.aborted || sessionState().session?.userId !== userId) throw new DOMException("Operación cancelada", "AbortError");
  };
  const overviewOptions = airbnbQuery(userId, listingId);
  const daysOptions = calendarQuery(userId, listingId);
  let warning: string | null = null;
  let imported = false;
  const api = await airbnbApi();
  current();
  const overview = async () => {
    const data = await api.overview(listingId);
    current();
    client.setQueryData(overviewOptions.queryKey, data);
    return data;
  };
  const wait = () => new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException("Operación cancelada", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 750);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
  try {
    let summary = await overview();
    const deadline = Date.now() + 25_000;
    const settle = async (data: AirbnbSummary) => {
      while (data.state === "running" && Date.now() < deadline) { await wait(); current(); data = await overview(); }
      if (data.state === "running") throw new DomainError(RESERVATION_COPY.importRunning, "conflict");
      return data;
    };
    const wasRunning = summary.state === "running";
    summary = await settle(summary);
    imported = wasRunning && !summary.errorCode;
    if (summary.state === "suspended") throw new DomainError(RESERVATION_COPY.refreshForbidden, "forbidden");
    const age = summary.lastSuccessAt ? Date.now() - Date.parse(summary.lastSuccessAt) : Infinity;
    // Con el límite manual (2026-11-17) no se lee: vale la última lectura, de hace 15 minutos como mucho.
    const limited = airbnbManualHint(summary, Date.now()) !== null;
    if (summary.connected && !wasRunning && !limited && (summary.errorCode || age < 0 || age >= RECENT_MS)) {
      try {
        summary = await api.refresh(listingId, randomUuid());
        current();
        client.setQueryData(overviewOptions.queryKey, summary);
      } catch (error) {
        current();
        // Otra pestaña pudo reservar la conexión entre el resumen y la petición.
        if (toDomainError(error).kind !== "conflict") throw error;
        summary = await overview();
        if (summary.state !== "running") throw error;
      }
      summary = await settle(summary);
      imported = !summary.errorCode;
    }
    if (summary.connected && summary.errorCode) warning = WARNING;
  } catch (error) {
    current();
    const kind = toDomainError(error).kind;
    if (kind === "session" || kind === "forbidden") throw error;
    warning = WARNING;
    await overview().catch(() => {});
  }
  // Cancelar la lectura anterior impide que una respuesta de antes de importar vuelva a sobrescribir la instantánea.
  current();
  await client.cancelQueries({ queryKey: daysOptions.queryKey });
  current();
  try {
    const days = await (await calendarApi()).days(listingId);
    current();
    client.setQueryData(daysOptions.queryKey, days);
  } catch (error) {
    current();
    if (toDomainError(error).kind !== "network" || client.getQueryData(daysOptions.queryKey) === undefined) throw error;
    warning ??= RESERVATION_COPY.daysStale;
  }
  current();
  if (imported) {
    for (const queryKey of [["listing", publicId], ["listing-days", publicId], ["listings"]]) void client.invalidateQueries({ queryKey });
  }
  return { warning };
}
