// Consultas de Explorar y Filtros. La ficha usa listingQuery (src/shared), sembrada con la fila de la tarjeta.
import { infiniteQueryOptions, keepPreviousData, queryOptions, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { parseFilters, type Filters } from "../../domain/filters";
import type { PublicListing, SearchCursor, SearchListing, SearchPage } from "../../domain/listing";
import { DomainError } from "../../domain/errors";

const api = async () => (await import("../../shared/supabase-data")).publicListings();

export const listingsQuery = (f: Filters) => {
  // «Más filtros» abierto no cambia los resultados (misma caché). Sin `monthly` ni `monthlyFrom` desde el fin del modo
  // mensual: las entradas persistidas de antes (sin el total de la estancia) tienen otra clave y no se reutilizan.
  const { open: _open, ...key } = f;
  // Por páginas de 60 («Ver más casas»): cada página trae el cursor de la siguiente (`next`, null si no quedan).
  return infiniteQueryOptions({
    queryKey: ["listings", key] as const,
    queryFn: async ({ pageParam }) => (await api()).searchPublic(f, pageParam),
    initialPageParam: null as SearchCursor | null,
    getNextPageParam: (page: SearchPage) => page.next,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    // Fechas que la base rechaza (p. ej. un enlace viejo con la llegada ya pasada): no se reintenta.
    retry: (count, error) => !isDatesError(error) && count < 3,
  });
};

/** Las casas de todas las páginas ya cargadas, en orden. */
export const loadedListings = (data: InfiniteData<SearchPage> | undefined): SearchListing[] | undefined => data?.pages.flatMap((p) => p.listings);

/** search_listings lanza «Revise las fechas.» (P0001) si el rango no vale: Explorar ofrece quitar las fechas. */
export const isDatesError = (error: unknown): boolean => error instanceof DomainError && error.kind === "validation" && error.message === "Revise las fechas.";

export const provincesQuery = queryOptions({
  queryKey: ["provinces"] as const,
  queryFn: async () => (await api()).provincesWithListings(),
  staleTime: 10 * 60_000,
});

export const zoneListingsQuery = (zone: string | null) => ({
  ...listingsQuery({ ...parseFilters({}, []), zone }),
  enabled: !!zone,
  placeholderData: undefined,
});

/** Zonas con casas para «¿Dónde?» (zones_with_listings). */
export const zonesQuery = queryOptions({
  queryKey: ["zones-with-listings"] as const,
  queryFn: async () => (await api()).zonesWithListings(),
  staleTime: 10 * 60_000,
});

/** La casa tal como llegó en algún listado ya cargado, para pintar la ficha antes de su propia petición. */
export function listingSeed(client: QueryClient, publicId: string): { listing: PublicListing; updatedAt: number } | undefined {
  for (const query of client.getQueryCache().findAll({ queryKey: ["listings"] })) {
    const listing = loadedListings(query.state.data as InfiniteData<SearchPage> | undefined)?.find((l) => l.publicId === publicId);
    if (listing) return { listing, updatedAt: query.state.dataUpdatedAt };
  }
  return undefined;
}
