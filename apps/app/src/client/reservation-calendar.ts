// Preparación de la hoja de reservas. No abre otra vía de importación ni programa trabajos.
import type { QueryClient } from "@tanstack/react-query";
import type { AirbnbSummary } from "../domain/airbnb";
import { DomainError, toDomainError } from "../domain/errors";
import { airbnbApi, airbnbQuery } from "./airbnb";
import { calendarApi, calendarQuery } from "./calendar-days";
import { sessionState } from "./session";

const RECENT_MS = 60_000;
const WARNING = "No pudimos actualizar Airbnb. Puede continuar con el último calendario válido; confirme la disponibilidad antes de marcar la reserva.";

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
      if (data.state === "running") throw new DomainError("La importación sigue en curso.", "conflict");
      return data;
    };
    const wasRunning = summary.state === "running";
    summary = await settle(summary);
    imported = wasRunning && !summary.errorCode;
    if (summary.state === "suspended") throw new DomainError("Esta casa no permite actualizar el calendario.", "forbidden");
    const age = summary.lastSuccessAt ? Date.now() - Date.parse(summary.lastSuccessAt) : Infinity;
    if (summary.connected && !wasRunning && (summary.errorCode || age < 0 || age >= RECENT_MS)) {
      try {
        summary = await api.refresh(listingId, crypto.randomUUID());
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
    warning ??= "No pudimos comprobar los cambios del calendario. Puede continuar con la última disponibilidad guardada; confirme las fechas antes de marcar la reserva.";
  }
  current();
  if (imported) {
    for (const queryKey of [["listing", publicId], ["listing-days", publicId], ["listings"]]) void client.invalidateQueries({ queryKey });
  }
  return { warning };
}
