// Mutaciones de la edición de una casa publicada (spec .scratch/editar-casa). Los datos inmediatos (capacidad,
// características, precio) se pintan al momento en la lista y en el detalle y vuelven atrás si la base los rechaza; los
// que pasan por revisión van a revisión al guardarse, cada uno con su estado, en la edición de la casa (`Listing.edit`), y
// la caché toma la que devuelve la base.
import { useMutation, useQueryClient, type QueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type { EditPatch, ListingEdit, LivePatch, ReviewedField } from "../domain/edit";
import type { Listing } from "../domain/listing";
import { toDomainError } from "../domain/errors";
import { toast } from "../shared/toast";
import { useEditor, type EditorListings } from "./editor-port";
import { api } from "./owner";
import { cachedOwnListing, invalidateOwn, patchCached, refresh } from "./listing-cache";
import { ownListingKey, ownListingsKey } from "./listing-keys";

type Target = Pick<Listing, "id" | "publicId">;
type LiveContext = { previous: Listing | null | undefined };

/** Las opciones de useUpdateLive, aparte para probar la caché sin React. `listings`: el adaptador del puerto (el del
 *  anfitrión o, en las rutas del admin, el de Ana). */
export function updateLiveOptions(client: QueryClient, userId: string, l: Target, listings: () => Promise<EditorListings> = api): UseMutationOptions<void, Error, LivePatch, LiveContext> {
  return {
    mutationFn: async (patch) => (await listings()).updateLive(l.id, patch),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: ownListingKey(userId, l.id) });
      await client.cancelQueries({ queryKey: ownListingsKey(userId) });
      const previous = cachedOwnListing(client, userId, l.id);
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
  return useMutation(updateLiveOptions(client, userId, l, useEditor().listings));
}

/** Nombre, tipo, ubicación o descripción: a revisión, en la edición de la casa (null si ya no cambia nada). */
export function useSaveEdit(userId: string, l: Target) {
  const client = useQueryClient();
  const { listings, admin } = useEditor();
  return useMutation<ListingEdit | null, Error, EditPatch>({
    mutationFn: async (patch) => (await listings()).saveEdit(l.id, patch),
    onSuccess: (edit) => patchCached(client, userId, l.id, { edit }),
    // Lo que guarda el admin ya se ve en la ficha pública: se relee también lo público.
    onSettled: () => (admin ? refresh(client, userId, l) : invalidateOwn(client, userId, l.id)),
  });
}

const cachedEdit = (client: QueryClient, userId: string, id: string): ListingEdit | null =>
  cachedOwnListing(client, userId, id)?.edit ?? null;

/** «Descartar» un dato pendiente (revisión por dato, A5): sale de la ficha editable al momento; la ficha pública sigue igual. */
export function useDiscardEditField(userId: string, l: Target) {
  const client = useQueryClient();
  return useMutation<void, Error, ReviewedField, { edit: ListingEdit | null }>({
    mutationFn: async (field) => (await api()).discardEditField(l.id, field),
    onMutate: (field) => {
      const edit = cachedEdit(client, userId, l.id);
      if (!edit) return { edit };
      const fields = { ...edit.fields };
      delete fields[field];
      const cleared = field === "nombre" ? { title: null } : field === "descripcion" ? { description: null } : field === "tipo" ? { kind: null, bathroomShared: null } : { location: null };
      const next = { ...edit, ...cleared, fields };
      patchCached(client, userId, l.id, { edit: Object.keys(fields).length || next.photos.length ? next : null });
      return { edit };
    },
    // La fila ya se fue: vuelve, y el aviso de la base sale en un toast.
    onError: (error, _field, context) => {
      if (context) patchCached(client, userId, l.id, { edit: context.edit });
      toast(toDomainError(error).message);
    },
    onSettled: () => invalidateOwn(client, userId, l.id),
  });
}
