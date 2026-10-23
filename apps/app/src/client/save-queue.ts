// Cola de guardados por casa. El asistente navega al instante y guarda por detrás; los guardados de una misma casa van
// en orden (cada uno lee y mezcla lo que dejó el anterior) y las lecturas de esa casa esperan a que terminen, para que una
// lectura vieja no pise en la caché lo que el propietario acaba de escribir.
const queues = new Map<string, Promise<unknown>>();
const pending = new Map<string, number>();

export function enqueueSave<T>(listingId: string, run: () => Promise<T>): Promise<T> {
  pending.set(listingId, (pending.get(listingId) ?? 0) + 1);
  const previous = queues.get(listingId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(run);
  const tail = next.finally(() => {
    const left = (pending.get(listingId) ?? 1) - 1;
    if (left === 0) pending.delete(listingId);
    else pending.set(listingId, left);
  });
  queues.set(listingId, tail.catch(() => undefined));
  return next;
}

/** Guardados de esta casa todavía en curso o en cola. */
export const savesPending = (listingId: string) => pending.get(listingId) ?? 0;

/** Espera a que terminen (bien o mal) los guardados de una casa. */
export const savesSettled = (listingId: string): Promise<void> => (queues.get(listingId) ?? Promise.resolve()).then(() => undefined);

/** Espera a que terminen los guardados de todas las casas. */
export const allSavesSettled = (): Promise<void> => Promise.all([...queues.values()]).then(() => undefined);
