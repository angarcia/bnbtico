// Consultas de Explorar y Filtros. La ficha usa listingQuery (src/shared), sembrada con la fila de la tarjeta.
import { keepPreviousData, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { Filters } from "../domain/filters";
import type { PublicListing } from "../domain/listing";
import { DomainError } from "../domain/errors";

const api = async () => (await import("./supabase-data")).publicListings();

export const listingsQuery = (f: Filters) => {
  // «Más filtros» abierto no cambia los resultados (misma caché). Sin `monthly` ni `monthlyFrom` desde el fin del modo
  // mensual: las entradas persistidas de antes (sin el total de la estancia) tienen otra clave y no se reutilizan.
  const { open: _open, ...key } = f;
  return queryOptions({
    queryKey: ["listings", key] as const,
    queryFn: async () => (await api()).searchPublic(f),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    // Fechas que la base rechaza (p. ej. un enlace viejo con la llegada ya pasada): no se reintenta.
    retry: (count, error) => !isDatesError(error) && count < 3,
  });
};

/** search_listings lanza «Revise las fechas.» (P0001) si el rango no vale: Explorar ofrece quitar las fechas. */
export const isDatesError = (error: unknown): boolean => error instanceof DomainError && error.kind === "validation" && error.message === "Revise las fechas.";

export const provincesQuery = queryOptions({
  queryKey: ["provinces"] as const,
  queryFn: async () => (await api()).provincesWithListings(),
  staleTime: 10 * 60_000,
});

export const featuresWithListingsQuery = queryOptions({
  queryKey: ["features-with-listings"] as const,
  queryFn: async () => (await api()).featuresWithListings(),
  staleTime: 60_000,
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
    const listing = (query.state.data as PublicListing[] | undefined)?.find((l) => l.publicId === publicId);
    if (listing) return { listing, updatedAt: query.state.dataUpdatedAt };
  }
  return undefined;
}
