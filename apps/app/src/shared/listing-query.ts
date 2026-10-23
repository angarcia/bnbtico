import { queryOptions } from "@tanstack/react-query";

export const LISTING_STALE_MS = 5 * 60_000;

export const listingQuery = (publicId: string) =>
  queryOptions({
    queryKey: ["listing", publicId] as const,
    queryFn: async () => (await import("../client/supabase-data")).publicListings().getPublic(publicId),
    staleTime: LISTING_STALE_MS,
  });
