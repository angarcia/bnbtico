// Destino al que volver tras verificar el código. Solo rutas internas: evita redirecciones abiertas (`//otro.com`, `https://…`).
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!/^\/(?![/\\])/.test(next)) return null;
  return next;
}
