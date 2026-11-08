import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { authApi } from "./session";

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
