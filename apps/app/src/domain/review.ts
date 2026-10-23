// Revisión del admin (ticket 09). Las reglas las aplica la RPC review_listing; aquí van sus mensajes, lo que el navegador
// puede comprobar antes de llamarla (motivo obligatorio y largo) y cómo se reparte la cola.
import type { Listing } from "./listing";

export type ReviewDecision = "approve" | "changes" | "reject";

/** Estado en que deja la casa cada decisión. */
export const DECISION_STATUS = { approve: "active", changes: "changes", reject: "rejected" } as const satisfies Record<ReviewDecision, Listing["status"]>;
export const REVIEW_NOTE_MAX = 2000;

/** Mensajes de review_listing y de la guarda de admin (iguales en la base, el adaptador y el fake). */
export const REVIEW_MESSAGES = {
  mfaRequired: "Confirme el segundo código para revisar anuncios.",
  adminOnly: "Solo bnbtico puede revisar anuncios.",
  notFound: "No encontramos ese anuncio.",
  decided: "Este anuncio ya tiene una decisión.",
  noteRequired: "Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.",
  noteTooLong: `El motivo puede tener como mucho ${REVIEW_NOTE_MAX} caracteres.`,
  fewPhotos: "Pida al menos 5 fotos antes de aprobar.",
} as const;

/** Lo que se puede rechazar sin preguntar a la base. La base recorta a 2000; aquí se avisa antes de perder texto. */
export function reviewNoteRefusal(decision: ReviewDecision, note: string): string | null {
  const text = note.trim();
  if (text.length > REVIEW_NOTE_MAX) return REVIEW_MESSAGES.noteTooLong;
  if (decision !== "approve" && text === "") return REVIEW_MESSAGES.noteRequired;
  return null;
}

/** «Corregida» si ya tuvo una decisión antes (el propietario reenvió tras cambios pedidos o tras editar una activa). */
export const queueBadge = (l: Pick<Listing, "reviewedAt">): "Nueva" | "Corregida" => (l.reviewedAt ? "Corregida" : "Nueva");

export interface QueueItem {
  listing: Listing;
  ownerName: string;
}

/** La cola de anuncios del admin, separada por estado. */
export interface AdminQueue {
  /** En revisión, la que más espera primero. */
  review: QueueItem[];
  /** Cambios pedidos, la decisión más reciente primero. */
  changes: QueueItem[];
  /** Rechazadas, la decisión más reciente primero (las 50 últimas). */
  rejected: QueueItem[];
  /** Casas activas en todo el catálogo. */
  active: number;
}

export const REJECTED_SHOWN = 50;

export const emptyQueue = (): AdminQueue => ({ review: [], changes: [], rejected: [], active: 0 });

const byAsc = (k: "updatedAt" | "reviewedAt") => (a: QueueItem, b: QueueItem) => (a.listing[k] ?? "").localeCompare(b.listing[k] ?? "");
const byDesc = (k: "updatedAt" | "reviewedAt") => (a: QueueItem, b: QueueItem) => (b.listing[k] ?? "").localeCompare(a.listing[k] ?? "");

/** Reparte filas en revisión, con cambios y rechazadas en la cola, con el orden de cada lista. */
export function splitQueue(items: QueueItem[], active: number): AdminQueue {
  const of = (s: Listing["status"]) => items.filter((i) => i.listing.status === s);
  return {
    review: of("review").sort(byAsc("updatedAt")),
    changes: of("changes").sort(byDesc("reviewedAt")),
    rejected: of("rejected").sort(byDesc("reviewedAt")).slice(0, REJECTED_SHOWN),
    active,
  };
}

/** Cómo queda la cola tras una decisión (escritura optimista): sale de «por revisar» y entra donde toque. */
export function applyDecision(queue: AdminQueue, id: string, decision: ReviewDecision, note: string, at: string): AdminQueue {
  const item = queue.review.find((i) => i.listing.id === id);
  if (!item) return queue;
  const status = DECISION_STATUS[decision];
  const decided: QueueItem = { ...item, listing: { ...item.listing, status, reviewNote: note.trim() || null, reviewedAt: at } };
  const rest = { ...queue, review: queue.review.filter((i) => i.listing.id !== id) };
  if (status === "active") return { ...rest, active: queue.active + 1 };
  return status === "changes" ? { ...rest, changes: [decided, ...queue.changes] } : { ...rest, rejected: [decided, ...queue.rejected].slice(0, REJECTED_SHOWN) };
}
