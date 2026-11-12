// La consulta de las casas propias, en el JS inicial: la barra de pestañas y la llegada tras ingresar dependen de cuántas casas
// hay. La lectura en sí (supabase-js y el resto de la zona del propietario) se carga al pedirla, desde ./owner; por eso
// este módulo no lo importa de forma estática. Mientras la lista no llega, decide la pista guardada en el teléfono.
import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
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

/** Mis casas leída en esta visita a la app (no la restaurada del teléfono, ni una pendiente de releer) y sin ningún borrador
 *  pendiente: «+» puede entrar al paso 1 sin preguntar antes a la base (publish/new-draft.ts). Con un borrador en la lista
 *  se lee de nuevo, porque pudo enviarse o descartarse en otro teléfono (ronda de Ana 2026-11-02). */
export function knownNoDraft(client: QueryClient, userId: string): boolean {
  const s = client.getQueryState<Listing[]>(ownListingsKey(userId));
  if (!userId || !s?.data || s.isInvalidated || s.dataUpdatedAt < performance.timeOrigin) return false;
  return !s.data.some((l) => l.status === "draft" && l.reviewedAt === null);
}
