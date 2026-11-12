// Reordenado optimista de fotos (paso 7): cancela lecturas en curso, pinta el orden nuevo, lo deshace si falla y relee al terminar.
import type { QueryClient } from "@tanstack/react-query";
import { DomainError } from "../../domain/errors";
import type { Listing } from "../../domain/listing";
import { applyOrder } from "../../domain/photo-order";

export const PHOTOS_ERROR = "No pudimos cambiar las fotos. Intente de nuevo.";

/** Copy for the alert: a DomainError with a known kind keeps its message; unknown / non-domain → PHOTOS_ERROR. */
export function photosErrorMessage(e: unknown): string {
  return e instanceof DomainError && e.kind !== "unknown" ? e.message : PHOTOS_ERROR;
}

type Ctx = { previous: Listing | null | undefined };

export function photoReorderCallbacks(client: QueryClient, userId: string, listingId: string, reread: () => Promise<void>) {
  const key = ["own-listing", userId, listingId] as const;
  return {
    async onMutate(order: string[]): Promise<Ctx> {
      await Promise.all([client.cancelQueries({ queryKey: ["own-listing"] }), client.cancelQueries({ queryKey: ["own-listings", userId] })]);
      const previous = client.getQueryData<Listing | null>(key);
      client.setQueryData<Listing | null | undefined>(key, (l) => (l ? { ...l, photos: applyOrder(l.photos, order) } : l));
      return { previous };
    },
    onError(_error: unknown, _order: string[], ctx: Ctx | undefined): void {
      if (ctx) client.setQueryData(key, ctx.previous);
    },
    onSettled(): Promise<void> {
      return reread();
    },
  };
}
