// Cola de guardados por casa. El asistente navega al instante y guarda por detrás; los guardados de una misma casa van
// en orden (cada uno lee y mezcla lo que dejó el anterior) y las lecturas de esa casa esperan a que terminen, para que una
// lectura vieja no pise en la caché lo que el propietario acaba de escribir.
// Un guardado con la cola libre arranca en el mismo tick (la petición sale antes de que la app pueda cerrarse). Si la
// página se oculta o se va, los que esperaban turno salen ya, sin esperar al de delante: con keepalive llegan aunque la
// app se cierre. Cada guardado escribe solo las columnas que cambió su pantalla, así que adelantarse no pisa al anterior.
interface Job {
  run: () => Promise<unknown>;
  result?: Promise<unknown>;
}

const queues = new Map<string, Promise<unknown>>();
const pending = new Map<string, number>();
const waiting = new Set<Job>();

function start(job: Job): Promise<unknown> {
  if (!job.result) {
    waiting.delete(job);
    try {
      job.result = job.run();
    } catch (e) {
      job.result = Promise.reject(e);
    }
  }
  return job.result;
}

export function enqueueSave<T>(listingId: string, run: () => Promise<T>): Promise<T> {
  pending.set(listingId, (pending.get(listingId) ?? 0) + 1);
  const job: Job = { run };
  const previous = queues.get(listingId);
  let next: Promise<T>;
  if (previous) {
    waiting.add(job);
    next = previous.then(() => start(job)) as Promise<T>;
  } else {
    next = start(job) as Promise<T>;
  }
  const tail = next.finally(() => {
    const left = (pending.get(listingId) ?? 1) - 1;
    if (left > 0) return void pending.set(listingId, left);
    pending.delete(listingId);
    if (queues.get(listingId) === settled) queues.delete(listingId);
  });
  const settled = tail.catch(() => undefined);
  queues.set(listingId, settled);
  return next;
}

/** Lanza ya los guardados que esperaban turno (la página se oculta o se va). */
export function flushSaves(): void {
  [...waiting].forEach(start);
}

interface HideTargets {
  win: EventTarget;
  doc: EventTarget & { visibilityState: DocumentVisibilityState };
}

/** Vacía la cola al ocultarse la página (`visibilitychange` → hidden) o al irse (`pagehide`). */
export function flushOnHide(win: HideTargets["win"], doc: HideTargets["doc"]): () => void {
  const onVisibility = () => {
    if (doc.visibilityState === "hidden") flushSaves();
  };
  win.addEventListener("pagehide", flushSaves);
  doc.addEventListener("visibilitychange", onVisibility);
  return () => {
    win.removeEventListener("pagehide", flushSaves);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined") flushOnHide(window, document);

/** Guardados de esta casa todavía en curso o en cola. */
export const savesPending = (listingId: string) => pending.get(listingId) ?? 0;

/** Espera a que terminen (bien o mal) los guardados de una casa. */
export const savesSettled = (listingId: string): Promise<void> => (queues.get(listingId) ?? Promise.resolve()).then(() => undefined);

/** Espera a que terminen los guardados de todas las casas. */
export const allSavesSettled = (): Promise<void> => Promise.all([...queues.values()]).then(() => undefined);
