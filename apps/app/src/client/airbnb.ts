import { randomUuid } from "../shared/random-uuid";
import { onlineManager, queryOptions, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { authApi } from "./session";
import { DomainError, toDomainError } from "../domain/errors";
import { toast } from "../shared/toast";

const subscribeOnline = (listener: () => void) => onlineManager.subscribe(listener);
const onlineSnapshot = () => onlineManager.isOnline();
export const useCalendarOnline = () => useSyncExternalStore(subscribeOnline, onlineSnapshot);

export async function airbnbApi() {
  await authApi();
  return (await import("./supabase-data")).airbnbApi();
}

export const airbnbQuery = (userId: string, listingId: string) => queryOptions({
  queryKey: ["airbnb", userId, listingId] as const,
  queryFn: async () => (await airbnbApi()).overview(listingId),
  staleTime: 30_000,
  refetchInterval: query => query.state.data?.state === "running" ? 1500 : false,
});

export async function refreshAirbnbCalendar(client: QueryClient, userId: string, listingId: string, publicId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["airbnb", userId, listingId] }),
    client.invalidateQueries({ queryKey: ["calendar", userId, listingId] }),
    client.invalidateQueries({ queryKey: ["listing-days", publicId] }),
    client.invalidateQueries({ queryKey: ["listing", publicId] }),
    client.invalidateQueries({ queryKey: ["listings"] }),
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
    if (!data.connected || data.errorCode) throw new DomainError("No pudimos completar la actualización. Revise el estado.", "validation");
    request.current = randomUuid();
    await refreshAirbnbCalendar(client, userId, listingId, publicId);
    if (current()) toast("Calendario actualizado");
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
