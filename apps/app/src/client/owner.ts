// Consultas y acciones de la zona del propietario. Mis casas se persiste en el dispositivo mientras dure la sesión
// (clave privada, ver account.ts y persist.ts): Mis casas y Actividad se pintan al instante desde la caché y se refrescan
// por detrás (30 s, al volver a la app y al recuperar la red). El detalle se siembra con la fila de la lista.
import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { ListingActivity, OwnerListingsApi, PhotosApi, PlacesApi } from "../domain/api";
import type { Listing } from "../domain/listing";
import { rememberOwnListings } from "../shared/own-listings";
import { billingQuery } from "./billing";
import { OWNER_STALE_MS, ownListingsQuery } from "./own-listings-query";
import { allSavesSettled, savesSettled } from "./save-queue";
import { authApi } from "./session";

// La consulta de la lista vive en el JS inicial (la barra de pestañas cuenta las casas); los importadores de siempre la toman de aquí.
export { ownListingsQuery, OWNER_STALE_MS } from "./own-listings-query";

/** Carga supabase-js con la sesión ya leída antes de pedir datos del propietario. */
let loaded: OwnerListingsApi | null = null;
export const api = async (): Promise<OwnerListingsApi> => {
  await authApi();
  return (loaded = (await import("./supabase-data")).ownerListings());
};
/** El adaptador si ya está cargado (sin esperar): el asistente lo usa para que un guardado salga en el mismo tick. */
export const loadedApi = (): OwnerListingsApi | null => loaded;

/** Fotos (subida directa a Storage y RPCs), con la misma sesión. */
export const photosApi = async (): Promise<PhotosApi> => {
  await authApi();
  return (await import("./supabase-data")).photosApi();
};

/** Lugar del pin y zonas (place_at, zones_near, zones), con la misma sesión. */
export const places = async (): Promise<PlacesApi> => {
  await authApi();
  return (await import("./supabase-data")).placesApi();
};

/** La lectura de Mis casas (la consulta está en own-listings-query.ts, que la carga al pedirla). */
export async function fetchOwnListings(): Promise<Listing[]> {
  await allSavesSettled(); // una lista leída a mitad de un guardado del asistente pisaría lo recién escrito
  const list = await (await api()).listOwn();
  rememberOwnListings(list.map((l) => l.publicId)); // la ficha no cuenta las visitas del dueño (revisión UX A2)
  return list;
}

/** Visitas, toques en WhatsApp y consultas de 30 días de todas las casas propias (Actividad). */
export const activityQuery = (userId: string) =>
  queryOptions({
    queryKey: ["own-activity", userId] as const,
    queryFn: async (): Promise<ListingActivity[]> => (await api()).ownerActivity(),
    staleTime: OWNER_STALE_MS,
  });

/** Visitas y consultas de 30 días de una casa (revisión UX A2). */
export const listingStatsQuery = (userId: string, id: string) =>
  queryOptions({
    queryKey: ["own-stats", userId, id] as const,
    queryFn: async () => (await api()).stats(id),
    staleTime: OWNER_STALE_MS,
  });

export const ownListingQuery = (userId: string, id: string, client: QueryClient) => {
  const list = client.getQueryState(ownListingsQuery(userId).queryKey);
  return queryOptions({
    queryKey: ["own-listing", userId, id] as const,
    queryFn: async () => {
      await savesSettled(id);
      return (await api()).getOwn(id);
    },
    staleTime: OWNER_STALE_MS,
    initialData: () => (list?.data as Listing[] | undefined)?.find((l) => l.id === id),
    initialDataUpdatedAt: list?.dataUpdatedAt,
  });
};

/** Plazas asignadas de la oferta de lanzamiento (lectura pública, launch_offer_taken). Si la RPC falla (un despliegue
 *  antes de la migración de la fase 5, un error pasajero), las casas activas, como antes. */
export const offerTakenQuery = queryOptions({
  queryKey: ["offer-taken"] as const,
  queryFn: async () => {
    const listings = (await import("./supabase-data")).publicListings();
    return listings.offerTaken().catch(() => listings.countActive());
  },
  staleTime: 5 * 60_000,
});

/** El borrador pendiente para retomar (pantalla de entrada a publicar). Siempre se pide de nuevo: puede venir de otro dispositivo. */
export const resumableQuery = (userId: string) =>
  queryOptions({
    queryKey: ["own-resumable", userId] as const,
    queryFn: async () => {
      await allSavesSettled();
      return (await api()).findResumable();
    },
    staleTime: 0,
  });

/** Cambia una casa en la lista y en su detalle a la vez (escrituras optimistas). */
export function patchCached(client: QueryClient, userId: string, id: string, patch: Partial<Listing>) {
  client.setQueryData<Listing[]>(ownListingsQuery(userId).queryKey, (list) => list?.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  client.setQueryData<Listing | null>(["own-listing", userId, id], (l) => (l ? { ...l, ...patch } : l));
}

/** Una casa recién creada, al principio de la lista ya leída (si la hay), para que la barra crezca al instante. */
export function addOwnCached(client: QueryClient, userId: string, l: Listing) {
  client.setQueryData<Listing[]>(ownListingsQuery(userId).queryKey, (list) => (list && !list.some((x) => x.id === l.id) ? [l, ...list] : list));
}

/** Tras cualquier cambio: la lista, el detalle y lo que el público ve de esa casa vuelven a pedirse. */
export function refresh(client: QueryClient, userId: string, l: Pick<Listing, "id" | "publicId">) {
  void client.invalidateQueries({ queryKey: ["own-listings", userId] });
  void client.invalidateQueries({ queryKey: ["own-listing", userId, l.id] });
  void client.invalidateQueries({ queryKey: ["listing", l.publicId] });
  void client.invalidateQueries({ queryKey: ["listings"] });
  void client.invalidateQueries({ queryKey: ["offer-taken"] });
  void client.invalidateQueries({ queryKey: billingQuery(userId).queryKey });
}

/** Abrir (borra la fecha de reapertura) o cerrar a consultas con una fecha opcional. */
export type AvailabilityChange = { available: true } | { available: false; reopenAt: string | null };

/** «Cerrar la casa hasta…» / «Abrir la casa» del Calendario: responde al instante y vuelve atrás si la base lo rechaza. */
export function useSetAvailable(userId: string, listing: Pick<Listing, "id" | "publicId">) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (c: AvailabilityChange) => (await api()).setAvailable(listing.id, c.available, c.available ? null : c.reopenAt),
    onMutate: async (c) => {
      await client.cancelQueries({ queryKey: ["own-listings", userId] });
      await client.cancelQueries({ queryKey: ["own-listing", userId, listing.id] });
      const before = client.getQueryData<Listing | null>(["own-listing", userId, listing.id]);
      patchCached(client, userId, listing.id, { available: c.available, reopenAt: c.available ? null : c.reopenAt });
      return { previous: { available: !c.available, reopenAt: before?.reopenAt ?? null } };
    },
    onError: (_error, _c, context) => {
      if (context) patchCached(client, userId, listing.id, context.previous);
    },
    onSettled: () => refresh(client, userId, listing),
  });
}

/** Descartar un borrador que nunca se envió. */
export function useDeleteDraft(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api()).deleteDraft(id),
    onSuccess: (_void, id) => {
      client.setQueryData<Listing[]>(ownListingsQuery(userId).queryKey, (list) => list?.filter((l) => l.id !== id));
      client.removeQueries({ queryKey: ["own-listing", userId, id] });
    },
    onSettled: () => void client.invalidateQueries({ queryKey: ["own-listings", userId] }),
  });
}
