/** Alcance por casa de la pantalla de suscripción (`?casa=CT-####`): reglas puras, sin framework. */

export interface SuscripcionSearch { pago?: "ok"; casa?: string }

/** `unknown`: se pidió una casa y no está entre las del propietario (`owner_billing` solo devuelve las propias). */
export function scopeBilling<T extends { house: { publicId: string } }>(
  houses: readonly T[],
  casa: string | undefined,
): { scoped: T | null; all: readonly T[]; unknown: boolean } {
  if (!casa) return { scoped: null, all: houses, unknown: false };
  const scoped = houses.find((h) => h.house.publicId === casa) ?? null;
  return { scoped, all: houses, unknown: scoped === null };
}

/** La búsqueda por la que hay que reemplazar la URL, o null si ya está bien. Quita `pago=ok` siempre; quita `casa` solo
 *  si es desconocida Y los datos están asentados (no se está recargando: una casa recién aprobada aún no está en la caché). */
export function scopeFix(search: SuscripcionSearch, s: { unknown: boolean; settled: boolean }): { casa?: string } | null {
  const dropCasa = s.unknown && s.settled;
  if (search.pago === undefined && !(dropCasa && search.casa !== undefined)) return null;
  return search.casa !== undefined && !dropCasa ? { casa: search.casa } : {};
}
