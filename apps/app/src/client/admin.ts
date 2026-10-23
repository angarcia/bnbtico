// Consultas y acciones de la zona del admin (ticket 09). La cola se persiste con la sesión (clave privada) y se pide de
// nuevo siempre al abrirla o volver a la app (staleTime 0). Revisar es optimista: la casa sale de la cola al instante y,
// si la base se niega, vuelve con su mensaje. La purga de la ficha pública la encola la base (trigger con pg_net).
import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { AdminListingsApi } from "../domain/api";
import { DomainError, toDomainError } from "../domain/errors";
import { DECISION_STATUS, applyDecision, type AdminQueue, type QueueItem, type ReviewDecision } from "../domain/review";
import { authApi } from "./session";

export const adminApi = async (): Promise<AdminListingsApi> => {
  await authApi();
  return (await import("./supabase-data")).adminApi();
};

export const adminQueueQuery = (userId: string) =>
  queryOptions({
    queryKey: ["admin-queue", userId] as const,
    queryFn: async () => (await adminApi()).queue(),
    staleTime: 0,
  });

const fromQueue = (q: AdminQueue | undefined, id: string) => q && [...q.review, ...q.changes, ...q.rejected].find((i) => i.listing.id === id);

export const adminListingQuery = (userId: string, id: string, client: QueryClient) => {
  const queue = client.getQueryState(adminQueueQuery(userId).queryKey);
  return queryOptions({
    queryKey: ["admin-listing", userId, id] as const,
    queryFn: async () => (await adminApi()).get(id),
    staleTime: 0,
    initialData: () => fromQueue(queue?.data as AdminQueue | undefined, id),
    initialDataUpdatedAt: queue?.dataUpdatedAt,
  });
};

// ---------- Resultado de la última decisión (lo muestra la cola, adonde se vuelve al decidir) ----------
export type ReviewOutcome = { kind: "saved" | "failed"; title: string; text: string } | null;
let outcome: ReviewOutcome = null;
const outcomeListeners = new Set<() => void>();
const setOutcome = (o: ReviewOutcome) => {
  outcome = o;
  outcomeListeners.forEach((l) => l());
};
export const clearReviewOutcome = () => setOutcome(null);
export function useReviewOutcome(): ReviewOutcome {
  return useSyncExternalStore(
    (l) => (outcomeListeners.add(l), () => void outcomeListeners.delete(l)),
    () => outcome,
    () => null,
  );
}

const SAVED: Record<ReviewDecision, string> = {
  approve: "Aprobada y publicada. El enlace ya funciona.",
  changes: "Cambios pedidos. El propietario verá su mensaje.",
  reject: "Rechazada. El propietario verá el motivo.",
};

export interface ReviewInput {
  item: QueueItem;
  decision: ReviewDecision;
  note: string;
}

/** Decisión optimista. Los callbacks van en el hook: corren aunque la pantalla de detalle ya no esté. */
export function useReview(userId: string) {
  const client = useQueryClient();
  const queueKey = adminQueueQuery(userId).queryKey;
  const itemKey = (id: string) => ["admin-listing", userId, id] as const;
  return useMutation({
    mutationFn: async ({ item, decision, note }: ReviewInput) => (await adminApi()).review(item.listing.id, decision, note),
    onMutate: async ({ item, decision, note }) => {
      const id = item.listing.id;
      await client.cancelQueries({ queryKey: queueKey });
      const previous = { queue: client.getQueryData<AdminQueue>(queueKey), item: client.getQueryData<QueueItem | null>(itemKey(id)) };
      const at = new Date().toISOString();
      client.setQueryData<AdminQueue>(queueKey, (q) => (q ? applyDecision(q, id, decision, note, at) : q));
      client.setQueryData<QueueItem | null>(itemKey(id), (i) =>
        i ? { ...i, listing: { ...i.listing, status: DECISION_STATUS[decision], reviewNote: note.trim() || null, reviewedAt: at } } : i,
      );
      setOutcome({ kind: "saved", title: item.listing.title, text: SAVED[decision] });
      return previous;
    },
    onError: (error, { item }, previous) => {
      if (previous?.queue) client.setQueryData(queueKey, previous.queue);
      if (previous?.item !== undefined) client.setQueryData(itemKey(item.listing.id), previous.item);
      setOutcome({ kind: "failed", title: item.listing.title, text: toDomainError(error).message });
    },
    onSettled: (_data, _error, { item }) => {
      void client.invalidateQueries({ queryKey: queueKey });
      void client.invalidateQueries({ queryKey: itemKey(item.listing.id) });
      void client.invalidateQueries({ queryKey: ["listing", item.listing.publicId] });
      void client.invalidateQueries({ queryKey: ["listings"] });
      void client.invalidateQueries({ queryKey: ["active-count"] });
    },
  });
}

// ---------- Segundo código ----------
/** El reto abierto, para no enviar otro código al volver a la pantalla (o al montarla dos veces). */
type Challenge = { userId: string; factorId: string; challengeId: string; sentAt: number };
let challenge: Challenge | null = null;
let sending: Promise<Challenge> | null = null;
const CHALLENGE_REUSE_MS = 4 * 60_000;

/** Envía el segundo código (inscribe el factor la primera vez); reutiliza el reto si es reciente salvo `again`. */
export async function sendSecondCode(userId: string, again = false): Promise<Challenge> {
  if (!again && challenge?.userId === userId && Date.now() - challenge.sentAt < CHALLENGE_REUSE_MS) return challenge;
  if (sending) return sending;
  sending = (async () => {
    try {
      const auth = await authApi();
      const factorId = challenge?.userId === userId ? challenge.factorId : (await auth.enrolMfa()).factorId;
      const { challengeId } = await challengeHonouringWait(() => auth.challengeMfa(factorId));
      const opened: Challenge = { userId, factorId, challengeId, sentAt: Date.now() };
      challenge = opened;
      return opened;
    } finally {
      sending = null;
    }
  })();
  return sending;
}

/** GoTrue admite un reto por factor cada `max_frequency` (1 s en local; unos segundos en el alojado). Si la pantalla se
 * abre justo después de otro envío (otra pestaña, volver enseguida), contesta «after N seconds»: se espera eso y se
 * reintenta una vez, en vez de dejar la pantalla sin código. Esperas largas (el tope por hora) se muestran tal cual. */
const SHORT_WAIT_SECONDS = 5;
async function challengeHonouringWait<T>(send: () => Promise<T>): Promise<T> {
  try {
    return await send();
  } catch (error) {
    const seconds = error instanceof DomainError ? error.retryAfterSeconds : undefined;
    if (seconds === undefined || seconds > SHORT_WAIT_SECONDS) throw error;
    await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000));
    return send();
  }
}

export async function verifySecondCode(code: string) {
  if (!challenge) throw new Error("sin reto");
  await (await authApi()).verifyMfa(challenge.factorId, challenge.challengeId, code);
  challenge = null;
}
