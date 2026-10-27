// Tipo de cambio vigente en el navegador (ticket 21): una consulta pública de Query, persistida con las demás y con un
// staleTime largo (el cron lo cambia una vez al día). La ficha del servidor la siembra con el tipo que usó el worker.
import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { FX_INITIAL, type FxRate } from "../domain/fx";

export const FX_STALE_MS = 6 * 3_600_000;

const api = async () => (await import("../client/supabase-data")).publicListings();

export const fxQuery = queryOptions({
  queryKey: ["fx"] as const,
  queryFn: async (): Promise<FxRate> => (await api()).fxRate(),
  staleTime: FX_STALE_MS,
});

/** El tipo vigente; mientras llega la primera vez (o si no se puede leer), el inicial. `enabled: false` no lo pide, pero
 *  devuelve el que ya esté en la caché. */
export function useFx(enabled = true): FxRate {
  const { data } = useQuery({ ...fxQuery, enabled });
  return data ?? FX_INITIAL;
}

export function seedFx(client: QueryClient, rate: FxRate): void {
  client.setQueryData(fxQuery.queryKey, rate);
}
