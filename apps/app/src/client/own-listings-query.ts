// La consulta de las casas propias, en el JS inicial: la barra de pestañas y la llegada tras ingresar dependen de cuántas casas
// hay. La lectura en sí (supabase-js y el resto de la zona del propietario) se carga al pedirla, desde ./owner; por eso
// este módulo no lo importa de forma estática. Mientras la lista no llega, decide la pista guardada en el teléfono.
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Listing } from "../domain/listing";
import { ownListingsHint } from "../shared/own-listings";
import { useSession } from "./session";
import { ownListingsKey } from "./listing-keys";

export const OWNER_STALE_MS = 30_000;

export const ownListingsQuery = (userId: string) =>
  queryOptions({
    queryKey: ownListingsKey(userId),
    queryFn: async (): Promise<Listing[]> => (await import("./owner")).fetchOwnListings(),
    staleTime: OWNER_STALE_MS,
  });

/** Cuántas casas tiene la sesión: la lista leída o, mientras no llega, la pista del teléfono (undefined si no hay ninguna). */
export function useListingsCount(): { count: number | undefined; fromData: boolean; fetching: boolean } {
  const userId = useSession().session?.userId;
  const { data, isFetching } = useQuery({ ...ownListingsQuery(userId ?? ""), enabled: !!userId, select: (l) => l.length });
  const hint = ownListingsHint();
  return { count: data ?? (hint > 0 ? hint : undefined), fromData: data !== undefined, fetching: isFetching };
}
