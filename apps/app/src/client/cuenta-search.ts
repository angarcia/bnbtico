// Parámetros de búsqueda de las rutas de cuenta. Viven aparte de las pantallas para que el router (JS inicial) los valide
// sin arrastrar las pantallas, que se descargan al abrirlas.
import { safeNext } from "../domain/account";

export interface CuentaSearch {
  modo?: "entrar";
  next?: string;
  editar?: "1";
}

export function cuentaSearch(params: Record<string, unknown>): CuentaSearch {
  const out: CuentaSearch = {};
  if (params.modo === "entrar") out.modo = "entrar";
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (next) out.next = next;
  if (params.editar === "1") out.editar = "1";
  return out;
}

export const nextSearch = (params: Record<string, unknown>): { next?: string } => {
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  return next ? { next } : {};
};
