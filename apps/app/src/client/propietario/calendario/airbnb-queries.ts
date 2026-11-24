import { randomUuid } from "../../../shared/random-uuid";
import { onlineManager, queryOptions, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { airbnbManualHint, type AirbnbSummary } from "../../../domain/airbnb";
import { authApi } from "../../comun/session";
import { DomainError, toDomainError } from "../../../domain/errors";
import { toast } from "../../../shared/toast";
import { airbnbKey, calendarKey, listingsKey } from "../../comun/listing-keys";
import { listingDaysKey, publicListingKey } from "../../../shared/listing-query";
import * as AIRBNB_ROW_COPY from "./copy/airbnb-row";

const subscribeOnline = (listener: () => void) => onlineManager.subscribe(listener);
const onlineSnapshot = () => onlineManager.isOnline();
export const useCalendarOnline = () => useSyncExternalStore(subscribeOnline, onlineSnapshot);

async function calendarData() {
  await authApi();
  return import("../../../shared/supabase-data");
}

export const airbnbApi = async () => (await calendarData()).airbnbApi();
export const icalExportApi = async () => (await calendarData()).icalExportApi();

export const airbnbQuery = (userId: string, listingId: string) => queryOptions({
  queryKey: airbnbKey(userId, listingId),
  queryFn: async () => (await airbnbApi()).overview(listingId),
  staleTime: 30_000,
  refetchInterval: query => query.state.data?.state === "running" ? 1500 : false,
});

export async function refreshAirbnbCalendar(client: QueryClient, userId: string, listingId: string, publicId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: airbnbKey(userId, listingId) }),
    client.invalidateQueries({ queryKey: calendarKey(userId, listingId) }),
    client.invalidateQueries({ queryKey: listingDaysKey(publicId) }),
    client.invalidateQueries({ queryKey: publicListingKey(publicId) }),
    client.invalidateQueries({ queryKey: listingsKey }),
  ]);
}

/** Una sola operación para la fila del calendario y la pantalla de gestión. Cada vista conserva su bloqueo local. */
export async function updateAirbnbCalendar(
  client: QueryClient, userId: string, listingId: string, publicId: string,
  request: { current: string }, current: () => boolean, onError: (message: string) => void,
) {
  try {
    const data = await (await airbnbApi()).refresh(listingId, request.current);
    if (!current()) return;
    client.setQueryData(airbnbQuery(userId, listingId).queryKey, data);
    if (data.state === "running") return;
    if (!data.connected || data.errorCode) throw new DomainError(AIRBNB_ROW_COPY.refreshFailed, "validation");
    request.current = randomUuid();
    await refreshAirbnbCalendar(client, userId, listingId, publicId);
    if (current()) toast(AIRBNB_ROW_COPY.refreshed);
  } catch (error) {
    if (!current()) return;
    const problem = toDomainError(error);
    if (problem.kind === "validation") request.current = randomUuid();
    onError(problem.message);
    try {
      const data = await (await airbnbApi()).overview(listingId);
      if (current()) client.setQueryData(airbnbQuery(userId, listingId).queryKey, data);
    } catch { /* El aviso anterior permanece si tampoco se puede reconciliar. */ }
  }
}

/**
 * El texto del límite manual (2026-11-17) mientras «Actualizar ahora» espera, o null si se puede. Cuando llega la hora,
 * un temporizador vuelve a pintar quien lo usa y el botón se reactiva solo.
 */
export function useAirbnbManualHint(summary: AirbnbSummary | undefined): string | null {
  const [, setTick] = useState(0);
  const availableAt = summary?.manualAvailableAt ? Date.parse(summary.manualAvailableAt) : NaN;
  useEffect(() => {
    const wait = availableAt - Date.now();
    if (!Number.isFinite(wait) || wait <= 0) return;
    const timer = setTimeout(() => setTick((n) => n + 1), wait + 500);
    return () => clearTimeout(timer);
  }, [availableAt]);
  return summary ? airbnbManualHint(summary, Date.now()) : null;
}
