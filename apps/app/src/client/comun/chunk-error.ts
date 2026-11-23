/** ¿El error es de un trozo diferido que no llegó (sin red, o un despliegue nuevo cambió su nombre)? Cada navegador lo
 * dice a su manera; la precarga de Vite, con «Unable to preload». Lo demás es un fallo de pintado. */
export const isChunkLoadError = (e: unknown): boolean =>
  e instanceof Error && /dynamically imported module|Importing a module script failed|Unable to preload/i.test(e.message);
