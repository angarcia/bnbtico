// Ida y vuelta de la hoja de contacto por Ingresar (fase 3, ticket 03). Aparte de `inquiry.ts` para que la ficha de la SPA
// (JS inicial de la zona privada) sepa si reabrir la hoja sin arrastrar el resto de las consultas.
import { safeNext } from "./account";

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
