// Consultas y acciones de la zona del admin (ticket 09). La cola se persiste con la sesión (clave privada) y se pide de
// nuevo siempre al abrirla o volver a la app (staleTime 0). Revisar es optimista: la casa sale de la cola al instante y,
// si la base se niega, vuelve con su mensaje. La purga de la ficha pública la encola la base (trigger con pg_net).
import { queryOptions, useMutation, useMutationState, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { AdminListingsApi, MfaFactor } from "../domain/api";
import { toDomainError } from "../domain/errors";
import { DECISION_STATUS, EDIT_REVIEW_SAVED, applyDecision, type AdminQueue, type EditDecision, type QueueItem, type ReviewDecision } from "../domain/review";
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

/** Casas del admin (diseño 23): solo lectura; se piden de nuevo al abrir la pantalla. */
export const adminHousesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["admin-houses", userId] as const,
    queryFn: async () => (await adminApi()).houses(),
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

const reviewKey = (userId: string) => ["admin-review", userId] as const;

/**
 * La cola tal como debe verse: lo que dice la base más las decisiones aún en curso. Sin esto, una lectura de la cola que
 * llegue antes de que la base guarde la decisión (la cola se pide al abrirla, staleTime 0) devolvería la casa a la cola.
 */
export function useQueueWithPending(userId: string, queue: AdminQueue | undefined): AdminQueue | undefined {
  const pending = useMutationState({
    filters: { mutationKey: reviewKey(userId), status: "pending" },
    select: (m) => ({ input: m.state.variables as ReviewInput, at: new Date(m.state.submittedAt).toISOString() }),
  });
  if (!queue) return queue;
  return pending.reduce((q, { input, at }) => applyDecision(q, input.item.listing.id, input.decision, input.note, at), queue);
}

/** Decisión optimista. Los callbacks van en el hook: corren aunque la pantalla de detalle ya no esté. */
export function useReview(userId: string) {
  const client = useQueryClient();
  const queueKey = adminQueueQuery(userId).queryKey;
  const itemKey = (id: string) => ["admin-listing", userId, id] as const;
  return useMutation({
    mutationKey: reviewKey(userId),
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
      void client.invalidateQueries({ queryKey: ["offer-taken"] });
      void client.invalidateQueries({ queryKey: adminHousesQuery(userId).queryKey });
    },
  });
}

// ---------- Ediciones de casas publicadas (spec .scratch/editar-casa §4) ----------
/** Ediciones en revisión, la que más espera primero; se piden de nuevo al abrir la cola. */
export const adminEditsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["admin-edits", userId] as const,
    queryFn: async () => (await adminApi()).editQueue(),
    staleTime: 0,
  });

/** Una edición con la casa aprobada; abre con la de la cola si ya está. */
export const adminEditQuery = (userId: string, id: string, client?: QueryClient) => {
  const edits = client?.getQueryState(adminEditsQuery(userId).queryKey);
  return queryOptions({
    queryKey: ["admin-edit", userId, id] as const,
    queryFn: async () => (await adminApi()).getEdit(id),
    staleTime: 0,
    initialData: () => (edits?.data as QueueItem[] | undefined)?.find((i) => i.listing.id === id),
    initialDataUpdatedAt: edits?.dataUpdatedAt,
  });
};

export interface EditReviewInput {
  item: QueueItem;
  decision: EditDecision;
  note: string;
}

const editReviewKey = (userId: string) => ["admin-review-edit", userId] as const;

/** La cola de ediciones sin las que tienen una decisión en curso (como useQueueWithPending). */
export function useEditsWithPending(userId: string, edits: QueueItem[] | undefined): QueueItem[] | undefined {
  const pending = useMutationState({
    filters: { mutationKey: editReviewKey(userId), status: "pending" },
    select: (m) => (m.state.variables as EditReviewInput).item.listing.id,
  });
  return edits && pending.length ? edits.filter((i) => !pending.includes(i.listing.id)) : edits;
}

/** Decisión optimista sobre una edición: sale de la cola al instante y, si la base se niega, vuelve con su mensaje. */
export function useReviewEdit(userId: string) {
  const client = useQueryClient();
  const editsKey = adminEditsQuery(userId).queryKey;
  return useMutation<void, Error, EditReviewInput, { edits: QueueItem[] | undefined }>({
    mutationKey: editReviewKey(userId),
    mutationFn: async ({ item, decision, note }) => (await adminApi()).reviewEdit(item.listing.id, decision, note, item.listing.edit?.submittedAt ?? null),
    onMutate: async ({ item, decision }) => {
      await client.cancelQueries({ queryKey: editsKey });
      const edits = client.getQueryData<QueueItem[]>(editsKey);
      client.setQueryData<QueueItem[]>(editsKey, (q) => q?.filter((i) => i.listing.id !== item.listing.id));
      setOutcome({ kind: "saved", title: item.listing.title, text: EDIT_REVIEW_SAVED[decision] });
      return { edits };
    },
    onError: (error, { item }, previous) => {
      if (previous?.edits) client.setQueryData(editsKey, previous.edits);
      setOutcome({ kind: "failed", title: item.listing.title, text: toDomainError(error).message });
    },
    onSettled: (_data, _error, { item }) => {
      void client.invalidateQueries({ queryKey: editsKey });
      void client.invalidateQueries({ queryKey: ["admin-edit", userId, item.listing.id] });
      void client.invalidateQueries({ queryKey: ["listing", item.listing.publicId] });
      void client.invalidateQueries({ queryKey: ["listings"] });
      void client.invalidateQueries({ queryKey: adminHousesQuery(userId).queryKey });
    },
  });
}

// ---------- Segundo factor (app de autenticación) ----------
/** El factor de la cuenta: si la pantalla se monta dos veces no se inscribe otro (cambiaría el QR ya escaneado). */
let factor: { userId: string; value: MfaFactor } | null = null;
let loading: Promise<MfaFactor> | null = null;

/** El factor TOTP del admin: el verificado, o uno recién inscrito con su QR y su clave. */
export async function loadSecondFactor(userId: string): Promise<MfaFactor> {
  if (factor?.userId === userId) return factor.value;
  if (loading) return loading;
  loading = (async () => {
    try {
      const value = await (await authApi()).enrolMfa();
      factor = { userId, value };
      return value;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export async function verifySecondCode(userId: string, code: string) {
  const { factorId } = await loadSecondFactor(userId);
  try {
    await (await authApi()).verifyMfa(factorId, code);
  } catch (error) {
    // El factor ya no existe (lo quitaron en otro sitio): la próxima vez se inscribe uno nuevo.
    if (toDomainError(error).kind === "conflict") factor = null;
    throw error;
  }
  factor = { userId, value: { factorId, verified: true } };
}
