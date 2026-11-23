/** Tira de fotos de la tarjeta de Explorar (ticket 09 de la ronda del 2 nov): al deslizar, la foto que marca el contador
 *  (`index`, la más cerca) y hasta cuál se monta (`reach`: la que asoma y la siguiente, para que al soltar ya esté pedida).
 *  Lo montado no se desmonta. null si la tira no tiene ancho. */
export function stripStep({ scrollLeft, width, count, reach }: { scrollLeft: number; width: number; count: number; reach: number }): { index: number; reach: number } | null {
  if (!width) return null;
  const last = count - 1;
  const at = scrollLeft / width;
  return { index: Math.min(last, Math.round(at)), reach: Math.min(last, Math.max(reach, Math.ceil(at) + 1)) };
}

