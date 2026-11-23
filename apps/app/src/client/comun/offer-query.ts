// Plazas tomadas de la oferta de lanzamiento: lo leen Suscripción, el asistente y las puertas para publicar de Explorar,
// Ingresar y Cuenta (revisión UX 2026-10-29, A8). En su propio módulo para que Explorar no cargue el de las casas propias.
import { queryOptions } from "@tanstack/react-query";
import { offerTakenKey } from "./listing-keys";

export const offerTakenQuery = queryOptions({
  queryKey: offerTakenKey,
  queryFn: async () => {
    const listings = (await import("../../shared/supabase-data")).publicListings();
    return listings.offerTaken().catch(() => listings.countActive());
  },
  staleTime: 5 * 60_000,
});
