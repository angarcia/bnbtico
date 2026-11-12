// Cola con concurrencia limitada: como mucho `n` tareas en marcha, el resto espera en orden de llegada.
// La usa la subida de fotos (tres objetos a la vez entre todas las fotos que se están subiendo).
export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

export function createLimiter(n: number): Limiter {
  let running = 0;
  const waiting: (() => void)[] = [];
  const next = () => {
    if (running >= n) return;
    const start = waiting.shift();
    if (start) {
      running++;
      start();
    }
  };
  return (task) =>
    new Promise((resolve, reject) => {
      waiting.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            running--;
            next();
          });
      });
      next();
    });
}
