import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { CalendarDay } from "../domain/calendar";
import type { FxRate } from "../domain/fx";
import type { PublicListing } from "../domain/listing";
import { seedFx } from "./fx";

export const LISTING_STALE_MS = 5 * 60_000;
export const LISTING_DAYS_STALE_MS = 60_000;

const api = async () => (await import("../client/supabase-data")).publicListings();

export const listingQuery = (publicId: string) =>
  queryOptions({
    queryKey: ["listing", publicId] as const,
    queryFn: async () => (await api()).getPublic(publicId),
    staleTime: LISTING_STALE_MS,
  });

/** Ocupados y precios especiales de la ficha (hoy … +365). El calendario del propietario la invalida al guardar. null =
 *  no se pudieron leer en el servidor: la ficha no muestra «Disponibilidad». Un solo reintento: si falla, la sección se
 *  quita pronto en vez de quedarse como caja vacía. */
export const listingDaysQuery = (publicId: string) =>
  queryOptions({
    queryKey: ["listing-days", publicId] as const,
    queryFn: async (): Promise<CalendarDay[] | null> => (await api()).getPublicDays(publicId),
    staleTime: LISTING_DAYS_STALE_MS,
    retry: 1,
  });

/** La caché de Query con lo que trajo el worker: hidratar no vuelve a pedir la casa, sus días ni el tipo de cambio. */
export function seedListing(client: QueryClient, listing: PublicListing, days: CalendarDay[] | null, fx: FxRate): void {
  seedFx(client, fx);
  client.setQueryData(listingQuery(listing.publicId).queryKey, listing);
  client.setQueryData(listingDaysQuery(listing.publicId).queryKey, days);
}
