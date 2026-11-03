// Ida y vuelta de la hoja de contacto por Ingresar (fase 3, ticket 03). Aparte de `inquiry.ts` para que la ficha de la SPA
// (JS inicial de la zona privada) sepa si reabrir la hoja sin arrastrar el resto de las consultas.
import { safeNext } from "./account";
import { isoParts } from "./dates";

/** Personas del filtro de Explorar, en la pestaña: la hoja de contacto arranca con ellas (revisión UX A3). */
export const PEOPLE_FILTER_KEY = "bnbtico-personas";

/** Fechas de la búsqueda de Explorar, en la pestaña: `{"llegada","salida"}` (el `{"desde"}` del modo mensual, que se fue el
 *  2026-11-02, ya no se entiende: la hoja arranca sin fechas). */
export const DATES_FILTER_KEY = "bnbtico-fechas";

export type SearchDates = { arrival: string; departure: string };

/** Lo que Explorar guarda en `DATES_FILTER_KEY` para estas noches; null = quitar la clave (sin fechas). */
export function searchDatesValue(range: { from: string; to: string } | null): string | null {
  return range ? JSON.stringify({ llegada: range.from, salida: range.to }) : null;
}

const validDay = (v: unknown, today: string): v is string => typeof v === "string" && isoParts(v) !== null && v >= today;

/** Las fechas guardadas por Explorar, si se entienden y no han pasado; si no, null. */
export function readSearchDates(raw: string | null, today: string): SearchDates | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort().join(",");
  if (keys === "llegada,salida" && validDay(o.llegada, today) && validDay(o.salida, today) && o.salida > o.llegada) return { arrival: o.llegada, departure: o.salida };
  return null;
}

/** Lo escrito en la hoja de una casa, en la pestaña (sessionStorage, 30 min). */
export const contactDraftKey = (publicId: string) => `bnbtico-contacto:${publicId}`;

/** La ficha con la hoja abierta: adonde vuelve el cliente tras verificar su WhatsApp. */
export const contactNext = (publicId: string) => `/casa/${publicId}?contacto=1`;

/** Ingresar / Crear cuenta con la vuelta a la hoja. */
export function signInToContact(publicId: string): string {
  const next = safeNext(contactNext(publicId));
  return next ? `/cuenta?next=${encodeURIComponent(next)}` : "/cuenta";
}

/** La casa a la que vuelve `next`, si es una ficha. */
export function listingInNext(next: string | null | undefined): string | null {
  const path = safeNext(next);
  return path?.match(/^\/casa\/(CT-\d{4,})(?:[?#]|$)/)?.[1] ?? null;
}

/** La ficha reabre la hoja si llega con `contacto=1` y hay un borrador de esa casa (si caducó, la hoja empieza de cero). */
export function shouldReopenContact(contacto: string | undefined, store: { getItem(key: string): string | null }, publicId: string): boolean {
  return contacto === "1" && store.getItem(contactDraftKey(publicId)) !== null;
}

/** `next` vuelve a la hoja de contacto de una ficha: la verificación se presenta como parte de escribirle al propietario. */
export function isContactNext(next: string | null | undefined): boolean {
  const path = safeNext(next);
  return !!path && listingInNext(path) !== null && /[?&]contacto=1(?:[&#]|$)/.test(path);
}

/** La vuelta al asistente de publicar tras verificar el WhatsApp. */
export const PUBLISH_NEXT = "/publicar/continuar";
export const isPublishNext = (next: string | null | undefined): boolean => safeNext(next) === PUBLISH_NEXT;
