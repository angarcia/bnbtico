// Esperar una promesa con tope: si no llega a tiempo, el valor de reserva (la promesa sigue su curso). Los errores pasan.
export function withTimeout<T, F>(promise: Promise<T>, ms: number, fallback: F): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<F>((resolve) => (timer = setTimeout(() => resolve(fallback), ms)));
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}
