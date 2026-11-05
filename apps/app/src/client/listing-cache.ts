import type { QueryClient } from "@tanstack/react-query";
import type { Listing } from "../domain/listing";
import { billingQuery } from "./billing";
import { adminEditKey, adminEditsKey, adminHousesKey, adminListingKey, adminQueueKey, listingsKey, offerTakenKey, ownListingKey, ownListingsKey, publicListingKey } from "./listing-keys";

type Target = Pick<Listing, "id" | "publicId">;

export const cachedOwnListing = (client: QueryClient, userId: string, id: string) =>
  client.getQueryData<Listing | null>(ownListingKey(userId, id)) ?? client.getQueryData<Listing[]>(ownListingsKey(userId))?.find((l) => l.id === id);

/** Cambia una casa en la lista y en su detalle a la vez (escrituras optimistas). */
export function patchCached(client: QueryClient, userId: string, id: string, patch: Partial<Listing>) {
  client.setQueryData<Listing[]>(ownListingsKey(userId), (list) => list?.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  client.setQueryData<Listing | null>(ownListingKey(userId, id), (l) => (l ? { ...l, ...patch } : l));
}

/** Una casa recién creada, al principio de la lista ya leída (si la hay), para que la barra crezca al instante. */
export function addOwnCached(client: QueryClient, userId: string, l: Listing) {
  client.setQueryData<Listing[]>(ownListingsKey(userId), (list) => (list && !list.some((x) => x.id === l.id) ? [l, ...list] : list));
}

export function removeOwnCached(client: QueryClient, userId: string, id: string) {
  client.setQueryData<Listing[]>(ownListingsKey(userId), (list) => list?.filter((l) => l.id !== id));
  client.removeQueries({ queryKey: ownListingKey(userId, id) });
}

export function invalidateOwn(client: QueryClient, userId: string, id: string) {
  void client.invalidateQueries({ queryKey: ownListingsKey(userId) });
  void client.invalidateQueries({ queryKey: ownListingKey(userId, id) });
}

function refreshPublic(client: QueryClient, publicId: string) {
  void client.invalidateQueries({ queryKey: publicListingKey(publicId) });
  void client.invalidateQueries({ queryKey: listingsKey });
}

/** Tras cualquier cambio: la lista, el detalle y lo que el público ve de esa casa vuelven a pedirse. */
export function refresh(client: QueryClient, userId: string, l: Target) {
  invalidateOwn(client, userId, l.id);
  refreshPublic(client, l.publicId);
  void client.invalidateQueries({ queryKey: offerTakenKey });
  void client.invalidateQueries({ queryKey: billingQuery(userId).queryKey });
}

export function refreshAdminReview(client: QueryClient, userId: string, l: Target) {
  void client.invalidateQueries({ queryKey: adminQueueKey(userId) });
  void client.invalidateQueries({ queryKey: adminListingKey(userId, l.id) });
  refreshPublic(client, l.publicId);
  void client.invalidateQueries({ queryKey: offerTakenKey });
  void client.invalidateQueries({ queryKey: adminHousesKey(userId) });
}

export function refreshAdminHouse(client: QueryClient, userId: string, publicId: string) {
  void client.invalidateQueries({ queryKey: adminHousesKey(userId) });
  void client.invalidateQueries({ queryKey: adminQueueKey(userId) });
  refreshPublic(client, publicId);
  void client.invalidateQueries({ queryKey: offerTakenKey });
}

export function refreshAdminEdit(client: QueryClient, userId: string, l: Target) {
  void client.invalidateQueries({ queryKey: adminEditsKey(userId) });
  void client.invalidateQueries({ queryKey: adminEditKey(userId, l.id) });
  refreshPublic(client, l.publicId);
  void client.invalidateQueries({ queryKey: adminHousesKey(userId) });
}
