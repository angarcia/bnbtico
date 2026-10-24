import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { CalendarDay } from "../domain/calendar";
import type { PublicListing } from "../domain/listing";

export const LISTING_STALE_MS = 5 * 60_000;
export const LISTING_DAYS_STALE_MS = 60_000;

const api = async () => (await import("../client/supabase-data")).publicListings();

export const listingQuery = (publicId: string) =>
  queryOptions({
    queryKey: ["listing", publicId] as const,
    queryFn: async () => (await api()).getPublic(publicId),
    staleTime: LISTING_STALE_MS,
  });

/** Ocupados y precios especiales de la ficha (hoy … +365). El calendario del propietario la invalida al guardar. */
export const listingDaysQuery = (publicId: string) =>
  queryOptions({
    queryKey: ["listing-days", publicId] as const,
    queryFn: async (): Promise<CalendarDay[]> => (await api()).getPublicDays(publicId),
    staleTime: LISTING_DAYS_STALE_MS,
  });

/** La caché de Query con lo que trajo el worker: hidratar no vuelve a pedir la casa ni sus días. */
export function seedListing(client: QueryClient, listing: PublicListing, days: CalendarDay[]): void {
  client.setQueryData(listingQuery(listing.publicId).queryKey, listing);
  client.setQueryData(listingDaysQuery(listing.publicId).queryKey, days);
}
