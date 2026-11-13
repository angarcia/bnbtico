// «+» sin esperar a la base (2026-11-06): cuando Mis casas ya sabe que no hay borrador pendiente, el teléfono elige el id
// del borrador nuevo, lo deja en la caché con todo vacío y entra al paso 1 al instante. La fila se crea por detrás como el
// primer guardado de esa casa en la cola (save-queue.ts): los guardados del paso 1 y siguientes esperan a que exista.
// Si la base no la crea (sin red, el límite de borradores), se vuelve a la entrada con el mensaje y «Empezar».
import { randomUuid } from "../../shared/random-uuid";
import type { QueryClient } from "@tanstack/react-query";
import { DomainError } from "../../domain/errors";
import { emptyDraft, type Listing } from "../../domain/listing";
import { ownListingKey, ownListingsKey, ownResumableKey } from "../listing-keys";
import { addOwnCached, api, patchCached } from "../owner";
import { enqueueSave } from "../save-queue";
import { markLostDraft } from "./lost-drafts";

const GENERIC = "Algo salió mal. Intente de nuevo en un momento.";
let failure: string | null = null;

/** El mensaje del último borrador que no se pudo crear (lo enseña la entrada; después, `clearCreateFailure`). */
export const createFailure = (): string | null => failure;
export const clearCreateFailure = () => void (failure = null);

/** El borrador tal como lo crea la base (createDraft): todo vacío, por noches y sin mensual. */
function provisional(id: string, ownerId: string): Listing {
  const now = new Date().toISOString();
  const { photoCount: _empty, ...draft } = emptyDraft();
  return {
    ...draft,
    photoCount: 0,
    id,
    publicId: "",
    ownerId,
    status: "draft",
    available: true,
    reopenAt: null,
    reviewNote: null,
    reviewedAt: null,
    firstPublishedAt: null,
    whatsappPhone: "",
    createdAt: now,
    updatedAt: now,
    photos: [],
    edit: null,
    adminHold: null,
  };
}

/** Empieza un borrador nuevo y devuelve su id ya (sin esperar a la base). `onLost`: la base no lo creó. */
export function startDraft(client: QueryClient, userId: string, onLost: (id: string, message: string) => void): string {
  const id = randomUuid();
  client.setQueryData(ownListingKey(userId, id), provisional(id, userId));
  const created = enqueueSave(id, async () => (await api()).createDraft(id));
  created.then(
    ({ listing }) => {
      // Lo que pone la base (CT-####, WhatsApp del perfil, fechas) sin pisar lo que ya se eligió en el paso 1.
      const { publicId, ownerId, whatsappPhone, createdAt, updatedAt } = listing;
      patchCached(client, userId, id, { publicId, ownerId, whatsappPhone, createdAt, updatedAt });
      addOwnCached(client, userId, client.getQueryData<Listing>(ownListingKey(userId, id)) ?? listing);
      void client.invalidateQueries({ queryKey: ownListingsKey(userId) });
      void client.invalidateQueries({ queryKey: ownResumableKey(userId) });
    },
    (e: unknown) => {
      const message = e instanceof DomainError ? e.message : GENERIC;
      markLostDraft(id);
      failure = message;
      client.removeQueries({ queryKey: ownListingKey(userId, id) });
      onLost(id, message);
    },
  );
  return id;
}
