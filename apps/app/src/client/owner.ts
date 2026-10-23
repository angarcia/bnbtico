// Consultas y acciones de la zona del propietario. Mis casas se persiste en el dispositivo mientras dure la sesión
// (clave privada, ver account.ts y persist.ts): Inicio y Mis casas se pintan al instante desde la caché y se refrescan
// por detrás (30 s, al volver a la app y al recuperar la red). El detalle se siembra con la fila de la lista.
import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { OwnerListingsApi } from "../domain/api";
import type { Listing } from "../domain/listing";
import { allSavesSettled, savesSettled } from "./save-queue";
import { authApi } from "./session";

export const OWNER_STALE_MS = 30_000;

/** Carga supabase-js con la sesión ya leída antes de pedir datos del propietario. */
export const api = async (): Promise<OwnerListingsApi> => {
  await authApi();
  return (await import("./supabase-data")).ownerListings();
};

export const ownListingsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["own-listings", userId] as const,
    queryFn: async () => {
      await allSavesSettled(); // una lista leída a mitad de un guardado del asistente pisaría lo recién escrito
      return (await api()).listOwn();
    },
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

/** Casas activas de todo el catálogo: plazas ocupadas de la oferta de lanzamiento (lectura pública). */
export const activeCountQuery = queryOptions({
  queryKey: ["active-count"] as const,
  queryFn: async () => (await import("./supabase-data")).publicListings().countActive(),
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

/** Tras cualquier cambio: la lista, el detalle y lo que el público ve de esa casa vuelven a pedirse. */
export function refresh(client: QueryClient, userId: string, l: Pick<Listing, "id" | "publicId">) {
  void client.invalidateQueries({ queryKey: ["own-listings", userId] });
  void client.invalidateQueries({ queryKey: ["own-listing", userId, l.id] });
  void client.invalidateQueries({ queryKey: ["listing", l.publicId] });
  void client.invalidateQueries({ queryKey: ["listings"] });
  void client.invalidateQueries({ queryKey: ["active-count"] });
}

/** «Disponible para consultas»: responde al instante y vuelve atrás si la base lo rechaza. */
export function useSetAvailable(userId: string, listing: Pick<Listing, "id" | "publicId">) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (available: boolean) => (await api()).setAvailable(listing.id, available),
    onMutate: async (available) => {
      await client.cancelQueries({ queryKey: ["own-listings", userId] });
      await client.cancelQueries({ queryKey: ["own-listing", userId, listing.id] });
      patchCached(client, userId, listing.id, { available });
      return { previous: !available };
    },
    onError: (_error, _available, context) => {
      if (context) patchCached(client, userId, listing.id, { available: context.previous });
    },
    onSettled: () => refresh(client, userId, listing),
  });
}

/** Editar una casa activa (o con cambios pedidos, o rechazada): vuelve a borrador. */
export function useReopen(userId: string, listing: Pick<Listing, "id" | "publicId">) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api()).reopenForEdit(listing.id),
    onSuccess: () => patchCached(client, userId, listing.id, { status: "draft" }),
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
