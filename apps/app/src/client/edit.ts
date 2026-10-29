// Mutaciones de la edición de una casa publicada (spec .scratch/editar-casa). Los datos inmediatos (capacidad,
// características, precio) se pintan al momento en la lista y en el detalle y vuelven atrás si la base los rechaza; los
// que pasan por revisión se guardan en la edición de la casa (`Listing.edit`) y la caché toma la que devuelve la base.
import { useMutation, useQueryClient, type QueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type { EditPatch, ListingEdit, LivePatch } from "../domain/edit";
import type { Listing } from "../domain/listing";
import { api, ownListingsQuery, patchCached, refresh } from "./owner";

type Target = Pick<Listing, "id" | "publicId">;
type LiveContext = { previous: Listing | null | undefined };

const detailKey = (userId: string, id: string) => ["own-listing", userId, id] as const;

/** Las opciones de useUpdateLive, aparte para probar la caché sin React. */
export function updateLiveOptions(client: QueryClient, userId: string, l: Target): UseMutationOptions<void, Error, LivePatch, LiveContext> {
  return {
    mutationFn: async (patch) => (await api()).updateLive(l.id, patch),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: detailKey(userId, l.id) });
      await client.cancelQueries({ queryKey: ["own-listings", userId] });
      const previous =
        client.getQueryData<Listing | null>(detailKey(userId, l.id)) ?? client.getQueryData<Listing[]>(ownListingsQuery(userId).queryKey)?.find((x) => x.id === l.id);
      patchCached(client, userId, l.id, patch);
      return { previous };
    },
    onError: (_error, patch, context) => {
      const previous = context?.previous;
      if (!previous) return;
      // Solo las columnas que tocó este cambio: otro guardado a la vez no se pisa.
      const back = Object.fromEntries(Object.keys(patch).map((k) => [k, previous[k as keyof Listing]])) as Partial<Listing>;
      patchCached(client, userId, l.id, back);
    },
    onSettled: () => refresh(client, userId, l),
  };
}

/** Capacidad, características o precio: se ven al momento en la ficha. */
export function useUpdateLive(userId: string, l: Target) {
  const client = useQueryClient();
  return useMutation(updateLiveOptions(client, userId, l));
}

const invalidateOwn = (client: QueryClient, userId: string, id: string) => {
  void client.invalidateQueries({ queryKey: ["own-listings", userId] });
  void client.invalidateQueries({ queryKey: detailKey(userId, id) });
};

/** Nombre, tipo, ubicación o descripción: a la edición de la casa (null si ya no cambia nada). */
export function useSaveEdit(userId: string, l: Target) {
  const client = useQueryClient();
  return useMutation<ListingEdit | null, Error, EditPatch>({
    mutationFn: async (patch) => (await api()).saveEdit(l.id, patch),
    onSuccess: (edit) => patchCached(client, userId, l.id, { edit }),
    onSettled: () => invalidateOwn(client, userId, l.id),
  });
}

const cachedEdit = (client: QueryClient, userId: string, id: string): ListingEdit | null =>
  (client.getQueryData<Listing | null>(detailKey(userId, id)) ?? client.getQueryData<Listing[]>(ownListingsQuery(userId).queryKey)?.find((x) => x.id === id))?.edit ?? null;

/** «Enviar a revisión». */
export function useSubmitEdit(userId: string, l: Target) {
  const client = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => (await api()).submitEdit(l.id),
    onSuccess: () => {
      const edit = cachedEdit(client, userId, l.id);
      if (edit) patchCached(client, userId, l.id, { edit: { ...edit, status: "review", reviewNote: null } });
    },
    onSettled: () => invalidateOwn(client, userId, l.id),
  });
}

/** «Descartar cambios»: la ficha sigue como está. */
export function useDiscardEdit(userId: string, l: Target) {
  const client = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => (await api()).discardEdit(l.id),
    onSuccess: () => patchCached(client, userId, l.id, { edit: null }),
    onSettled: () => invalidateOwn(client, userId, l.id),
  });
}
